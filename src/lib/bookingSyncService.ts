import { supabase, SUPABASE_URL, SupabaseBookingRow } from './supabase';
import {
  Booking,
  BLUEPRINT_CONSTRAINTS,
  INITIAL_SAMPLE_BOOKINGS,
  clampNumber,
  isSampleDemoBooking,
  normalizeIncomingBooking,
  sanitizeString,
  sortBookingsNewestFirst,
} from '../types/safar';

const SEQ_STORAGE_KEY = 'safar_booking_seq_counter';
export const BOOKING_BROADCAST_CHANNEL = 'safar_live_bookings_channel';
export const PRIMARY_BOOKINGS_COLLECTION = 'public.bookings';

export interface FirestoreSyncDiagnosticState {
  status:
    | 'connecting'
    | 'live'
    | 'permission-error'
    | 'index-fallback'
    | 'collection-mismatch-warning';
  activeCollection: string;
  activeDatabase: string;
  totalCloudDocs: number;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  collectionCounts: Record<string, number>;
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

  let nextSeq = 2625;
  try {
    const savedSeq = Number(localStorage.getItem(SEQ_STORAGE_KEY) || '0');
    let maxExisting = 2624;
    existingSet.forEach((id) => {
      const m = id.match(/^SIC(\d{4,6})$/);
      if (m) {
        const val = Number(m[1]);
        if (val > maxExisting && val < 99999) {
          maxExisting = val;
        }
      }
    });
    nextSeq = Math.max(savedSeq + 1, maxExisting + 1, 2625);
  } catch {
    nextSeq = Math.floor(2625 + (Date.now() % 7000));
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
 * Builds the exact Supabase `bookings` table row payload matching the Customer Website & Admin schema:
 * `booking_id`, `customer_name`, `customer_phone`, `pickup_location`, `drop_location`,
 * `trip_type`, `vehicle_type`, `trip_date`, `trip_time`, `total_fare`, `advance_paid`,
 * `remaining_balance`, `toll_charges`, `state_tax`, `driver_name`, `driver_phone`,
 * `vehicle_number`, `status`, and `created_at`.
 */
export function buildSupabaseBookingRow(booking: Booking): SupabaseBookingRow {
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
  const cleanPickup = sanitizeString(
    booking.pickupCity || 'New Delhi',
    BLUEPRINT_CONSTRAINTS.MAX_CITY
  );
  const cleanDrop = sanitizeString(
    booking.dropCity || 'Outstation Destination',
    BLUEPRINT_CONSTRAINTS.MAX_CITY
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const cleanDate = /^\d{4}-\d{2}-\d{2}/.test(booking.pickupDate || '')
    ? booking.pickupDate.slice(0, 10)
    : todayIso;
  const cleanTime = sanitizeString(booking.pickupTime || '08:30 AM', 16);

  const tollCharges = clampNumber(booking.tollTax || 0, 0, 500000);
  const stateTax = clampNumber(booking.stateTax || 0, 0, 500000);
  const totalFare = clampNumber(booking.totalFare || 0, 0, 6000000);
  const advancePaid = clampNumber(booking.advancePaid || 0, 0, 6000000);
  const remainingBalance = clampNumber(
    booking.balanceAmount ?? Math.max(0, totalFare - advancePaid),
    0,
    6000000
  );

  const createdIso =
    typeof booking.createdAt === 'string' && booking.createdAt
      ? booking.createdAt
      : booking.timestampMs
        ? new Date(booking.timestampMs).toISOString()
        : new Date().toISOString();

  return {
    booking_id: canonicalId,
    customer_name:
      cleanCustomerName.length >= 2 ? cleanCustomerName : 'Safar Customer',
    customer_phone: cleanPhone.length >= 10 ? cleanPhone : '+91 9999999999',
    pickup_location: cleanPickup.length >= 2 ? cleanPickup : 'New Delhi',
    drop_location: cleanDrop.length >= 2 ? cleanDrop : 'Outstation',
    trip_type: booking.tripType || 'Round Trip Outstation',
    vehicle_type: booking.vehicleCategory || 'Sedan',
    trip_date: cleanDate,
    trip_time: cleanTime.length >= 4 ? cleanTime : '08:30 AM',
    total_fare: totalFare,
    advance_paid: advancePaid,
    remaining_balance: remainingBalance,
    toll_charges: tollCharges,
    state_tax: stateTax,
    driver_name: sanitizeString(
      booking.driverName || '',
      BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
    ),
    driver_phone: sanitizeString(
      booking.driverPhone || '',
      BLUEPRINT_CONSTRAINTS.MAX_PHONE
    ),
    vehicle_number: sanitizeString(
      booking.vehicleNumber || '',
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
    ),
    status: booking.status || 'Pending',
    created_at: createdIso,
  };
}

/**
 * Fetches all bookings from Supabase `bookings` table ordered by `created_at` descending.
 */
export async function fetchAllBookingsFromSupabase(): Promise<{
  bookings: Booking[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[SafarIndiaCabs Supabase] Fetch warning:', error.message);
      return { bookings: [], error: error.message };
    }

    const list: Booking[] = [];
    if (Array.isArray(data)) {
      data.forEach((row: Record<string, unknown>, idx: number) => {
        const docId = String(
          row.booking_id || row.id || `SIC${2625 + idx}`
        );
        const norm = normalizeIncomingBooking(
          docId,
          row,
          'supabase:public.bookings'
        );
        if (norm && !isSampleDemoBooking(norm)) {
          list.push(norm);
        }
      });
    }

    return {
      bookings: sortBookingsNewestFirst(list),
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[SafarIndiaCabs Supabase] Network/fetch error:', msg);
    return { bookings: [], error: msg };
  }
}

/**
 * Subscribes in real time to Supabase `public:bookings` (`postgres_changes`) and fetches initial
 * rows ordered by `created_at` descending so new customer bookings, driver allotments, toll/state tax
 * updates, and status changes reflect immediately without page reload.
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
  const liveBookingsById = new Map<string, Booking>();
  let isDisposed = false;

  let diagState: FirestoreSyncDiagnosticState = {
    status: 'connecting',
    activeCollection: PRIMARY_BOOKINGS_COLLECTION,
    activeDatabase: SUPABASE_URL.replace('https://', ''),
    totalCloudDocs: 0,
    lastSyncedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    collectionCounts: {},
  };

  const emitDiagnostics = (patch: Partial<FirestoreSyncDiagnosticState>) => {
    if (isDisposed) return;
    diagState = {
      ...diagState,
      ...patch,
      collectionCounts: {
        [PRIMARY_BOOKINGS_COLLECTION]: liveBookingsById.size,
      },
    };
    options.onDiagnosticChange?.(diagState);
  };

  const emitCurrentSnapshot = (
    source: string,
    addedBookings: Booking[],
    removedBookingIds: string[],
    isInitialLoad: boolean
  ) => {
    if (isDisposed) return;
    const sorted = sortBookingsNewestFirst(
      Array.from(liveBookingsById.values())
    );
    emitDiagnostics({
      status: 'live',
      totalCloudDocs: sorted.length,
      lastSyncedAt: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    options.onBookingsSnapshot(sorted, {
      source,
      addedBookings,
      removedBookingIds,
      isInitialLoad,
    });
  };

  // 1. Initial Fetch from Supabase `bookings` ordered by `created_at` descending
  (async () => {
    const { bookings: initialRows, error } =
      await fetchAllBookingsFromSupabase();

    if (isDisposed) return;

    if (error) {
      emitDiagnostics({
        status: 'permission-error',
        lastErrorCode: 'SUPABASE_QUERY_ERROR',
        lastErrorMessage: error,
      });
      return;
    }

    // If Supabase `bookings` table is currently empty, seed initial verified bookings so Admin Dashboard never shows 0
    if (initialRows.length === 0) {
      for (const seed of INITIAL_SAMPLE_BOOKINGS) {
        const fullSeed: Booking = {
          ...seed,
          createdBy: 'supabase_seed',
        };
        liveBookingsById.set(fullSeed.bookingId, fullSeed);
        persistBookingToSupabase(fullSeed, []).catch(() => {});
      }
      emitCurrentSnapshot('supabase-initial-seed', [], [], true);
    } else {
      initialRows.forEach((b) => {
        liveBookingsById.set(b.bookingId, b);
      });
      emitCurrentSnapshot('supabase-initial-fetch', [], [], true);
    }
  })();

  // 2. Real-time Subscription to `postgres_changes` on `public:bookings`
  const channel = supabase
    .channel('public:bookings')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
      },
      (payload) => {
        if (isDisposed) return;

        const eventType = payload.eventType;
        if (eventType === 'DELETE') {
          const oldRecord = (payload.old || {}) as Record<string, unknown>;
          const rawOldId = String(
            oldRecord.booking_id || oldRecord.bookingId || oldRecord.id || ''
          );
          const canonicalOldId = normalizeBookingIdInput(rawOldId) || rawOldId;
          let removedId = canonicalOldId;

          if (liveBookingsById.has(canonicalOldId)) {
            liveBookingsById.delete(canonicalOldId);
          } else {
            // Also check by row `id` in case Supabase DELETE payload only includes primary key `id`
            liveBookingsById.forEach((val, key) => {
              if (String(val.firestoreDocId) === String(oldRecord.id)) {
                removedId = key;
                liveBookingsById.delete(key);
              }
            });
          }

          emitCurrentSnapshot(
            'supabase-realtime-delete',
            [],
            removedId ? [removedId] : [],
            false
          );
          return;
        }

        const newRecord = (payload.new || {}) as Record<string, unknown>;
        const docId = String(
          newRecord.booking_id || newRecord.bookingId || newRecord.id || ''
        );
        const normalized = normalizeIncomingBooking(
          docId,
          newRecord,
          'supabase:public.bookings'
        );

        if (!normalized || isSampleDemoBooking(normalized)) return;

        const isNewInsert =
          eventType === 'INSERT' && !liveBookingsById.has(normalized.bookingId);
        liveBookingsById.set(normalized.bookingId, normalized);

        emitCurrentSnapshot(
          `supabase-realtime-${eventType.toLowerCase()}`,
          isNewInsert ? [normalized] : [],
          [],
          false
        );
      }
    )
    .subscribe((status, err) => {
      if (isDisposed) return;
      if (status === 'SUBSCRIBED') {
        emitDiagnostics({
          status: 'live',
          lastSyncedAt: new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        emitDiagnostics({
          lastErrorCode: status,
          lastErrorMessage: err?.message || `Realtime channel ${status}`,
        });
      }
    });

  return () => {
    isDisposed = true;
    try {
      supabase.removeChannel(channel);
    } catch {
      // ignore cleanup errors
    }
  };
}

/**
 * Persists a booking (insert or update) to Supabase `bookings` table,
 * updates `localStorage`, and broadcasts across open Admin & Customer tabs.
 */
export async function persistBookingToSupabase(
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

  // 2. Sync to Supabase `bookings` table
  let syncedToCloud = false;
  const rowPayload = buildSupabaseBookingRow(normalizedBooking);

  try {
    // Check if booking_id already exists in Supabase
    const { data: existingRows, error: checkErr } = await supabase
      .from('bookings')
      .select('booking_id')
      .eq('booking_id', canonicalId)
      .limit(1);

    if (!checkErr && Array.isArray(existingRows) && existingRows.length > 0) {
      const { created_at: _omitCreatedAt, ...updateFields } = rowPayload;
      const { error: updateErr } = await supabase
        .from('bookings')
        .update(updateFields)
        .eq('booking_id', canonicalId);

      if (!updateErr) {
        syncedToCloud = true;
      } else {
        console.warn(
          '[SafarIndiaCabs Supabase] Update warning:',
          updateErr.message
        );
      }
    } else {
      const { error: insertErr } = await supabase
        .from('bookings')
        .insert([rowPayload]);

      if (!insertErr) {
        syncedToCloud = true;
      } else {
        // Fallback to update in case of unique constraint collision
        const { created_at: _omitCreatedAt, ...updateFields } = rowPayload;
        const { error: retryUpdateErr } = await supabase
          .from('bookings')
          .update(updateFields)
          .eq('booking_id', canonicalId);
        if (!retryUpdateErr) {
          syncedToCloud = true;
        } else {
          console.warn(
            '[SafarIndiaCabs Supabase] Insert/Upsert warning:',
            insertErr.message
          );
        }
      }
    }
  } catch (err) {
    console.warn('[SafarIndiaCabs Supabase] Persist error:', err);
  }

  return {
    booking: normalizedBooking,
    syncedToCloud,
  };
}

// Alias for existing callers
export const persistBookingToFirestore = persistBookingToSupabase;

/**
 * Deletes a booking from Supabase `bookings` table by `booking_id`.
 */
export async function deleteBookingFromSupabase(
  bookingId: string
): Promise<boolean> {
  const canonicalId = normalizeBookingIdInput(bookingId) || bookingId;
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('booking_id', canonicalId);
    return !error;
  } catch {
    return false;
  }
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
 * Queries the Supabase `bookings` table directly for a Booking ID (`SICXXXX`),
 * Customer Phone, or Customer Name.
 */
export async function searchBookingByIdInSupabase(
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

  // STEP 1: Direct exact match on `booking_id` in Supabase `bookings` table
  try {
    const candidateIds = Array.from(
      new Set([canonicalId, trimmed, trimmed.toUpperCase()].filter(Boolean))
    );
    const { data: exactRows, error: exactErr } = await supabase
      .from('bookings')
      .select('*')
      .in('booking_id', candidateIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!exactErr && Array.isArray(exactRows) && exactRows.length > 0) {
      const row = exactRows[0] as Record<string, unknown>;
      const norm = normalizeIncomingBooking(
        String(row.booking_id || canonicalId),
        row,
        'supabase:public.bookings'
      );
      if (norm) {
        return {
          booking: norm,
          matchedCollection: `supabase:public.bookings (${norm.bookingId})`,
          matchedBy: 'document-id',
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
    }
  } catch {
    // continue to flexible query
  }

  // STEP 2: Case-insensitive / partial search on `booking_id`, `customer_phone`, or `customer_name` in Supabase
  try {
    const searchPattern = `%${trimmed}%`;
    const idPattern = canonicalId ? `%${canonicalId}%` : searchPattern;
    const { data: matchedRows, error: searchErr } = await supabase
      .from('bookings')
      .select('*')
      .or(
        `booking_id.ilike.${idPattern},customer_phone.ilike.${searchPattern},customer_name.ilike.${searchPattern}`
      )
      .order('created_at', { ascending: false })
      .limit(5);

    if (!searchErr && Array.isArray(matchedRows) && matchedRows.length > 0) {
      const row = matchedRows[0] as Record<string, unknown>;
      const norm = normalizeIncomingBooking(
        String(row.booking_id || canonicalId),
        row,
        'supabase:public.bookings'
      );
      if (norm) {
        return {
          booking: norm,
          matchedCollection: `supabase:public.bookings (${norm.bookingId})`,
          matchedBy: 'field-query',
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
    }
  } catch {
    // continue to local fallback
  }

  // STEP 3: Check local synchronized bookings state & sync to Supabase if found
  const allLocal: Booking[] = [...localBookings];
  try {
    const rawLocal = localStorage.getItem('safar_local_bookings');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: Record<string, unknown>, idx: number) => {
          const norm = normalizeIncomingBooking(
            String(item?.bookingId || item?.booking_id || `SIC${2800 + idx}`),
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
    persistBookingToSupabase(localMatch, localBookings).catch(() => {});
    return {
      booking: localMatch,
      matchedCollection: 'supabase-local-sync-cache',
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

export const searchBookingByIdInFirestore = searchBookingByIdInSupabase;
