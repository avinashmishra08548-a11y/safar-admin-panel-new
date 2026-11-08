import React, { useState } from 'react';
import {
  Booking,
  formatINR,
} from '../types/safar';
import {
  FirestoreBookingSearchResult,
  normalizeBookingIdInput,
  searchBookingByIdInFirestore,
} from '../lib/bookingSyncService';
import {
  Search,
  Database,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  Car,
  UserPlus,
  FileText,
  MessageSquare,
  Sliders,
  Stamp,
  X,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface BookingIdFirestoreSearchBarProps {
  bookings: Booking[];
  onBookingFoundAndSynced: (booking: Booking) => void;
  onOpenAssignDriver: (booking: Booking) => void;
  onOpenBookingDetail: (booking: Booking) => void;
  onOpenInvoice: (booking: Booking) => void;
  onOpenBillStudio: (booking: Booking) => void;
  onOpenWhatsAppDispatch: (booking: Booking) => void;
  onOpenSyncCustomerModal: () => void;
}

export const BookingIdFirestoreSearchBar: React.FC<
  BookingIdFirestoreSearchBarProps
> = ({
  bookings,
  onBookingFoundAndSynced,
  onOpenAssignDriver,
  onOpenBookingDetail,
  onOpenInvoice,
  onOpenBillStudio,
  onOpenWhatsAppDispatch,
  onOpenSyncCustomerModal,
}) => {
  const [bookingIdQuery, setBookingIdQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] =
    useState<FirestoreBookingSearchResult | null>(null);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');

  const handleExecuteFirestoreSearch = async (
    overrideId?: string,
    e?: React.FormEvent
  ) => {
    if (e) e.preventDefault();
    const targetQuery = (overrideId ?? bookingIdQuery).trim();
    if (!targetQuery) return;

    if (overrideId) {
      setBookingIdQuery(overrideId);
    }

    setSearching(true);
    setLastSearchedQuery(normalizeBookingIdInput(targetQuery) || targetQuery);
    try {
      const result = await searchBookingByIdInFirestore(targetQuery, bookings);
      setSearchResult(result);
      if (result.booking) {
        onBookingFoundAndSynced(result.booking);
      }
    } finally {
      setSearching(false);
    }
  };

  // Keep displayed booking in sync if admin updates driver/status while card is open
  const activeBooking = searchResult?.booking
    ? bookings.find((b) => b.bookingId === searchResult.booking?.bookingId) ||
      searchResult.booking
    : null;

  const hasAssignedDriver = Boolean(
    activeBooking?.driverName && activeBooking?.vehicleNumber
  );

  const formatTimestamp = (ts: unknown): string => {
    if (!ts) return 'Synced Live (Real-Time)';
    if (
      typeof ts === 'object' &&
      ts !== null &&
      'toDate' in ts &&
      typeof (ts as { toDate: () => Date }).toDate === 'function'
    ) {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('en-IN');
    }
    if (
      typeof ts === 'object' &&
      ts !== null &&
      'seconds' in ts &&
      typeof (ts as { seconds: number }).seconds === 'number'
    ) {
      return new Date(
        (ts as { seconds: number }).seconds * 1000
      ).toLocaleString('en-IN');
    }
    return String(ts);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Bar: Dedicated Firestore Booking ID Lookup */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <Database className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-display">
              Instant Firestore Booking ID Search & Verification (SICXXXX)
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-extrabold rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              LIVE FIREBASE SYNC
            </span>
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Type or paste any Customer App / Website Booking ID (e.g.,{' '}
            <span className="font-mono font-extrabold text-slate-900 dark:text-amber-400">
              SIC2604
            </span>
            ) to query Firebase Firestore directly and view full trip, fare split & chauffeur status
          </p>
        </div>

        <form
          onSubmit={(e) => handleExecuteFirestoreSearch(undefined, e)}
          className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto"
        >
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={bookingIdQuery}
              onChange={(e) => setBookingIdQuery(e.target.value.toUpperCase())}
              placeholder="Enter Booking ID (e.g. SIC2604)..."
              className="w-full pl-9 pr-8 py-2.5 text-xs font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:font-sans placeholder:font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
            {bookingIdQuery && (
              <button
                type="button"
                onClick={() => {
                  setBookingIdQuery('');
                  setSearchResult(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            {searching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
            ) : (
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>{searching ? 'Querying Firestore...' : 'Search Firestore'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSyncCustomerModal}
            className="px-3.5 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Sync New SICXXXX Ride</span>
          </button>
        </form>
      </div>

      {/* Quick Recent Booking ID Chips */}
      {bookings.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/80 dark:border-slate-800 text-[11px]">
          <span className="font-extrabold text-slate-500 dark:text-slate-400 mr-1">
            Quick Lookup IDs:
          </span>
          {bookings.slice(0, 8).map((b) => (
            <button
              key={b.bookingId}
              type="button"
              onClick={() => handleExecuteFirestoreSearch(b.bookingId)}
              className={`px-2.5 py-1 rounded-lg font-mono font-extrabold transition-colors cursor-pointer border ${
                activeBooking?.bookingId === b.bookingId
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-900 dark:border-amber-500'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-500'
              }`}
            >
              {b.bookingId} · {b.customerName.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Search Result Breakdown Panel */}
      {searchResult && !activeBooking && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white">
                No booking record found in Firestore for ID &ldquo;{lastSearchedQuery}&rdquo;
              </div>
              <p className="font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                Checked named & default Firestore databases across collections (`bookings`, `cab_bookings`, `rides`). If the customer sent their booking on WhatsApp or booked offline, click &ldquo;Sync This Booking Now&rdquo; to register {lastSearchedQuery} in Firestore.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSyncCustomerModal}
              className="px-3.5 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer whitespace-nowrap"
            >
              Sync {lastSearchedQuery} Now
            </button>
            <button
              type="button"
              onClick={() => setSearchResult(null)}
              className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {activeBooking && (
        <div className="rounded-2xl border-2 border-amber-500/80 bg-gradient-to-b from-slate-50 via-white to-slate-100/90 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-5 space-y-4 shadow-md">
          {/* Result Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-mono font-extrabold text-sm sm:text-base">
                {activeBooking.bookingId}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  activeBooking.status === 'Completed'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : activeBooking.status === 'Confirmed'
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300'
                    : activeBooking.status === 'Cancelled'
                    ? 'bg-red-100 text-red-900 dark:bg-red-950/80 dark:text-red-300'
                    : 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
                }`}
              >
                Status: {activeBooking.status}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                Stage: {activeBooking.workflowStage || 'Requested'}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Firestore Verified ({searchResult?.matchedBy || 'live-sync'} ·{' '}
                  {searchResult?.latencyMs ?? 12}ms)
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSearchResult(null)}
              className="px-2.5 py-1 text-xs font-extrabold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-200/70 dark:bg-slate-800 rounded-lg inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Breakdown</span>
            </button>
          </div>

          {/* 4-Column Comprehensive Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
            {/* Column 1: Customer Contact Info */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>1. Customer Contact Info</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {activeBooking.bookingSource || 'Customer App'}
                </span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {activeBooking.customerName}
              </div>
              <div className="font-mono font-extrabold text-slate-800 dark:text-amber-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>{activeBooking.customerPhone}</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 font-bold truncate">
                Email: {activeBooking.customerEmail || 'Not Provided'}
              </div>
              {activeBooking.customerGstin && (
                <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  GSTIN: {activeBooking.customerGstin}
                </div>
              )}
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                <Clock className="w-3 h-3" />
                <span>Booked: {formatTimestamp(activeBooking.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`tel:${activeBooking.customerPhone.replace(/\s+/g, '')}`}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-center"
                >
                  Call Customer
                </a>
                <a
                  href={`https://wa.me/${activeBooking.customerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-center"
                >
                  WhatsApp Chat
                </a>
              </div>
            </div>

            {/* Column 2: Trip & Route Details */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Trip & Route Breakdown
              </div>
              <div className="font-extrabold text-slate-900 dark:text-white flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  {activeBooking.pickupCity} → {activeBooking.dropCity}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 font-bold">Pickup Date</div>
                  <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                    {activeBooking.pickupDate}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 font-bold">Pickup Time</div>
                  <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                    {activeBooking.pickupTime}
                  </div>
                </div>
              </div>
              <div className="space-y-1 pt-1 font-bold text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Itinerary Type:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {activeBooking.tripType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Vehicle Class:</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-400">
                    {activeBooking.vehicleCategory}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Distance & Rate:</span>
                  <span className="font-mono font-extrabold">
                    {activeBooking.distanceKm} KM @ ₹{activeBooking.perKmRate}/KM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                    {activeBooking.tripDays === 1
                      ? '1 Day (Same Day Return)'
                      : `${activeBooking.tripDays} Days`}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: Itemized Fare Split */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Itemized Fare Split
              </div>
              <div className="space-y-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Base Cab Fare:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {formatINR(activeBooking.baseFare)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Driver Allowance (Bata):</span>
                  <span>{formatINR(activeBooking.driverAllowance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Highway Toll Tax:</span>
                  <span>{formatINR(activeBooking.tollTax || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>State Permit Tax:</span>
                  <span>{formatINR(activeBooking.stateTax)}</span>
                </div>
                {activeBooking.nightCharges > 0 && (
                  <div className="flex justify-between">
                    <span>Night Charges:</span>
                    <span>{formatINR(activeBooking.nightCharges)}</span>
                  </div>
                )}
                {activeBooking.marketDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Promotional Discount:</span>
                    <span>-{formatINR(activeBooking.marketDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (5% SAC 996412):</span>
                  <span>{formatINR(activeBooking.gstAmount)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between text-xs font-extrabold text-slate-900 dark:text-white">
                  <span>Total Booking Fare:</span>
                  <span>{formatINR(activeBooking.totalFare)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                  <span>Advance Paid ({activeBooking.paymentMode}):</span>
                  <span>{formatINR(activeBooking.advancePaid)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
                  <span>Driver Collect Balance:</span>
                  <span>{formatINR(activeBooking.balanceAmount)}</span>
                </div>
              </div>
            </div>

            {/* Column 4: Driver Assignment Status & Instant Dispatch Actions */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  4. Driver & Cab Assignment
                </div>
                {hasAssignedDriver ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-extrabold text-emerald-900 dark:text-emerald-300">
                      <Car className="w-3.5 h-3.5 shrink-0" />
                      <span>{activeBooking.driverName}</span>
                    </div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      Phone: {activeBooking.driverPhone}
                    </div>
                    <div className="font-mono font-extrabold text-amber-700 dark:text-amber-400">
                      Cab: {activeBooking.vehicleNumber} ({activeBooking.vehicleModel})
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-1">
                    <div className="font-extrabold text-amber-900 dark:text-amber-300">
                      Pending Driver Allotment
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      No chauffeur or vehicle plate has been allotted yet. Click below to assign a driver.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAssignDriver(activeBooking)}
                  className="col-span-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>
                    {hasAssignedDriver
                      ? 'Change Assigned Driver'
                      : 'Assign Driver & Vehicle'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBookingDetail(activeBooking)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Edit / Audit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWhatsAppDispatch(activeBooking)}
                  className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInvoice(activeBooking)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>GST Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBillStudio(activeBooking)}
                  className="py-1.5 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-300 font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Stamp className="w-3 h-3" />
                  <span>Custom Bill</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
