import React, { useState, useEffect } from 'react';
import {
  Booking,
  CustomBillDraft,
  TripType,
  VehicleCategory,
  formatINR,
  OFFICIAL_COMPANY_NAME,
  OFFICIAL_LEGAL_NAME,
  OFFICIAL_GSTIN,
  OFFICIAL_SAC_CODE,
  OFFICIAL_PROPRIETOR,
  OFFICIAL_EMAIL,
  OFFICIAL_HELPLINE,
  OFFICIAL_REGISTERED_ADDRESS,
  OFFICIAL_ADMIN_PORTAL_URL,
  OFFICIAL_LOGO_URL,
  OFFICIAL_BANNER_URL,
} from '../types/safar';
import {
  bookingToStandardBillDraft,
  downloadBillAsPdf,
  shareBillPdfOnWhatsApp,
  getFormattedDigitalSignTimestamp,
} from '../lib/pdfAndApis';
import {
  Printer,
  Download,
  FileText,
  Stamp,
  PenTool,
  RefreshCw,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface BillGeneratorModuleProps {
  bookings: Booking[];
  initialBooking?: Booking | null;
  onShowToast: (msg: string) => void;
}

const DEFAULT_CUSTOM_BILL: CustomBillDraft = {
  invoiceNumber: 'INV-SIC-2026-2601',
  bookingId: 'SIC2601',
  invoiceDate: new Date().toISOString().slice(0, 10),
  customerName: 'Rajeshwari Sharma',
  customerPhone: '+91 98114 27650',
  customerEmail: 'rajeshwari.sharma@indiacorp.in',
  customerGstin: '07AABCI9281K1Z2',
  billingCompanyName: 'IndiaCorp Solutions Pvt. Ltd.',
  tripType: 'Round Trip Outstation',
  pickupCity: 'Connaught Place, New Delhi',
  dropCity: 'Tajganj, Agra (UP)',
  pickupDate: new Date().toISOString().slice(0, 10),
  pickupTime: '06:00 AM',
  vehicleCategory: 'Sedan',
  vehicleModel: 'Maruti Swift Dzire Tour S',
  vehicleNumber: 'DL 01 CAB 6812',
  driverName: 'Rajendra Prasad Verma',
  driverPhone: '+91 98182 74105',
  distanceKm: 460,
  tripDays: 2,
  perKmRate: 13,
  baseFare: 5980,
  driverAllowance: 700,
  stateTax: 550,
  nightCharges: 0,
  parkingTollExtra: 0,
  marketDiscount: 200,
  includeGst: true,
  gstPercentage: 5,
  advancePaid: 1586,
  paymentMode: '20% Advance',
  includeMohurStamp: true,
  includeDigitalSign: true,
  authorizedSignatoryName: OFFICIAL_PROPRIETOR,
  digitalSignatureTimestamp: getFormattedDigitalSignTimestamp(),
  notes: `Registered Office: ${OFFICIAL_REGISTERED_ADDRESS}. Helpline: ${OFFICIAL_HELPLINE}. Subject to Delhi Jurisdiction.`,
};

export const BillGeneratorModule: React.FC<BillGeneratorModuleProps> = ({
  bookings,
  initialBooking,
  onShowToast,
}) => {
  const [draft, setDraft] = useState<CustomBillDraft>(() =>
    initialBooking
      ? bookingToStandardBillDraft(initialBooking)
      : bookings[0]
      ? bookingToStandardBillDraft(bookings[0])
      : DEFAULT_CUSTOM_BILL
  );
  const [showBannerInBill, setShowBannerInBill] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sharingPdfWa, setSharingPdfWa] = useState(false);

  useEffect(() => {
    if (initialBooking) {
      setDraft(bookingToStandardBillDraft(initialBooking));
    }
  }, [initialBooking]);

  const updateField = <K extends keyof CustomBillDraft>(
    key: K,
    value: CustomBillDraft[K]
  ) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'distanceKm' || key === 'perKmRate') {
        next.baseFare = Math.round(
          Number(next.distanceKm) * Number(next.perKmRate)
        );
      }
      if (key === 'invoiceDate') {
        next.digitalSignatureTimestamp = getFormattedDigitalSignTimestamp(
          String(value)
        );
      }
      return next;
    });
  };

  const taxableAmount = Math.max(
    0,
    Number(draft.baseFare) +
      Number(draft.driverAllowance) +
      Number(draft.stateTax) +
      Number(draft.nightCharges) +
      Number(draft.parkingTollExtra) -
      Number(draft.marketDiscount)
  );
  const gstAmount = draft.includeGst
    ? Math.round(taxableAmount * (Number(draft.gstPercentage) / 100))
    : 0;
  const cgst = Math.round(gstAmount / 2);
  const sgst = gstAmount - cgst;
  const grandTotal = taxableAmount + gstAmount;
  const balanceDue = Math.max(0, grandTotal - Number(draft.advancePaid));

  const digitalSignTimestamp =
    draft.digitalSignatureTimestamp ||
    getFormattedDigitalSignTimestamp(draft.invoiceDate);

  const handleDownloadRealPdf = async () => {
    setGeneratingPdf(true);
    try {
      const fileName = await downloadBillAsPdf(draft);
      onShowToast(
        `Downloaded Official Digitally Signed GST Invoice PDF (${fileName}).`
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSharePdfOnWhatsApp = async () => {
    setSharingPdfWa(true);
    try {
      const res = await shareBillPdfOnWhatsApp(draft);
      if (res.sharedViaNativeFile) {
        onShowToast(
          `Shared real PDF file (${res.fileName}) directly to WhatsApp.`
        );
      } else {
        onShowToast(
          `Generated & downloaded real PDF (${res.fileName}) + sent WhatsApp Cloud API notification to ${draft.customerPhone}.`
        );
      }
    } finally {
      setSharingPdfWa(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
    onShowToast(`Opened Print / Save PDF dialog for ${draft.invoiceNumber}.`);
  };

  return (
    <section className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-display">
            Bill Generator (Rectangular Stamp & Digitally Signed PDF)
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Official {OFFICIAL_COMPANY_NAME} Tax Invoices · Proprietor:{' '}
            <strong>{OFFICIAL_PROPRIETOR}</strong> · GSTIN:{' '}
            <strong>{OFFICIAL_GSTIN}</strong> · SAC:{' '}
            <strong>{OFFICIAL_SAC_CODE}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generatingPdf}
            onClick={handleDownloadRealPdf}
            className="px-3.5 py-2.5 text-xs font-extrabold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-500" />
            <span>
              {generatingPdf ? 'Generating PDF...' : 'Download Real .PDF Bill'}
            </span>
          </button>

          <button
            type="button"
            disabled={sharingPdfWa}
            onClick={handleSharePdfOnWhatsApp}
            className="px-4 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {sharingPdfWa
                ? 'Preparing PDF File...'
                : 'Share PDF Bill on WhatsApp'}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left Editor Controls (5 cols) | Right Live Branded Invoice Preview (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Editor Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
          {/* Load from Existing Booking */}
          <div className="space-y-1.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <label
              htmlFor="select-booking-prefill"
              className="block text-xs font-extrabold text-slate-900 dark:text-slate-100"
            >
              Load Details from Existing Booking (or Edit Custom Below)
            </label>
            <div className="flex items-center gap-2">
              <select
                id="select-booking-prefill"
                value={draft.bookingId}
                onChange={(e) => {
                  const found = bookings.find(
                    (b) => b.bookingId === e.target.value
                  );
                  if (found) {
                    setDraft(bookingToStandardBillDraft(found));
                    onShowToast(
                      `Loaded bill details from booking ${found.bookingId} (${found.customerName}).`
                    );
                  }
                }}
                className="flex-1 px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {bookings.map((b) => (
                  <option key={b.bookingId} value={b.bookingId}>
                    {b.bookingId} — {b.customerName} ({b.pickupCity} →{' '}
                    {b.dropCity})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const randomNum = Math.floor(2700 + Math.random() * 900);
                  setDraft({
                    ...DEFAULT_CUSTOM_BILL,
                    bookingId: `SIC${randomNum}`,
                    invoiceNumber: `INV-SIC-2026-${randomNum}`,
                    digitalSignatureTimestamp: getFormattedDigitalSignTimestamp(),
                  });
                }}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Blank Bill</span>
              </button>
            </div>
          </div>

          {/* Rectangular Stamp & Digital Sign Controls */}
          <div className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
              Rectangular Stamp & &quot;Digitally Signed&quot; Format Controls
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  updateField('includeMohurStamp', !draft.includeMohurStamp)
                }
                className={`p-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeMohurStamp
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <Stamp className="w-4 h-4 shrink-0" />
                <span>Rect. Stamp: {draft.includeMohurStamp ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateField('includeDigitalSign', !draft.includeDigitalSign)
                }
                className={`p-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeDigitalSign
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <PenTool className="w-4 h-4 shrink-0" />
                <span>
                  Digitally Signed: {draft.includeDigitalSign ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => updateField('includeGst', !draft.includeGst)}
                className={`p-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeGst
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>5% GST Tax: {draft.includeGst ? 'Included' : 'Non-GST'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBannerInBill((b) => !b)}
                className={`p-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
                  showBannerInBill
                    ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 border-slate-900'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Wide Banner: {showBannerInBill ? 'Shown' : 'Compact'}</span>
              </button>
            </div>
          </div>

          {/* Customer & Invoice Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={draft.invoiceNumber}
                onChange={(e) => updateField('invoiceNumber', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={draft.invoiceDate}
                onChange={(e) => updateField('invoiceDate', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer / Traveller Name
              </label>
              <input
                type="text"
                value={draft.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer WhatsApp Mobile
              </label>
              <input
                type="text"
                value={draft.customerPhone}
                onChange={(e) => updateField('customerPhone', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Corporate / Company Name (Optional)
              </label>
              <input
                type="text"
                value={draft.billingCompanyName}
                onChange={(e) =>
                  updateField('billingCompanyName', e.target.value)
                }
                placeholder="e.g. TechSpire India Pvt Ltd"
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer GSTIN (Optional)
              </label>
              <input
                type="text"
                value={draft.customerGstin}
                onChange={(e) =>
                  updateField('customerGstin', e.target.value.toUpperCase())
                }
                placeholder="B2C / Unregistered"
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Route & Chauffeur Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pickup City
              </label>
              <input
                type="text"
                value={draft.pickupCity}
                onChange={(e) => updateField('pickupCity', e.target.value)}
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Drop City
              </label>
              <input
                type="text"
                value={draft.dropCity}
                onChange={(e) => updateField('dropCity', e.target.value)}
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Trip Category
              </label>
              <select
                value={draft.tripType}
                onChange={(e) =>
                  updateField('tripType', e.target.value as TripType)
                }
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Round Trip Outstation">
                  Round Trip Outstation
                </option>
                <option value="One Way Outstation">One Way Outstation</option>
                <option value="Local 8Hr/80Km">Local 8Hr/80Km</option>
                <option value="Airport Transfer">Airport Transfer</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cab Category
              </label>
              <select
                value={draft.vehicleCategory}
                onChange={(e) =>
                  updateField(
                    'vehicleCategory',
                    e.target.value as VehicleCategory
                  )
                }
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Innova Crysta">Innova Crysta</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                value={draft.vehicleNumber}
                onChange={(e) =>
                  updateField('vehicleNumber', e.target.value.toUpperCase())
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                value={draft.driverName}
                onChange={(e) => updateField('driverName', e.target.value)}
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Pricing & Charges Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Distance (KM)
              </label>
              <input
                type="number"
                value={draft.distanceKm}
                onChange={(e) =>
                  updateField('distanceKm', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rate / KM (₹)
              </label>
              <input
                type="number"
                value={draft.perKmRate}
                onChange={(e) =>
                  updateField('perKmRate', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Base Fare (₹)
              </label>
              <input
                type="number"
                value={draft.baseFare}
                onChange={(e) =>
                  updateField('baseFare', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Driver Bata (₹)
              </label>
              <input
                type="number"
                value={draft.driverAllowance}
                onChange={(e) =>
                  updateField('driverAllowance', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                State Tax/Toll (₹)
              </label>
              <input
                type="number"
                value={draft.stateTax}
                onChange={(e) =>
                  updateField('stateTax', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Parking/Extra (₹)
              </label>
              <input
                type="number"
                value={draft.parkingTollExtra}
                onChange={(e) =>
                  updateField('parkingTollExtra', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                value={draft.marketDiscount}
                onChange={(e) =>
                  updateField('marketDiscount', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Advance Paid (₹)
              </label>
              <input
                type="number"
                value={draft.advancePaid}
                onChange={(e) =>
                  updateField('advancePaid', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Proprietor / Signatory
              </label>
              <input
                type="text"
                value={draft.authorizedSignatoryName}
                onChange={(e) =>
                  updateField('authorizedSignatoryName', e.target.value)
                }
                className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Live Branded Invoice Paper Preview */}
        <div className="lg:col-span-7 bg-white border-2 border-slate-300 rounded-2xl shadow-md overflow-hidden text-slate-900">
          {showBannerInBill && (
            <div className="w-full h-36 overflow-hidden border-b border-slate-200">
              <img
                src={OFFICIAL_BANNER_URL}
                alt="Safar India Cabs Banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {/* Invoice Top Header with Official Company Details */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
              <div className="flex items-start gap-4">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="SafarIndiaCabs Official Logo"
                  className="w-20 h-20 object-contain rounded-xl border border-slate-200 p-1 bg-white shrink-0"
                />
                <div className="space-y-0.5">
                  <div className="text-xl font-extrabold text-slate-900 font-display tracking-tight">
                    {OFFICIAL_COMPANY_NAME}
                  </div>
                  <div className="text-xs font-extrabold text-amber-700">
                    Proprietor / Signatory: {OFFICIAL_PROPRIETOR} · GSTIN:{' '}
                    {OFFICIAL_GSTIN} · SAC: {OFFICIAL_SAC_CODE}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700">
                    Regd. Address: {OFFICIAL_REGISTERED_ADDRESS}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    Email: {OFFICIAL_EMAIL} · Helpline / WhatsApp:{' '}
                    {OFFICIAL_HELPLINE}
                  </div>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  {draft.includeGst
                    ? 'TAX INVOICE'
                    : 'OFFICIAL TRIP RECEIPT'}
                </div>
                <div className="text-lg font-extrabold font-mono text-slate-900 mt-0.5">
                  {draft.invoiceNumber}
                </div>
                <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                  Booking ID: #{draft.bookingId}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Date: {draft.invoiceDate}
                </div>
              </div>
            </div>

            {/* Customer & Journey Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                  Billed To (Traveller / Corporate)
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {draft.customerName}
                </div>
                {draft.billingCompanyName && (
                  <div className="font-bold text-slate-700">
                    {draft.billingCompanyName}
                  </div>
                )}
                <div className="font-mono font-semibold text-slate-700">
                  Mobile: {draft.customerPhone}
                </div>
                {draft.customerEmail && (
                  <div className="text-slate-600">{draft.customerEmail}</div>
                )}
                <div className="font-mono text-slate-900 pt-1">
                  Customer GSTIN:{' '}
                  <strong>{draft.customerGstin || 'B2C / Unregistered'}</strong>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                  Journey & Vehicle Particulars
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {draft.pickupCity} → {draft.dropCity}
                </div>
                <div className="font-semibold text-slate-700">
                  {draft.tripType} · {draft.pickupDate} ({draft.pickupTime})
                </div>
                <div className="font-mono font-bold text-slate-800">
                  Cab: {draft.vehicleCategory} ({draft.vehicleNumber})
                </div>
                <div className="font-mono text-slate-700">
                  Chauffeur: {draft.driverName} ({draft.driverPhone})
                </div>
              </div>
            </div>

            {/* Fare Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-2.5 px-4 text-left font-extrabold">
                      Description of Cab Service (SAC {OFFICIAL_SAC_CODE})
                    </th>
                    <th className="py-2.5 px-4 text-left font-extrabold">
                      Rate / Basis
                    </th>
                    <th className="py-2.5 px-4 text-right font-extrabold">
                      Amount (INR)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="py-2.5 px-4 font-bold">
                      Base Trip Fare ({draft.vehicleCategory})
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {draft.distanceKm} KM × ₹{draft.perKmRate}/KM (
                      {draft.tripDays}d)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {formatINR(draft.baseFare)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      Driver Allowance (DA / Daily Bata)
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {draft.tripDays} Day(s)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatINR(draft.driverAllowance)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      State Border Permit & Toll Tax
                    </td>
                    <td className="py-2.5 px-4">Inter-state permit</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatINR(draft.stateTax)}
                    </td>
                  </tr>
                  {draft.nightCharges > 0 && (
                    <tr>
                      <td className="py-2.5 px-4">Night Driving Allowance</td>
                      <td className="py-2.5 px-4">10 PM – 6 AM</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatINR(draft.nightCharges)}
                      </td>
                    </tr>
                  )}
                  {draft.parkingTollExtra > 0 && (
                    <tr>
                      <td className="py-2.5 px-4">
                        Airport Parking / Extra Toll / Waiting
                      </td>
                      <td className="py-2.5 px-4">Actuals</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatINR(draft.parkingTollExtra)}
                      </td>
                    </tr>
                  )}
                  {draft.marketDiscount > 0 && (
                    <tr className="bg-emerald-50/80 text-emerald-900">
                      <td className="py-2.5 px-4 font-bold">
                        Less: SafarIndiaCabs Promotional Market Discount
                      </td>
                      <td className="py-2.5 px-4">Instant Rebate</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        - {formatINR(draft.marketDiscount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold">
                    <td className="py-2.5 px-4">Net Taxable Value</td>
                    <td className="py-2.5 px-4 font-mono">Sub-Total</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatINR(taxableAmount)}
                    </td>
                  </tr>
                  {draft.includeGst && (
                    <tr>
                      <td className="py-2.5 px-4">
                        GST @ {draft.gstPercentage}% (CGST: {formatINR(cgst)} +
                        SGST: {formatINR(sgst)})
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        SAC {OFFICIAL_SAC_CODE}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatINR(gstAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-900 text-white font-extrabold text-sm">
                    <td className="py-3 px-4">TOTAL</td>
                    <td className="py-3 px-4 text-xs font-semibold text-amber-300 font-mono">
                      Adv: {formatINR(draft.advancePaid)} · Bal:{' '}
                      {formatINR(balanceDue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400 text-base">
                      INR {Math.round(grandTotal).toLocaleString('en-IN')}.00
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer: Left Company Details & Right Rectangular Stamp + Digitally Signed Block */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pt-4 border-t-2 border-slate-200">
              <div className="space-y-1 text-xs text-slate-700 max-w-sm">
                <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                  Official Company & Registered Office Details:
                </div>
                <div className="font-bold text-slate-900">
                  {OFFICIAL_COMPANY_NAME} (Proprietor: {OFFICIAL_PROPRIETOR})
                </div>
                <div className="font-mono text-[11px] font-bold text-slate-800">
                  GSTIN: {OFFICIAL_GSTIN} · SAC Code: {OFFICIAL_SAC_CODE}
                </div>
                <div className="text-[11px] leading-snug text-slate-700">
                  <strong>Address:</strong> {OFFICIAL_REGISTERED_ADDRESS}
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Email: {OFFICIAL_EMAIL} · Helpline: {OFFICIAL_HELPLINE}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Portal: {OFFICIAL_ADMIN_PORTAL_URL}
                </div>
              </div>

              {/* Rectangular Stamp & Rectangular "Digitally signed by" Block */}
              <div className="flex flex-col items-end gap-3 self-end sm:self-auto w-full sm:w-auto">
                {draft.includeMohurStamp && (
                  <div className="border-2 border-blue-900 px-3.5 py-2 rounded-xs bg-blue-50/40 text-blue-950 text-center w-full sm:w-72">
                    <div className="text-xs font-extrabold tracking-wider uppercase">
                      FOR {OFFICIAL_LEGAL_NAME}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-blue-900 mt-0.5">
                      GSTIN: {OFFICIAL_GSTIN} • NORTH DELHI 110084
                    </div>
                    <div className="text-[11px] font-extrabold text-blue-950 mt-1 border-t border-blue-900/30 pt-0.5 uppercase">
                      PROPRIETOR: {draft.authorizedSignatoryName || OFFICIAL_PROPRIETOR}
                    </div>
                  </div>
                )}

                {draft.includeDigitalSign && (
                  <div className="border border-slate-400 bg-white px-4 py-3 text-left text-slate-900 w-full sm:w-72 shadow-2xs">
                    <div className="text-[13px] leading-snug font-sans text-slate-900">
                      Digitally signed by {OFFICIAL_LEGAL_NAME}
                    </div>
                    <div className="text-[12px] leading-snug font-sans font-semibold text-slate-800">
                      PROPRIETOR:{' '}
                      {(
                        draft.authorizedSignatoryName || OFFICIAL_PROPRIETOR
                      ).toUpperCase()}{' '}
                      ({OFFICIAL_GSTIN})
                    </div>
                    <div className="text-[12px] leading-snug font-sans text-slate-900 mt-0.5">
                      Date: {digitalSignTimestamp}
                    </div>
                    <div className="text-[12px] leading-snug font-sans text-slate-900">
                      Location: IN
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
