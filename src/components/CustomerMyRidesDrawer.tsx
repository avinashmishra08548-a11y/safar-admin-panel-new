import React from 'react';
import { Booking, formatINR } from '../types/safar';
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
} from 'lucide-react';

interface CustomerMyRidesDrawerProps {
  booking: Booking;
  onClose: () => void;
  onOpenAssignDriver: (booking: Booking) => void;
  onMarkCompleted: (booking: Booking) => Promise<void>;
  onOpenInvoice: (booking: Booking) => void;
}

export const CustomerMyRidesDrawer: React.FC<CustomerMyRidesDrawerProps> = ({
  booking,
  onClose,
  onOpenAssignDriver,
  onMarkCompleted,
  onOpenInvoice,
}) => {
  const hasDriver = Boolean(booking.driverName && booking.vehicleNumber);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white border-l border-slate-200 max-w-lg w-full h-full flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-900" />
              <div>
                <h2 className="text-base font-bold text-slate-900 font-display">
                  safarindiacabs.com · Customer &apos;My Rides&apos; Mirror
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time view of what {booking.customerName} sees in the Customer App
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Simulated Customer App Card */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs text-slate-500">
                  {booking.tripType} · {booking.vehicleCategory}
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                  {booking.bookingId}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-900">
                  Status: {booking.status}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Total: {formatINR(booking.totalFare)}
                </div>
              </div>
            </div>

            {/* Route & Schedule */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500">Pickup → Destination</div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {booking.pickupCity} → {booking.dropCity}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500">Scheduled Pickup</div>
                  <div className="font-mono text-slate-900">
                    {booking.pickupDate} at {booking.pickupTime} · {booking.distanceKm} KM ({booking.tripDays}d)
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Chauffeur Section in Customer App */}
            <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  Assigned Chauffeur & Cab Details
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAssignDriver(booking)}
                  className="text-xs font-medium text-amber-700 hover:text-amber-800 underline cursor-pointer"
                >
                  {hasDriver ? 'Edit Driver' : 'Assign Driver Now'}
                </button>
              </div>

              {hasDriver ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-slate-500">Chauffeur Name</div>
                      <div className="font-semibold text-slate-900">{booking.driverName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-slate-500">Driver Mobile</div>
                      <div className="font-mono text-slate-900">{booking.driverPhone}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Car className="w-4 h-4 text-slate-700 shrink-0" />
                    <div>
                      <div className="text-slate-500">Vehicle Registration & Model</div>
                      <div className="font-mono font-semibold text-slate-900">
                        {booking.vehicleNumber} · {booking.vehicleModel || booking.vehicleCategory}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-xs text-slate-500 flex items-center justify-between">
                  <span>Chauffeur details will be shared prior to pickup.</span>
                  <button
                    type="button"
                    onClick={() => onOpenAssignDriver(booking)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign</span>
                  </button>
                </div>
              )}
            </div>

            {/* Payment & GST Invoice Section in Customer App */}
            <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Payment Plan ({booking.paymentMode})</span>
                <span className="font-mono text-slate-900">
                  Paid: {formatINR(booking.advancePaid)} · Balance: {formatINR(booking.balanceAmount)}
                </span>
              </div>

              {booking.status === 'Completed' && booking.invoiceReady ? (
                <button
                  type="button"
                  onClick={() => onOpenInvoice(booking)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    Download Final GST Invoice ({booking.invoiceNumber || 'SAC 996412'})
                  </span>
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="w-full py-2.5 px-3 bg-slate-100 text-slate-500 text-xs rounded-lg flex items-center justify-center gap-2">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Final GST Invoice unlocks automatically when trip is marked Completed</span>
                  </div>
                  {booking.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => onMarkCompleted(booking)}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Admin Action: Mark Trip Completed & Unlock GST Invoice</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
