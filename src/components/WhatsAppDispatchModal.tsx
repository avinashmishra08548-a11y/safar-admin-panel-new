import React, { useState } from 'react';
import { Booking, formatINR, OFFICIAL_GSTIN } from '../types/safar';
import {
  X,
  MessageSquare,
  Copy,
  CheckCircle2,
  Send,
  UserCheck,
  Car,
} from 'lucide-react';

interface WhatsAppDispatchModalProps {
  booking: Booking;
  onClose: () => void;
  onOpenAssignDriver: (booking: Booking) => void;
}

function cleanPhoneForWa(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits || '919811427650';
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  booking,
  onClose,
  onOpenAssignDriver,
}) => {
  const [recipientTab, setRecipientTab] = useState<'customer' | 'driver'>(
    'customer'
  );
  const [copied, setCopied] = useState(false);

  const customerDefaultMsg = `*Safar India Cabs (A1 Cab Services • N. India)*
Namaste *${booking.customerName}* ji,
Your cab booking *#${booking.bookingId}* is *${booking.status.toUpperCase()}*!

*Trip Details:*
• Route: ${booking.pickupCity} → ${booking.dropCity} (${booking.tripType})
• Pickup: ${booking.pickupDate} at ${booking.pickupTime}
• Cab Class: ${booking.vehicleCategory} (${booking.vehicleModel || 'AC Cab'})

*Chauffeur & Vehicle Details:*
• Driver Name: *${booking.driverName || 'Allotting Shortly'}*
• Driver Mobile: *${booking.driverPhone || 'Will be shared 2 hrs before trip'}*
• Vehicle No: *${booking.vehicleNumber || 'Pending Allotment'}*

*Fare & Payment Summary:*
• Total Fare (Incl. 5% GST): *${formatINR(booking.totalFare)}*
• Advance Paid: *${formatINR(booking.advancePaid)}* (${booking.paymentMode})
• Balance Payable to Driver: *${formatINR(booking.balanceAmount)}*

Official GSTIN: ${OFFICIAL_GSTIN}
Website: https://safarindiacabs.com
_Your Journey, Our Priority!_`;

  const driverDefaultMsg = `*SAFAR INDIA CABS — DRIVER DUTY SLIP*
Booking ID: *#${booking.bookingId}*

*Customer Details:*
• Passenger Name: *${booking.customerName}*
• Customer Mobile: *${booking.customerPhone}*

*Pickup & Route:*
• Pickup Location: ${booking.pickupCity}
• Drop Location: ${booking.dropCity}
• Date & Time: *${booking.pickupDate} at ${booking.pickupTime}*
• Trip Type: ${booking.tripType} (${booking.distanceKm} KM / ${booking.tripDays} Day)
• Allotted Cab: ${booking.vehicleNumber || 'Assign Vehicle'} (${booking.vehicleCategory})

*Collection Instructions:*
• Total Bill: ${formatINR(booking.totalFare)}
• Advance Received Online: ${formatINR(booking.advancePaid)}
• *Collect Balance from Customer: ${formatINR(booking.balanceAmount)}*

Please reach pickup location 15 mins before time in clean uniform.
Dispatch Control Room · SafarIndiaCabs`;

  const [customerMessage, setCustomerMessage] = useState(customerDefaultMsg);
  const [driverMessage, setDriverMessage] = useState(driverDefaultMsg);

  const activeMessage =
    recipientTab === 'customer' ? customerMessage : driverMessage;
  const activePhone =
    recipientTab === 'customer'
      ? cleanPhoneForWa(booking.customerPhone)
      : cleanPhoneForWa(booking.driverPhone || booking.customerPhone);

  const waHref = `https://wa.me/${activePhone}?text=${encodeURIComponent(
    activeMessage
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full overflow-hidden shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">
                1-Tap WhatsApp Dispatch Workflow · {booking.bookingId}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send instant cab & chauffeur confirmation to Customer or Duty Slip to Driver
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Recipient Selector */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setRecipientTab('customer')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'customer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Alert ({booking.customerName})</span>
            </button>

            <button
              type="button"
              onClick={() => setRecipientTab('driver')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'driver'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Driver Duty Slip ({booking.driverName || 'Unassigned'})
              </span>
            </button>
          </div>

          {!booking.driverName && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <span>
                Driver is not yet assigned to {booking.bookingId}. Assign a driver first to include cab & mobile details.
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAssignDriver(booking);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-md shrink-0 cursor-pointer"
              >
                Assign Driver
              </button>
            </div>
          )}

          {/* Destination Phone Info */}
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Target WhatsApp Number:{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-100">
                +{activePhone}
              </strong>
            </span>
            <span className="font-mono text-[11px]">
              GSTIN: {OFFICIAL_GSTIN}
            </span>
          </div>

          {/* Editable WhatsApp Template */}
          <textarea
            rows={13}
            value={activeMessage}
            onChange={(e) =>
              recipientTab === 'customer'
                ? setCustomerMessage(e.target.value)
                : setDriverMessage(e.target.value)
            }
            className="w-full p-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Copied Message!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy WhatsApp Text</span>
                </>
              )}
            </button>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                1-Tap Send on WhatsApp (
                {recipientTab === 'customer' ? 'Customer' : 'Driver'})
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
