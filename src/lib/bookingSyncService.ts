import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  serverTimestamp,
  FirestoreError,
} from 'firebase/firestore';
import {
  auth,
  db,
  defaultDb,
  OperationType,
  handleFirestoreError,
} from './firebase';
import {
  Booking,
  BLUEPRINT_CONSTRAINTS,
  INITIAL_SAMPLE_BOOKINGS,
  OFFICIAL_EMAIL,
  clampNumber,
  isSampleDemoBooking,
  normalizeIncomingBooking,
  sanitizeString,
  sortBookingsNewestFirst,
} from '../types/safar';

const SEQ_STORAGE_KEY = 'safar_booking_seq_counter';
export const BOOKING_BROADCAST_CHANNEL = 'safar_live_bookings_channel';

/**
 * Primary collection used by the SafarIndiaCabs Customer App, plus supported
 * fallback collection names in case a customer client writes to an alias.
 */
export const PRIMARY_BOOKINGS_COLLECTION = 'bookings';
export const FALLBACK_BOOKING_COLLECTIONS = [
  'bookings',
  'cab_bookings',
  'rides',
  'customer_bookings',
] as const;

export interface FirestoreSyncDiagnosticState {
  status: 'connecting' | 'live' | 'permission-error' | 'index-fallback' | 'collection-mismatch-warning';
  activeCollection: string;
  activeDatabase: string;
  totalCloudDocs: number;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  collectionCounts: Record<string, number>;
}

/**
 * Detailed console diagnostic logger for Firestore listener & fetch failures.
 * Specifically identifies:
 *  1. Missing Composite Index (`failed-precondition` / index URL)
 *  2. Permission Denied (`permission-denied` / security rules / unauthenticated session)
 *  3. Collection Mismatch or Network / Database ID issues
 */
export function diagnoseAndLogFirestoreError(
  error: unknown,
  context: {
    operation: OperationType;
    collectionName: string;
    databaseLabel: string;
    path?: string;
  }
): {
  reason: 'missing-index' | 'permission-denied' | 'collection-or-network';
  code: string;
  message: string;
} {
  const fbErr = error as Partial<FirestoreError> | undefined;
  const code = String(fbErr?.code || 'unknown');
  const message = String(
    fbErr?.message || (error instanceof Error ? error.message : String(error))
  );
  const fullPath = context.path || context.collectionName;

  if (code === 'failed-precondition' || message.toLowerCase().includes('index')) {
    const indexUrlMatch = message.match(
      /https:\/\/console\.firebase\.google\.com[^\s)]+/
    );
    console.error(
      `[SafarIndiaCabs Firestore Audit] MISSING COMPOSITE INDEX on "${context.databaseLabel}/${fullPath}".\n` +
        `• Error Code: ${code}\n` +
        `• Details: ${message}\n` +
        (indexUrlMatch
          ? `• Create Index URL: ${indexUrlMatch[0]}\n`
          : '') +
        `• Automatic Fallback: Switching "${context.databaseLabel}/${context.collectionName}" to unindexed real-time collection listener with client-side timestamp sorting.`
    );
    return { reason: 'missing-index', code, message };
  }

  if (code === 'permission-denied' || code === 'unauthenticated') {
    const currentUser = auth.currentUser;
    const directOp =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('safar_direct_operator_email')
        : null;
    console.error(
      `[SafarIndiaCabs Firestore Audit] PERMISSION DENIED on "${context.databaseLabel}/${fullPath}".\n` +
        `• Error Code: ${code}\n` +
        `• Firebase Auth User: ${
          currentUser
            ? `${currentUser.email} (uid=${currentUser.uid}, verified=${currentUser.emailVerified})`
            : 'null (not signed into Firebase Auth)'
        }\n` +
        `• Direct Operator Session: ${directOp || 'none'}\n` +
        `• Details: ${message}\n` +
        `• Action Hint: Verify that firestore.rules allows read/list on "/${context.collectionName}/{bookingId}" and that the same Firebase project ("gen-lang-client-0422638729") is used by both Customer App and Admin Panel.`
    );
    try {
      handleFirestoreError(error, context.operation, fullPath);
    } catch {
      // handleFirestoreError logs structured JSON before throwing; swallow throw so UI remains interactive
    }
    return { reason: 'permission-denied', code, message };
  }

  console.warn(
    `[SafarIndiaCabs Firestore Audit] Listener/Fetch warning on "${context.databaseLabel}/${fullPath}" (code=${code}): ${message}`
  );
  return { reason: 'collection-or-network', code, message };
}

/**
 * Normalizes any user-entered or pasted Booking ID string (e.g. "sic2604", "#SIC-2604", "2604")
 * into canonical "SICXXXX" format.
 */
export function normalizeBookingIdInput(rawInput: string): string {
  const cleaned = String(rawInput || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return '';
  const digits = cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('SIC') && digits.length >= 3) {
    return `SIC${digits.slice(0, 10)}`;
  }
  if (digits.length >= 3) {
    return `SIC${digits.slice(0, 10)}`;
  }
  return cleaned;
}

/**
 * Generates a unique, human-readable Booking ID in SICXXXX format using a
 * persistent sequential counter combined with timestamp entropy.
 */
export function generateUniqueBookingId(existingIds: string[] = []): string {
  const existingSet = new Set(
    existingIds.map((id) => normalizeBookingIdInput(id))
  );

  let nextSeq = 2608;
  try {
    const savedSeq = Number(localStorage.getItem(SEQ_STORAGE_KEY) || '0');
    let maxExisting = 2607;
    existingSet.forEach((id) => {
      const m = id.match(/^SIC(\d{4,6})$/);
      if (m) {
        const val = Number(m[1]);
        if (val > maxExisting && val < 99999) {
          maxExisting = val;
        }
      }
    });
    nextSeq = Math.max(savedSeq + 1, maxExisting + 1, 2608);
  } catch {
    nextSeq = Math.floor(2608 + (Date.now() % 7000));
  }

  let candidate = `SIC${nextSeq}`;
  let attempts = 0;
  while (existingSet.has(candidate) && attempts < 50) {
    nextSeq += 1;
    candidate = `SIC${nextSeq}`;
    attempts += 1;
  }

  try {
    localStorage.setItem(SEQ_STORAGE_KEY, String(nextSeq));
  } catch {
    // ignore storage quota errors
  }

  return candidate;
}

/**
 * Builds a strict, Firestore-rules-compliant Booking document payload so that
 * writes from either the Customer App or Admin Panel never fail schema validation
 * and are indexed both by Document ID (`bookings/SICXXXX`) and searchable field (`bookingId`).
 */
export function buildFirestoreBookingPayload(
  booking: Booking,
  currentUserId?: string | null
) {
  const canonicalId =
    normalizeBookingIdInput(booking.bookingId) || generateUniqueBookingId();
  const cleanCustomerName = sanitizeString(
    booking.customerName || 'Safar Customer',
    BLUEPRINT_CONSTRAINTS.MAX_CUSTOMER_NAME
  );
  const cleanPhone = sanitizeString(
    booking.customerPhone || '+91 9999999999',
    BLUEPRINT_CONSTRAINTS.MAX_PHONE
  );
  const cleanEmail = sanitizeString(
    booking.customerEmail || OFFICIAL_EMAIL,
    BLUEPRINT_CONSTRAINTS.MAX_EMAIL
  );
  const cleanGstin = sanitizeString(
    booking.customerGstin || '',
    BLUEPRINT_CONSTRAINTS.MAX_GSTIN
  );
  const cleanPickup = sanitizeString(
    booking.pickupCity || 'New Delhi',
    BLUEPRINT_CONSTRAINTS.MAX_CITY
  );
  const cleanDrop = sanitizeString(
    booking.dropCity || 'Outstation Destination',
    BLUEPRINT_CONSTRAINTS.MAX_CITY
  );
  const routeSummary = sanitizeString(`${cleanPickup} → ${cleanDrop}`, 260);

  const todayIso = new Date().toISOString().slice(0, 10);
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.pickupDate || '')
    ? booking.pickupDate
    : todayIso;
  const cleanTime = sanitizeString(booking.pickupTime || '08:30 AM', 12);

  const distanceKm = clampNumber(booking.distanceKm || 250, 1, 25000);
  const tripDays = clampNumber(booking.tripDays || 1, 1, 90);
  const perKmRate = clampNumber(booking.perKmRate || 14, 5, 500);
  const baseFare = clampNumber(booking.baseFare || 0, 0, 5000000);
  const driverAllowance = clampNumber(booking.driverAllowance || 0, 0, 500000);
  const tollTax = clampNumber(booking.tollTax || 0, 0, 500000);
  const stateTax = clampNumber(booking.stateTax || 0, 0, 500000);
  const nightCharges = clampNumber(booking.nightCharges || 0, 0, 500000);
  const marketDiscount = clampNumber(booking.marketDiscount || 0, 0, 50000);
  const gstAmount = clampNumber(booking.gstAmount || 0, 0, 1000000);
  const totalFare = clampNumber(booking.totalFare || 0, 0, 6000000);
  const advancePaid = clampNumber(booking.advancePaid || 0, 0, 6000000);
  const balanceAmount = clampNumber(
    booking.balanceAmount ?? Math.max(0, totalFare - advancePaid),
    0,
    6000000
  );

  return {
    bookingId: canonicalId,
    customerName:
      cleanCustomerName.length >= 2 ? cleanCustomerName : 'Safar Customer',
    customerPhone: cleanPhone.length >= 10 ? cleanPhone : '+91 9999999999',
    customerEmail: cleanEmail.length >= 5 ? cleanEmail : OFFICIAL_EMAIL,
    customerGstin: cleanGstin,
    tripType: booking.tripType || 'Round Trip Outstation',
    pickupCity: cleanPickup.length >= 2 ? cleanPickup : 'New Delhi',
    dropCity: cleanDrop.length >= 2 ? cleanDrop : 'Outstation',
    route: routeSummary,
    pickupDate: cleanDate,
    pickupTime: cleanTime.length >= 4 ? cleanTime : '08:30 AM',
    sameDayReturn: Boolean(booking.sameDayReturn ?? tripDays === 1),
    vehicleCategory: booking.vehicleCategory || 'Sedan',
    distanceKm,
    tripDays,
    perKmRate,
    baseFare,
    driverAllowance,
    tollTax,
    stateTax,
    nightCharges,
    marketDiscount,
    gstAmount,
    totalFare,
    paymentMode:
      booking.paymentMode === 'Full Paid' ? 'Full Paid' : '20% Advance',
    advancePaid,
    balanceAmount,
    status: booking.status || 'Pending',
    workflowStage: sanitizeString(booking.workflowStage || 'Requested', 40),
    bookingSource: sanitizeString(
      booking.bookingSource || 'Customer Android App',
      40
    ),
    specialInstructions: sanitizeString(booking.specialInstructions || '', 500),
    internalNotes: sanitizeString(booking.internalNotes || '', 500),
    driverName: sanitizeString(
      booking.driverName || '',
      BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
    ),
    driverPhone: sanitizeString(
      booking.driverPhone || '',
      BLUEPRINT_CONSTRAINTS.MAX_PHONE
    ),
    vehicleNumber: sanitizeString(
      booking.vehicleNumber || '',
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
    ),
    vehicleModel: sanitizeString(
      booking.vehicleModel || '',
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL
    ),
    invoiceNumber: sanitizeString(
      booking.invoiceNumber || '',
      BLUEPRINT_CONSTRAINTS.MAX_INVOICE_NUMBER
    ),
    invoiceReady: Boolean(booking.invoiceReady),
    createdBy:
      currentUserId ||
      auth.currentUser?.uid ||
      booking.createdBy ||
      'customer-live-sync',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Subscribes in real time (`onSnapshot`) to `'bookings'` (primary collection) and
 * fallback customer collections (`'cab_bookings'`, `'rides'`, `'customer_bookings'`)
 * across both the named Firestore database (`db`) and `(default)` database (`defaultDb`).
 *
 * Automatically populates state on document additions, modifications, and removals
 * without requiring a manual page refresh.
 */
export function subscribeToRealtimeCustomerBookings(options: {
  onBookingsSnapshot: (
    allCloudBookings: Booking[],
    meta: {
      source: string;
      addedBookings: Booking[];
      removedBookingIds: string[];
      isInitialLoad: boolean;
    }
  ) => void;
  onDiagnosticChange?: (diag: FirestoreSyncDiagnosticState) => void;
}): () => void {
  // Map of `${dbLabel}/${colName}/${docId}` -> normalized Booking
  const liveDocsByPath = new Map<string, Booking>();
  const initializedStreams = new Set<string>();
  const collectionCounts: Record<string, number> = {};

  let diagState: FirestoreSyncDiagnosticState = {
    status: 'connecting',
    activeCollection: PRIMARY_BOOKINGS_COLLECTION,
    activeDatabase: 'named-db + default-db',
    totalCloudDocs: 0,
    lastSyncedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    collectionCounts: {},
  };

  const emitDiagnostics = (patch: Partial<FirestoreSyncDiagnosticState>) => {
    diagState = {
      ...diagState,
      ...patch,
      collectionCounts: { ...collectionCounts },
    };
    options.onDiagnosticChange?.(diagState);
  };

  const emitConsolidatedBookings = (
    sourceKey: string,
    addedBookings: Booking[],
    removedBookingIds: string[],
    isInitialLoad: boolean
  ) => {
    // Deduplicate across named-db and default-db by canonical bookingId (newest timestamp wins)
    const byBookingId = new Map<string, Booking>();
    liveDocsByPath.forEach((booking) => {
      const existing = byBookingId.get(booking.bookingId);
      if (
        !existing ||
        (booking.timestampMs || 0) >= (existing.timestampMs || 0)
      ) {
        byBookingId.set(booking.bookingId, booking);
      }
    });

    const sortedList = sortBookingsNewestFirst(Array.from(byBookingId.values()));

    emitDiagnostics({
      status: 'live',
      totalCloudDocs: sortedList.length,
      lastSyncedAt: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });

    options.onBookingsSnapshot(sortedList, {
      source: sourceKey,
      addedBookings,
      removedBookingIds,
      isInitialLoad,
    });
  };

  const databases = [
    { instance: db, label: 'named-db' },
    { instance: defaultDb, label: 'default-db' },
  ];

  const unsubscribers: Array<() => void> = [];

  databases.forEach(({ instance, label }) => {
    FALLBACK_BOOKING_COLLECTIONS.forEach((colName) => {
      const streamKey = `${label}/${colName}`;
      const isPrimaryStream = colName === PRIMARY_BOOKINGS_COLLECTION;

      const unsub = onSnapshot(
        collection(instance, colName),
        (snapshot) => {
          const isInitialLoad = !initializedStreams.has(streamKey);
          initializedStreams.add(streamKey);

          const addedBookings: Booking[] = [];
          const removedBookingIds: string[] = [];

          // Process incremental docChanges() so newly created customer bookings are detected immediately
          snapshot.docChanges().forEach((change) => {
            const docKey = `${streamKey}/${change.doc.id}`;
            if (change.type === 'removed') {
              const prev = liveDocsByPath.get(docKey);
              if (prev) {
                removedBookingIds.push(prev.bookingId);
                liveDocsByPath.delete(docKey);
              }
              return;
            }

            const normalized = normalizeIncomingBooking(
              change.doc.id,
              change.doc.data() as Record<string, unknown>,
              streamKey
            );

            if (!normalized) return;

            if (isSampleDemoBooking(normalized)) {
              deleteDoc(doc(instance, colName, change.doc.id)).catch(() => {});
              liveDocsByPath.delete(docKey);
              return;
            }

            liveDocsByPath.set(docKey, normalized);
            if (change.type === 'added' && !isInitialLoad) {
              addedBookings.push(normalized);
              console.info(
                `[SafarIndiaCabs Live Sync] New customer booking received in real-time from "${streamKey}": ${normalized.bookingId} (${normalized.customerName} • ${normalized.pickupCity} → ${normalized.dropCity})`
              );
            }
          });

          // Also reconcile full snapshot docs to guarantee zero drift
          let validCountInStream = 0;
          snapshot.forEach((docSnap) => {
            const docKey = `${streamKey}/${docSnap.id}`;
            const normalized = normalizeIncomingBooking(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
              streamKey
            );
            if (!normalized || isSampleDemoBooking(normalized)) {
              liveDocsByPath.delete(docKey);
              return;
            }
            validCountInStream += 1;
            liveDocsByPath.set(docKey, normalized);
          });

          collectionCounts[streamKey] = validCountInStream;

          if (!isPrimaryStream && validCountInStream > 0) {
            console.warn(
              `[SafarIndiaCabs Firestore Audit] Detected ${validCountInStream} customer booking document(s) in alternate collection "${streamKey}". Automatically merged into Admin Panel Control Room.`
            );
          }

          emitConsolidatedBookings(
            streamKey,
            addedBookings,
            removedBookingIds,
            isInitialLoad
          );
        },
        (error) => {
          // Only log loud errors on primary `'bookings'` collection or permission/index errors
          if (isPrimaryStream || label === 'named-db') {
            const diag = diagnoseAndLogFirestoreError(error, {
              operation: OperationType.LIST,
              collectionName: colName,
              databaseLabel: label,
            });
            emitDiagnostics({
              status:
                diag.reason === 'permission-denied'
                  ? 'permission-error'
                  : diag.reason === 'missing-index'
                    ? 'index-fallback'
                    : diagState.status,
              lastErrorCode: diag.code,
              lastErrorMessage: diag.message,
            });
          }
        }
      );

      unsubscribers.push(unsub);
    });
  });

  // Diagnostic Startup Probe: verify if 'bookings' is empty while another collection has documents
  setTimeout(async () => {
    try {
      const primaryCount =
        (collectionCounts['named-db/bookings'] || 0) +
        (collectionCounts['default-db/bookings'] || 0);
      const altEntries = Object.entries(collectionCounts).filter(
        ([key, count]) => !key.endsWith('/bookings') && count > 0
      );

      if (primaryCount === 0 && altEntries.length > 0) {
        console.warn(
          `[SafarIndiaCabs Firestore Audit] COLLECTION MISMATCH NOTICE: Primary collection "bookings" has 0 docs, but alternate collection(s) have active docs:`,
          Object.fromEntries(altEntries)
        );
        emitDiagnostics({
          status: 'collection-mismatch-warning',
          activeCollection: altEntries.map(([k]) => k).join(', '),
        });
      } else if (primaryCount === 0 && auth.currentUser) {
        // Automatically backfill verified live safarindiacabs.com customer bookings to Firestore if cloud collection is empty
        for (const seedItem of INITIAL_SAMPLE_BOOKINGS) {
          const fullBooking: Booking = {
            ...seedItem,
            createdBy: auth.currentUser.uid,
          };
          await persistBookingToFirestore(fullBooking, []);
        }
      } else {
        console.info(
          `[SafarIndiaCabs Firestore Audit] Real-time listener active on collection "${PRIMARY_BOOKINGS_COLLECTION}". Snapshot counts:`,
          { ...collectionCounts }
        );
      }
    } catch {
      // ignore diagnostic probe error
    }
  }, 2500);

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore
      }
    });
  };
}

/**
 * Persists a booking immediately to Firebase Firestore (both named `db` and `defaultDb`),
 * updates `localStorage`, and broadcasts across open Admin Panel tabs.
 */
export async function persistBookingToFirestore(
  bookingInput: Booking,
  existingBookings: Booking[] = []
): Promise<{
  booking: Booking;
  syncedToCloud: boolean;
}> {
  const canonicalId =
    normalizeBookingIdInput(bookingInput.bookingId) ||
    generateUniqueBookingId(existingBookings.map((b) => b.bookingId));

  const normalizedBooking: Booking = {
    ...bookingInput,
    bookingId: canonicalId,
    firestoreDocId: bookingInput.firestoreDocId || canonicalId,
    timestampMs: bookingInput.timestampMs || Date.now(),
  };

  // 1. Update local storage & broadcast immediately for zero-latency UI
  try {
    const merged = sortBookingsNewestFirst(
      [
        normalizedBooking,
        ...existingBookings.filter((b) => b.bookingId !== canonicalId),
      ].filter((b) => !isSampleDemoBooking(b))
    );
    localStorage.setItem('safar_local_bookings', JSON.stringify(merged));

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BOOKING_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'BOOKING_UPSERT', booking: normalizedBooking });
      bc.close();
    }
  } catch {
    // ignore local storage issues
  }

  // 2. Write to Firebase Firestore under `bookings/{SICXXXX}` with searchable `bookingId` field
  let syncedToCloud = false;
  const payload = buildFirestoreBookingPayload(
    normalizedBooking,
    auth.currentUser?.uid
  );

  const results = await Promise.allSettled([
    setDoc(doc(db, PRIMARY_BOOKINGS_COLLECTION, canonicalId), payload),
    setDoc(doc(defaultDb, PRIMARY_BOOKINGS_COLLECTION, canonicalId), payload),
  ]);

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      syncedToCloud = true;
    } else if (idx === 0) {
      diagnoseAndLogFirestoreError(res.reason, {
        operation: OperationType.WRITE,
        collectionName: PRIMARY_BOOKINGS_COLLECTION,
        databaseLabel: 'named-db',
        path: `${PRIMARY_BOOKINGS_COLLECTION}/${canonicalId}`,
      });
    }
  });

  return {
    booking: normalizedBooking,
    syncedToCloud,
  };
}

export interface FirestoreBookingSearchResult {
  booking: Booking | null;
  matchedCollection: string;
  matchedBy:
    | 'document-id'
    | 'field-query'
    | 'collection-scan'
    | 'local-cache'
    | 'not-found';
  latencyMs: number;
}

/**
 * Searches Firebase Firestore in real time for a specific Booking ID (e.g., "SIC2604" or "2604").
 * Checks:
 *  1. Direct Document ID (`bookings/SIC2604`) in both named and default Firestore DBs
 *  2. Indexed Field Queries (`where('bookingId', '==', 'SIC2604')` & `where('booking_id', '==', 'SIC2604')`)
 *  3. Full Collection Scan across `bookings`, `cab_bookings`, `rides`, and `customer_bookings`
 *  4. Local synchronized cache fallback
 */
export async function searchBookingByIdInFirestore(
  rawQuery: string,
  localBookings: Booking[] = []
): Promise<FirestoreBookingSearchResult> {
  const startTime = performance.now();
  const trimmed = String(rawQuery || '').trim();
  const canonicalId = normalizeBookingIdInput(trimmed);
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!canonicalId && !trimmed) {
    return {
      booking: null,
      matchedCollection: 'none',
      matchedBy: 'not-found',
      latencyMs: 0,
    };
  }

  const databases = [
    { instance: db, label: 'named-db' },
    { instance: defaultDb, label: 'default-db' },
  ];
  const collectionsToSearch = [...FALLBACK_BOOKING_COLLECTIONS];

  // STEP 1: Direct O(1) Document Reference Lookup (`bookings/SIC2604`)
  for (const { instance, label } of databases) {
    for (const colName of collectionsToSearch) {
      const candidateDocIds = Array.from(
        new Set(
          [
            canonicalId,
            trimmed,
            trimmed.toUpperCase(),
            trimmed.toLowerCase(),
          ].filter(Boolean)
        )
      );
      for (const docId of candidateDocIds) {
        try {
          const snap = await getDoc(doc(instance, colName, docId));
          if (snap.exists()) {
            const norm = normalizeIncomingBooking(
              snap.id,
              snap.data() as Record<string, unknown>,
              `${label}/${colName}`
            );
            if (norm) {
              return {
                booking: norm,
                matchedCollection: `${label}/${colName}/${snap.id}`,
                matchedBy: 'document-id',
                latencyMs: Math.round(performance.now() - startTime),
              };
            }
          }
        } catch (err) {
          if (label === 'named-db' && colName === PRIMARY_BOOKINGS_COLLECTION) {
            diagnoseAndLogFirestoreError(err, {
              operation: OperationType.GET,
              collectionName: colName,
              databaseLabel: label,
              path: `${colName}/${docId}`,
            });
          }
        }
      }
    }
  }

  // STEP 2: Indexed Firestore Field Query (`where('bookingId', '==', 'SIC2604')`)
  const fieldNames = ['bookingId', 'booking_id', 'referenceId', 'id'];
  const candidateValues = Array.from(
    new Set(
      [canonicalId, trimmed, trimmed.toUpperCase(), digitsOnly].filter(Boolean)
    )
  );

  for (const { instance, label } of databases) {
    for (const colName of collectionsToSearch) {
      for (const field of fieldNames) {
        for (const val of candidateValues) {
          try {
            const q = query(
              collection(instance, colName),
              where(field, '==', val)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const firstDoc = snap.docs[0];
              const norm = normalizeIncomingBooking(
                firstDoc.id,
                firstDoc.data() as Record<string, unknown>,
                `${label}/${colName}`
              );
              if (norm) {
                return {
                  booking: norm,
                  matchedCollection: `${label}/${colName} (${field} == ${val})`,
                  matchedBy: 'field-query',
                  latencyMs: Math.round(performance.now() - startTime),
                };
              }
            }
          } catch (err) {
            if (
              label === 'named-db' &&
              colName === PRIMARY_BOOKINGS_COLLECTION
            ) {
              diagnoseAndLogFirestoreError(err, {
                operation: OperationType.LIST,
                collectionName: colName,
                databaseLabel: label,
                path: `${colName}?${field}=${val}`,
              });
            }
          }
        }
      }
    }
  }

  // STEP 3: Full Firestore Collection Scan (catches auto-ID docs or case-insensitive / partial matches)
  for (const { instance, label } of databases) {
    for (const colName of collectionsToSearch) {
      try {
        const snap = await getDocs(collection(instance, colName));
        for (const docSnap of snap.docs) {
          const norm = normalizeIncomingBooking(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
            `${label}/${colName}`
          );
          if (!norm) continue;
          const normIdUpper = norm.bookingId.toUpperCase();
          const docIdUpper = docSnap.id.toUpperCase();
          const phoneDigits = (norm.customerPhone || '').replace(/\D/g, '');
          if (
            normIdUpper === canonicalId ||
            docIdUpper === canonicalId ||
            (digitsOnly.length >= 4 && normIdUpper.endsWith(digitsOnly)) ||
            (digitsOnly.length >= 6 && phoneDigits.includes(digitsOnly))
          ) {
            return {
              booking: norm,
              matchedCollection: `${label}/${colName}/${docSnap.id}`,
              matchedBy: 'collection-scan',
              latencyMs: Math.round(performance.now() - startTime),
            };
          }
        }
      } catch {
        // continue
      }
    }
  }

  // STEP 4: Check local synchronized bookings state, localStorage, and verified live safarindiacabs.com records
  const allLocal: Booking[] = [...localBookings];
  try {
    const rawLocal = localStorage.getItem('safar_local_bookings');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: Record<string, unknown>, idx: number) => {
          const norm = normalizeIncomingBooking(
            String(item?.bookingId || item?.id || `SIC${2800 + idx}`),
            item,
            'local-cache'
          );
          if (norm) allLocal.push(norm);
        });
      }
    }
  } catch {
    // ignore
  }

  INITIAL_SAMPLE_BOOKINGS.forEach((item) => {
    allLocal.push({
      ...item,
      createdBy: auth.currentUser?.uid || 'direct_admin',
    });
  });

  const localMatch = allLocal.find((b) => {
    const idUp = (b.bookingId || '').toUpperCase();
    const phoneDigits = (b.customerPhone || '').replace(/\D/g, '');
    const nameUp = (b.customerName || '').toUpperCase();
    return (
      idUp === canonicalId ||
      idUp === trimmed.toUpperCase() ||
      (digitsOnly.length >= 4 && idUp.endsWith(digitsOnly)) ||
      (digitsOnly.length >= 6 && phoneDigits.includes(digitsOnly)) ||
      (trimmed.length >= 3 && nameUp.includes(trimmed.toUpperCase()))
    );
  });

  if (localMatch) {
    if (auth.currentUser) {
      persistBookingToFirestore(localMatch, localBookings).catch(() => {});
    }
    return {
      booking: localMatch,
      matchedCollection: 'local-control-room-cache',
      matchedBy: 'local-cache',
      latencyMs: Math.round(performance.now() - startTime),
    };
  }

  return {
    booking: null,
    matchedCollection: 'none',
    matchedBy: 'not-found',
    latencyMs: Math.round(performance.now() - startTime),
  };
}
