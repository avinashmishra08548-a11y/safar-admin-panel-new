import React, { useState } from 'react';
import {
  Booking,
  OFFICIAL_COMPANY_NAME,
  OFFICIAL_GSTIN,
  OFFICIAL_HELPLINE,
  OFFICIAL_REGISTERED_ADDRESS,
  WHATSAPP_CLOUD_CONFIG,
  DEFAULT_GATEWAY_CONFIG,
  formatINR,
} from '../types/safar';
import {
  buildCustomerBookingConfirmationText,
  buildDriverNewPickupAlertText,
  sendWhatsAppCloudTextMessage,
  formatWhatsAppRecipient,
} from '../lib/pdfAndApis';
import {
  X,
  MessageSquare,
  Copy,
  CheckCircle2,
  Send,
  UserCheck,
  Car,
  Zap,
  CreditCard,
} from 'lucide-react';

interface WhatsAppDispatchModalProps {
  booking: Booking;
  onClose: () => void;
  onOpenAssignDriver: (booking: Booking) => void;
}

function buildPaymentCollectionReminderText(booking: Booking): string {
  return `*${OFFICIAL_COMPANY_NAME} — Official Payment & Settlement Notice*
Namaste *${booking.customerName}* ji,
Greetings from *${OFFICIAL_COMPANY_NAME}* (GSTIN: *${OFFICIAL_GSTIN}*).

*Booking Reference:* *#${booking.bookingId}*
*Journey Route:* ${booking.pickupCity} → ${booking.dropCity} (${booking.tripType})
*Travel Date:* ${booking.pickupDate} at ${booking.pickupTime}

*Payment Breakdown:*
• Total Invoice Amount (Incl. 5% GST): *${formatINR(booking.totalFare)}*
• Amount Received Online: *${formatINR(booking.advancePaid)}*
• *Balance Payable: ${formatINR(booking.balanceAmount)}*

*Official Payment Options:*
• Official Corporate UPI ID: *${DEFAULT_GATEWAY_CONFIG.merchantUpiId}*
• Helpline / Billing Support: *${OFFICIAL_HELPLINE}*
• Registered Office: ${OFFICIAL_REGISTERED_ADDRESS}

Thank you for choosing SafarIndiaCabs!`;
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  booking,
  onClose,
  onOpenAssignDriver,
}) => {
  const [recipientTab, setRecipientTab] = useState<
    'customer' | 'driver' | 'payment'
  >('customer');
  const [copied, setCopied] = useState(false);
  const [sendingCloudApi, setSendingCloudApi] = useState(false);
  const [cloudApiStatus, setCloudApiStatus] = useState<string | null>(null);

  const [customerMessage, setCustomerMessage] = useState(() =>
    buildCustomerBookingConfirmationText(booking)
  );
  const [driverMessage, setDriverMessage] = useState(() =>
    buildDriverNewPickupAlertText(booking)
  );
  const [paymentMessage, setPaymentMessage] = useState(() =>
    buildPaymentCollectionReminderText(booking)
  );

  const activeMessage =
    recipientTab === 'customer'
      ? customerMessage
      : recipientTab === 'driver'
      ? driverMessage
      : paymentMessage;

  const activePhone =
    recipientTab === 'driver'
      ? formatWhatsAppRecipient(booking.driverPhone || booking.customerPhone)
      : formatWhatsAppRecipient(booking.customerPhone);

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

  const handleSendViaMetaCloudApi = async () => {
    setSendingCloudApi(true);
    setCloudApiStatus(null);
    try {
      const res = await sendWhatsAppCloudTextMessage(
        activePhone,
        activeMessage
      );
      setCloudApiStatus(`${res.statusText} · ID: ${res.messageId}`);
    } finally {
      setSendingCloudApi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-8">
        {/* Silver + Slate Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-200/80 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                WhatsApp Cloud Dispatch & Payment Alerts · {booking.bookingId}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Meta Cloud API ID: {WHATSAPP_CLOUD_CONFIG.phoneNumberId} · Helpline: {OFFICIAL_HELPLINE}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 3-Tab Selector: Customer Confirmation | Chauffeur Duty Slip | Payment Reminder */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setRecipientTab('customer');
                setCloudApiStatus(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'customer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Confirmation</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipientTab('driver');
                setCloudApiStatus(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'driver'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-slate-700 dark:text-amber-400" />
              <span>Chauffeur Duty Slip</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipientTab('payment');
                setCloudApiStatus(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'payment'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              <span>Payment & UPI Reminder</span>
            </button>
          </div>

          {!booking.driverName && recipientTab !== 'payment' && (
            <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <span>
                Chauffeur is not yet assigned to {booking.bookingId}. Assign a chauffeur first to include vehicle and mobile details.
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAssignDriver(booking);
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shrink-0 cursor-pointer"
              >
                Assign Chauffeur
              </button>
            </div>
          )}

          {cloudApiStatus && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{cloudApiStatus}</span>
            </div>
          )}

          {/* Destination Phone Info */}
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>
              Recipient WhatsApp:{' '}
              <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                +{activePhone}
              </strong>
            </span>
            <span className="font-mono text-[11px]">
              GSTIN: {OFFICIAL_GSTIN}
            </span>
          </div>

          {/* Editable WhatsApp Template */}
          <textarea
            rows={12}
            value={activeMessage}
            onChange={(e) => {
              if (recipientTab === 'customer') {
                setCustomerMessage(e.target.value);
              } else if (recipientTab === 'driver') {
                setDriverMessage(e.target.value);
              } else {
                setPaymentMessage(e.target.value);
              }
            }}
            className="w-full p-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-500 leading-relaxed"
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Message</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={sendingCloudApi}
              onClick={handleSendViaMetaCloudApi}
              className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 disabled:opacity-50 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>
                {sendingCloudApi
                  ? 'Dispatching via Cloud API...'
                  : 'Send via Meta Cloud API'}
              </span>
            </button>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Open WhatsApp App</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
