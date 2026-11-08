import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, defaultDb } from './firebase';
import {
  Booking,
  BLUEPRINT_CONSTRAINTS,
  OFFICIAL_EMAIL,
  clampNumber,
  isSampleDemoBooking,
  normalizeIncomingBooking,
  sanitizeString,
} from '../types/safar';

const SEQ_STORAGE_KEY = 'safar_booking_seq_counter';
export const BOOKING_BROADCAST_CHANNEL = 'safar_live_bookings_channel';

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
    // Extract highest numeric suffix from existing SICXXXX IDs
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
  const canonicalId = normalizeBookingIdInput(booking.bookingId) || generateUniqueBookingId();
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
  const routeSummary = sanitizeString(
    `${cleanPickup} → ${cleanDrop}`,
    260
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.pickupDate || '')
    ? booking.pickupDate
    : todayIso;
  const cleanTime = sanitizeString(
    booking.pickupTime || '08:30 AM',
    12
  );

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
    customerName: cleanCustomerName.length >= 2 ? cleanCustomerName : 'Safar Customer',
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
    paymentMode: booking.paymentMode === 'Full Paid' ? 'Full Paid' : '20% Advance',
    advancePaid,
    balanceAmount,
    status: booking.status || 'Pending',
    workflowStage: sanitizeString(booking.workflowStage || 'Requested', 40),
    bookingSource: sanitizeString(booking.bookingSource || 'Customer Android App', 40),
    specialInstructions: sanitizeString(booking.specialInstructions || '', 500),
    internalNotes: sanitizeString(booking.internalNotes || '', 500),
    driverName: sanitizeString(booking.driverName || '', BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME),
    driverPhone: sanitizeString(booking.driverPhone || '', BLUEPRINT_CONSTRAINTS.MAX_PHONE),
    vehicleNumber: sanitizeString(booking.vehicleNumber || '', BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER),
    vehicleModel: sanitizeString(booking.vehicleModel || '', BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL),
    invoiceNumber: sanitizeString(booking.invoiceNumber || '', BLUEPRINT_CONSTRAINTS.MAX_INVOICE_NUMBER),
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
  };

  // 1. Update local storage & broadcast immediately for zero-latency UI
  try {
    const merged = [
      normalizedBooking,
      ...existingBookings.filter((b) => b.bookingId !== canonicalId),
    ].filter((b) => !isSampleDemoBooking(b));
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
    setDoc(doc(db, 'bookings', canonicalId), payload),
    setDoc(doc(defaultDb, 'bookings', canonicalId), payload),
  ]);

  if (results.some((r) => r.status === 'fulfilled')) {
    syncedToCloud = true;
  }

  return {
    booking: normalizedBooking,
    syncedToCloud,
  };
}

export interface FirestoreBookingSearchResult {
  booking: Booking | null;
  matchedCollection: string;
  matchedBy: 'document-id' | 'field-query' | 'collection-scan' | 'local-cache' | 'not-found';
  latencyMs: number;
}

/**
 * Searches Firebase Firestore in real time for a specific Booking ID (e.g., "SIC2604" or "2604").
 * Checks:
 *  1. Direct Document ID (`bookings/SIC2604`) in both named and default Firestore DBs
 *  2. Indexed Field Queries (`where('bookingId', '==', 'SIC2604')` & `where('booking_id', '==', 'SIC2604')`)
 *  3. Full Collection Scan across `bookings`, `cab_bookings`, and `rides` (handles auto-IDs, case differences, or partial digits)
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
  const collectionsToSearch = ['bookings', 'cab_bookings', 'rides'];

  // STEP 1: Direct O(1) Document Reference Lookup (`bookings/SIC2604`)
  for (const { instance, label } of databases) {
    for (const colName of collectionsToSearch) {
      const candidateDocIds = Array.from(
        new Set([canonicalId, trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()].filter(Boolean))
      );
      for (const docId of candidateDocIds) {
        try {
          const snap = await getDoc(doc(instance, colName, docId));
          if (snap.exists()) {
            const norm = normalizeIncomingBooking(
              snap.id,
              snap.data() as Record<string, unknown>
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
        } catch {
          // continue to next lookup strategy
        }
      }
    }
  }

  // STEP 2: Indexed Firestore Field Query (`where('bookingId', '==', 'SIC2604')`)
  const fieldNames = ['bookingId', 'booking_id', 'referenceId', 'id'];
  const candidateValues = Array.from(
    new Set([canonicalId, trimmed, trimmed.toUpperCase(), digitsOnly].filter(Boolean))
  );

  for (const { instance, label } of databases) {
    for (const colName of collectionsToSearch) {
      for (const field of fieldNames) {
        for (const val of candidateValues) {
          try {
            const q = query(collection(instance, colName), where(field, '==', val));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const firstDoc = snap.docs[0];
              const norm = normalizeIncomingBooking(
                firstDoc.id,
                firstDoc.data() as Record<string, unknown>
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
          } catch {
            // continue
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
            docSnap.data() as Record<string, unknown>
          );
          if (!norm) continue;
          const normIdUpper = norm.bookingId.toUpperCase();
          const docIdUpper = docSnap.id.toUpperCase();
          if (
            normIdUpper === canonicalId ||
            docIdUpper === canonicalId ||
            (digitsOnly.length >= 4 && normIdUpper.endsWith(digitsOnly))
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

  // STEP 4: Check local synchronized bookings state & localStorage
  const allLocal = [...localBookings];
  try {
    const rawLocal = localStorage.getItem('safar_local_bookings');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: Record<string, unknown>, idx: number) => {
          const norm = normalizeIncomingBooking(
            String(item?.bookingId || item?.id || `SIC${2800 + idx}`),
            item
          );
          if (norm) allLocal.push(norm);
        });
      }
    }
  } catch {
    // ignore
  }

  const localMatch = allLocal.find((b) => {
    const idUp = (b.bookingId || '').toUpperCase();
    return (
      idUp === canonicalId ||
      idUp === trimmed.toUpperCase() ||
      (digitsOnly.length >= 4 && idUp.endsWith(digitsOnly))
    );
  });

  if (localMatch) {
    // Proactively backfill to Firestore if user is signed in
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
