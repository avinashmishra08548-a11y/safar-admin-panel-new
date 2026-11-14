import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus, clampNumber, formatINR } from '../types/safar';
import {
  X,
  Smartphone,
  MapPin,
  Calendar,
  UserCheck,
  Phone,
  Car,
  FileText,
  Lock,
  CheckCircle2,
  UserPlus,
  Database,
  ShieldCheck,
} from 'lucide-react';

interface CustomerMyRidesDrawerProps {
  booking: Booking;
  onClose: () => void;
  onOpenAssignDriver: (booking: Booking) => void;
  onMarkCompleted: (
    booking: Booking,
    finalTaxes?: { tollTax: number; stateTax: number }
  ) => Promise<void>;
  onOpenInvoice: (booking: Booking) => void;
}

export const CustomerMyRidesDrawer: React.FC<CustomerMyRidesDrawerProps> = ({
  booking,
  onClose,
  onOpenAssignDriver,
  onMarkCompleted,
  onOpenInvoice,
}) => {
  const [tollCharges, setTollCharges] = useState<number>(booking.tollTax ?? 0);
  const [stateTax, setStateTax] = useState<number>(booking.stateTax ?? 0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    setTollCharges(booking.tollTax ?? 0);
    setStateTax(booking.stateTax ?? 0);
  }, [booking.bookingId, booking.tollTax, booking.stateTax]);

  const hasDriver = Boolean(booking.driverName && booking.vehicleNumber);

  // Recalculate updated total with toll_charges and state_tax
  const cleanToll = clampNumber(Number(tollCharges) || 0, 0, 500000);
  const cleanState = clampNumber(Number(stateTax) || 0, 0, 500000);
  const taxable = Math.max(
    0,
    booking.baseFare +
      booking.driverAllowance +
      cleanToll +
      cleanState +
      (booking.nightCharges || 0) -
      (booking.marketDiscount || 0)
  );
  const gstAmount = Math.round(taxable * 0.05);
  const updatedTotalFare = taxable + gstAmount;
  const remainingBalance =
    booking.status === 'Completed'
      ? 0
      : Math.max(0, updatedTotalFare - booking.advancePaid);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 max-w-lg w-full h-full flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-900 dark:text-amber-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-display">
                    safarindiacabs.com · Customer &apos;My Rides&apos; Live Mirror
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-extrabold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 inline-flex items-center gap-1">
                    <Database className="w-2.5 h-2.5" />
                    SUPABASE LIVE
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  MakeMyTrip / CabBazaar style Booking Confirmed Summary & Post-Trip GST Invoice Unlock
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MakeMyTrip / CabBazaar Style Sleek Booking Confirmed Summary Card */}
          <div className="border-2 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
            {/* Top Status & Booking ID Ribbon */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Booking Confirmed Summary</span>
                </div>
                <div className="text-lg font-extrabold font-mono text-white mt-0.5">
                  {booking.bookingId}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                    booking.status === 'Completed'
                      ? 'bg-emerald-500 text-slate-950'
                      : booking.status === 'Driver Allotted' ||
                          booking.status === 'Active' ||
                          booking.status === 'Confirmed'
                        ? 'bg-blue-500 text-white'
                        : booking.status === 'Cancelled'
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {booking.status}
                </span>
                <div className="text-[11px] text-slate-300 font-mono mt-1">
                  {booking.tripType}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Route & Schedule Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-2.5 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Route (Pickup → Drop Location)
                    </div>
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                      {booking.pickupCity} → {booking.dropCity}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Pickup Date & Time
                    </div>
                    <div className="font-mono font-extrabold text-slate-900 dark:text-slate-100">
                      {booking.pickupDate} · {booking.pickupTime}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Car className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Cab Type & Distance
                    </div>
                    <div className="font-extrabold text-slate-900 dark:text-slate-100">
                      {booking.vehicleCategory} · {booking.distanceKm} KM
                    </div>
                  </div>
                </div>
              </div>

              {/* Advance Paid & Remaining Balance Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500">
                    Total Fare
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                    {formatINR(updatedTotalFare)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Advance Paid
                  </div>
                  <div className="font-mono font-extrabold text-sm text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {formatINR(booking.advancePaid)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    Remaining Balance
                  </div>
                  <div className="font-mono font-extrabold text-sm text-amber-900 dark:text-amber-300 mt-0.5">
                    {formatINR(remainingBalance)}
                  </div>
                </div>
              </div>

              {/* Assigned Chauffeur & Cab Details */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                    Assigned Chauffeur & Cab Details
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenAssignDriver(booking)}
                    className="text-xs font-extrabold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    {hasDriver ? 'Edit Driver' : 'Assign Driver Now'}
                  </button>
                </div>

                {hasDriver ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          Chauffeur Name
                        </div>
                        <div className="font-extrabold text-slate-900 dark:text-slate-100">
                          {booking.driverName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          Driver Mobile
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {booking.driverPhone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Car className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">
                          Vehicle Registration & Model
                        </div>
                        <div className="font-mono font-extrabold text-slate-900 dark:text-amber-400">
                          {booking.vehicleNumber} ·{' '}
                          {booking.vehicleModel || booking.vehicleCategory}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Chauffeur details will be shared prior to pickup.</span>
                    <button
                      type="button"
                      onClick={() => onOpenAssignDriver(booking)}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-lg font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Allot Driver</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Post-Trip Toll & State Tax Inputs + GST Invoice Unlock Section */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Post-Trip Toll & State Tax (`toll_charges` & `state_tax`)
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Toll Charges (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500000}
                      value={tollCharges}
                      onChange={(e) => setTollCharges(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      State Tax (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500000}
                      value={stateTax}
                      onChange={(e) => setStateTax(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {booking.status === 'Completed' ? (
                  <button
                    type="button"
                    onClick={() => onOpenInvoice(booking)}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <FileText className="w-4 h-4" />
                    <span>
                      Download Final GST Tax Invoice & PDF (
                      {booking.invoiceNumber || 'SAC 996412'})
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <div className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        GST Tax Invoice & PDF Download unlocks only when status becomes &apos;Completed&apos;
                      </span>
                    </div>
                    {booking.status !== ('Cancelled' as BookingStatus) && (
                      <button
                        type="button"
                        disabled={completing}
                        onClick={async () => {
                          setCompleting(true);
                          try {
                            await onMarkCompleted(booking, {
                              tollTax: cleanToll,
                              stateTax: cleanState,
                            });
                          } finally {
                            setCompleting(false);
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {completing
                            ? 'Updating Supabase...'
                            : `Mark Completed (Total ${formatINR(updatedTotalFare)}) & Unlock GST Invoice`}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
