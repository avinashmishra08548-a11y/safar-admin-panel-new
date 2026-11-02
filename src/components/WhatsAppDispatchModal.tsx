import React, { useState } from 'react';
import {
  Booking,
  OFFICIAL_GSTIN,
  OFFICIAL_HELPLINE,
  WHATSAPP_CLOUD_CONFIG,
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
} from 'lucide-react';

interface WhatsAppDispatchModalProps {
  booking: Booking;
  onClose: () => void;
  onOpenAssignDriver: (booking: Booking) => void;
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
  const [sendingCloudApi, setSendingCloudApi] = useState(false);
  const [cloudApiStatus, setCloudApiStatus] = useState<string | null>(null);

  const [customerMessage, setCustomerMessage] = useState(() =>
    buildCustomerBookingConfirmationText(booking)
  );
  const [driverMessage, setDriverMessage] = useState(() =>
    buildDriverNewPickupAlertText(booking)
  );

  const activeMessage =
    recipientTab === 'customer' ? customerMessage : driverMessage;
  const activePhone =
    recipientTab === 'customer'
      ? formatWhatsAppRecipient(booking.customerPhone)
      : formatWhatsAppRecipient(booking.driverPhone || booking.customerPhone);

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
      const res = await sendWhatsAppCloudTextMessage(activePhone, activeMessage);
      setCloudApiStatus(`${res.statusText} · ID: ${res.messageId}`);
    } finally {
      setSendingCloudApi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white font-display">
                Meta WhatsApp Cloud API & 1-Tap Dispatch · {booking.bookingId}
              </h2>
              <p className="text-xs text-slate-300">
                Phone ID: {WHATSAPP_CLOUD_CONFIG.phoneNumberId} · Official Helpline: {OFFICIAL_HELPLINE}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Recipient Selector */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setRecipientTab('customer');
                setCloudApiStatus(null);
              }}
              className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'customer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Confirmation ({booking.customerName})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipientTab('driver');
                setCloudApiStatus(null);
              }}
              className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                recipientTab === 'driver'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Driver New Pickup Alert ({booking.driverName || 'Unassigned'})
              </span>
            </button>
          </div>

          {!booking.driverName && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3 text-xs font-bold text-amber-900 dark:text-amber-200">
              <span>
                Driver is not yet assigned to {booking.bookingId}. Assign a driver first to include cab & mobile details.
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAssignDriver(booking);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg shrink-0 cursor-pointer"
              >
                Assign Driver
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
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
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
            className="w-full p-3.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 leading-relaxed"
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={sendingCloudApi}
              onClick={handleSendViaMetaCloudApi}
              className="px-4 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>
                {sendingCloudApi
                  ? 'Sending via Cloud API...'
                  : 'Send via Meta Cloud API'}
              </span>
            </button>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                Open WhatsApp App (
                {recipientTab === 'customer' ? 'Customer' : 'Driver'})
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
