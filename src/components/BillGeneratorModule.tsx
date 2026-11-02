import React, { useState, useEffect } from 'react';
import {
  Booking,
  CustomBillDraft,
  TripType,
  VehicleCategory,
  PaymentMode,
  formatINR,
  OFFICIAL_GSTIN,
  OFFICIAL_LOGO_URL,
  OFFICIAL_BANNER_URL,
} from '../types/safar';
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

function bookingToBillDraft(b: Booking): CustomBillDraft {
  return {
    invoiceNumber:
      b.invoiceNumber || `INV-SIC-2026-${b.bookingId.replace('SIC', '')}`,
    bookingId: b.bookingId,
    invoiceDate: b.pickupDate || new Date().toISOString().slice(0, 10),
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    customerEmail: b.customerEmail,
    customerGstin: b.customerGstin || '',
    billingCompanyName: b.customerGstin
      ? `${b.customerName} Corporate A/C`
      : '',
    tripType: b.tripType,
    pickupCity: b.pickupCity,
    dropCity: b.dropCity,
    pickupDate: b.pickupDate,
    pickupTime: b.pickupTime,
    vehicleCategory: b.vehicleCategory,
    vehicleModel: b.vehicleModel || `${b.vehicleCategory} AC`,
    vehicleNumber: b.vehicleNumber || 'DL 01 CAB 6812',
    driverName: b.driverName || 'Rajendra Prasad Verma',
    driverPhone: b.driverPhone || '+91 98182 74105',
    distanceKm: b.distanceKm,
    tripDays: b.tripDays,
    perKmRate: b.perKmRate,
    baseFare: b.baseFare,
    driverAllowance: b.driverAllowance,
    stateTax: b.stateTax,
    nightCharges: b.nightCharges,
    parkingTollExtra: 0,
    marketDiscount: b.marketDiscount,
    includeGst: true,
    gstPercentage: 5,
    advancePaid: b.advancePaid,
    paymentMode: b.paymentMode,
    includeMohurStamp: true,
    includeDigitalSign: true,
    authorizedSignatoryName: 'Avinash Mishra',
    notes:
      'Thank you for travelling with Safar India Cabs (A1 Cab Services • N. India). Subject to Delhi NCR Jurisdiction.',
  };
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
  authorizedSignatoryName: 'Avinash Mishra',
  notes:
    'Thank you for travelling with Safar India Cabs (A1 Cab Services • N. India). Subject to Delhi NCR Jurisdiction.',
};

export const BillGeneratorModule: React.FC<BillGeneratorModuleProps> = ({
  bookings,
  initialBooking,
  onShowToast,
}) => {
  const [draft, setDraft] = useState<CustomBillDraft>(() =>
    initialBooking
      ? bookingToBillDraft(initialBooking)
      : bookings[0]
      ? bookingToBillDraft(bookings[0])
      : DEFAULT_CUSTOM_BILL
  );
  const [showBannerInBill, setShowBannerInBill] = useState(false);

  useEffect(() => {
    if (initialBooking) {
      setDraft(bookingToBillDraft(initialBooking));
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

  const handlePrintPdf = () => {
    window.print();
    onShowToast(`Opened Print / Save PDF dialog for ${draft.invoiceNumber}.`);
  };

  const handleDownloadStandaloneHtml = () => {
    const logoUrl = `${window.location.origin}${OFFICIAL_LOGO_URL}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${draft.invoiceNumber} - Safar India Cabs Official Bill</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 32px; max-width: 840px; margin: 0 auto; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand img { width: 76px; height: 76px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 10px; padding: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 22px; font-size: 13px; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
  th { background: #f8fafc; font-weight: 700; }
  .num { text-align: right; font-family: monospace; }
  .total-row td { font-weight: 700; font-size: 15px; background: #0f172a; color: #fff; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 18px; border-top: 1px dashed #94a3b8; margin-top: 24px; }
  .stamp { border: 2px double #1e3a8a; color: #1e3a8a; border-radius: 999px; padding: 10px 18px; text-align: center; font-weight: 700; font-size: 11px; display: inline-block; transform: rotate(-6deg); }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="SafarIndiaCabs Logo" />
      <div>
        <h1 style="margin:0;font-size:22px;">SafarIndiaCabs · A1 Cab Services • N. India</h1>
        <p style="margin:3px 0 0;font-size:12px;color:#475569;">Your Journey, Our Priority · safarindiacabs.com</p>
        <p style="margin:4px 0 0;font-size:12px;font-family:monospace;font-weight:700;">GSTIN: ${OFFICIAL_GSTIN} · SAC Code: 996412</p>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;font-weight:700;color:#475569;">${
        draft.includeGst ? 'TAX INVOICE (ORIGINAL)' : 'OFFICIAL TRIP RECEIPT'
      }</div>
      <div style="font-size:17px;font-weight:700;font-family:monospace;margin-top:4px;">${
        draft.invoiceNumber
      }</div>
      <div style="font-size:12px;color:#475569;">Booking ID: ${
        draft.bookingId
      } · Date: ${draft.invoiceDate}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <strong>Billed To Customer / Corporate:</strong><br/>
      ${draft.customerName}${
      draft.billingCompanyName ? ` (${draft.billingCompanyName})` : ''
    }<br/>
      Phone: ${draft.customerPhone}<br/>
      Email: ${draft.customerEmail}<br/>
      Customer GSTIN: ${draft.customerGstin || 'Unregistered / B2C'}
    </div>
    <div>
      <strong>Journey & Vehicle Particulars:</strong><br/>
      Route: ${draft.pickupCity} → ${draft.dropCity} (${draft.tripType})<br/>
      Pickup: ${draft.pickupDate} at ${draft.pickupTime}<br/>
      Cab: ${draft.vehicleCategory} (${draft.vehicleModel}) · Plate: ${
      draft.vehicleNumber
    }<br/>
      Chauffeur: ${draft.driverName} (${draft.driverPhone})
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Service Description (SAC 996412)</th>
        <th>Calculation / Basis</th>
        <th class="num">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Base Trip Distance Fare (${draft.vehicleCategory})</td>
        <td>${draft.distanceKm} KM × ₹${draft.perKmRate}/KM (${
      draft.tripDays
    } Day)</td>
        <td class="num">${formatINR(draft.baseFare)}</td>
      </tr>
      <tr>
        <td>Chauffeur Daily Allowance (DA / Bata)</td>
        <td>${draft.tripDays} Day(s)</td>
        <td class="num">${formatINR(draft.driverAllowance)}</td>
      </tr>
      <tr>
        <td>State Border Permit & Toll Charges</td>
        <td>Inter-State Allocation</td>
        <td class="num">${formatINR(draft.stateTax)}</td>
      </tr>
      <tr>
        <td>Night Driving Allowance</td>
        <td>Night Window</td>
        <td class="num">${formatINR(draft.nightCharges)}</td>
      </tr>
      ${
        draft.parkingTollExtra > 0
          ? `<tr>
        <td>Airport Parking / Extra Toll / Waiting</td>
        <td>Actuals</td>
        <td class="num">${formatINR(draft.parkingTollExtra)}</td>
      </tr>`
          : ''
      }
      ${
        draft.marketDiscount > 0
          ? `<tr>
        <td>Less: SafarIndiaCabs Promotional Market Discount</td>
        <td>Rebate</td>
        <td class="num">- ${formatINR(draft.marketDiscount)}</td>
      </tr>`
          : ''
      }
      <tr>
        <td><strong>Net Taxable Fare</strong></td>
        <td>Before Tax</td>
        <td class="num"><strong>${formatINR(taxableAmount)}</strong></td>
      </tr>
      ${
        draft.includeGst
          ? `<tr>
        <td>GST @ ${draft.gstPercentage}% (CGST: ${formatINR(
              cgst
            )} + SGST: ${formatINR(sgst)})</td>
        <td>SAC 996412</td>
        <td class="num">${formatINR(gstAmount)}</td>
      </tr>`
          : ''
      }
      <tr class="total-row">
        <td>Grand Total Bill Amount</td>
        <td>Advance Paid: ${formatINR(
          draft.advancePaid
        )} · Balance: ${formatINR(balanceDue)}</td>
        <td class="num">${formatINR(grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div style="font-size:12px;color:#475569;max-width:440px;">
      <strong>Notes & Declaration:</strong><br/>
      ${draft.notes}<br/>
      Official Company GSTIN: <strong>${OFFICIAL_GSTIN}</strong>
    </div>
    <div style="text-align:right;">
      ${
        draft.includeMohurStamp
          ? `<div class="stamp">SAFAR INDIA CABS • N. INDIA<br/>GSTIN: ${OFFICIAL_GSTIN}<br/>OFFICIAL MOHUR STAMP</div><br/>`
          : ''
      }
      ${
        draft.includeDigitalSign
          ? `<div style="font-family:cursive;font-size:18px;color:#1e3a8a;margin-top:6px;">${draft.authorizedSignatoryName}</div>`
          : ''
      }
      <div style="font-size:11px;font-weight:700;color:#0f172a;margin-top:2px;">Authorized Signatory · SafarIndiaCabs</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${draft.invoiceNumber}_${draft.bookingId}_MohurBill.html`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(
      `Downloaded branded Mohur & Sign bill (${draft.invoiceNumber}).`
    );
  };

  const cleanWaPhone = draft.customerPhone.replace(/\D/g, '');
  const waNumber =
    cleanWaPhone.length === 10 ? `91${cleanWaPhone}` : cleanWaPhone || '919811427650';
  const waBillSummary = `*Safar India Cabs (A1 Cab Services • N. India)*
*Official GST Tax Invoice / Receipt*
Invoice No: *${draft.invoiceNumber}*
Booking ID: *#${draft.bookingId}*
GSTIN: *${OFFICIAL_GSTIN}*

Customer: *${draft.customerName}*
Route: ${draft.pickupCity} → ${draft.dropCity}
Date: ${draft.pickupDate}
Vehicle: ${draft.vehicleCategory} (${draft.vehicleNumber})

*Fare Breakdown:*
• Base Fare (${draft.distanceKm} KM): ${formatINR(draft.baseFare)}
• Driver Allowance: ${formatINR(draft.driverAllowance)}
• State Tax / Toll: ${formatINR(draft.stateTax)}
${draft.marketDiscount > 0 ? `• Market Discount: -${formatINR(draft.marketDiscount)}\n` : ''}${
    draft.includeGst ? `• 5% GST (SAC 996412): ${formatINR(gstAmount)}\n` : ''
  }• *Grand Total: ${formatINR(grandTotal)}*
• Advance Paid: ${formatINR(draft.advancePaid)}
• *Balance Payable: ${formatINR(balanceDue)}*

Authorized by: ${draft.authorizedSignatoryName} (SafarIndiaCabs Mohur & Sign)`;

  return (
    <section className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Bill Generator (Official Mohur Stamp & Digital Signature)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create instant branded corporate & individual GST bills (GSTIN: {OFFICIAL_GSTIN}) with official SafarIndiaCabs logo, circular Mohur, and signatory stamp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadStandaloneHtml}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Branded Bill</span>
          </button>

          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
              waBillSummary
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>WhatsApp Bill to Customer</span>
          </a>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save Branded PDF</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left Editor Controls (5 cols) | Right Live Branded Invoice Preview (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Editor Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          {/* Load from Existing Booking */}
          <div className="space-y-1.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <label
              htmlFor="select-booking-prefill"
              className="block text-xs font-semibold text-slate-900 dark:text-slate-100"
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
                    setDraft(bookingToBillDraft(found));
                    onShowToast(
                      `Loaded bill details from booking ${found.bookingId} (${found.customerName}).`
                    );
                  }
                }}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
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
                  });
                }}
                className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Blank Bill</span>
              </button>
            </div>
          </div>

          {/* Mohur & Sign Toggles */}
          <div className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Mohur Stamp, Signature & Branding Controls
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  updateField('includeMohurStamp', !draft.includeMohurStamp)
                }
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeMohurStamp
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <Stamp className="w-4 h-4 shrink-0" />
                <span>Circular Mohur: {draft.includeMohurStamp ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateField('includeDigitalSign', !draft.includeDigitalSign)
                }
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeDigitalSign
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <PenTool className="w-4 h-4 shrink-0" />
                <span>Digital Sign: {draft.includeDigitalSign ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => updateField('includeGst', !draft.includeGst)}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeGst
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>5% GST Tax: {draft.includeGst ? 'Included' : 'Non-GST'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBannerInBill((b) => !b)}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
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
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={draft.invoiceNumber}
                onChange={(e) => updateField('invoiceNumber', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={draft.invoiceDate}
                onChange={(e) => updateField('invoiceDate', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Customer / Traveller Name
              </label>
              <input
                type="text"
                value={draft.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Customer Mobile
              </label>
              <input
                type="text"
                value={draft.customerPhone}
                onChange={(e) => updateField('customerPhone', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Corporate / Company Name (Optional)
              </label>
              <input
                type="text"
                value={draft.billingCompanyName}
                onChange={(e) =>
                  updateField('billingCompanyName', e.target.value)
                }
                placeholder="e.g. TechSpire India Pvt Ltd"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Customer GSTIN (Optional)
              </label>
              <input
                type="text"
                value={draft.customerGstin}
                onChange={(e) =>
                  updateField('customerGstin', e.target.value.toUpperCase())
                }
                placeholder="B2C / Unregistered"
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Route & Chauffeur Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Pickup City
              </label>
              <input
                type="text"
                value={draft.pickupCity}
                onChange={(e) => updateField('pickupCity', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Drop City
              </label>
              <input
                type="text"
                value={draft.dropCity}
                onChange={(e) => updateField('dropCity', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Trip Category
              </label>
              <select
                value={draft.tripType}
                onChange={(e) =>
                  updateField('tripType', e.target.value as TripType)
                }
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
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
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
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
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Innova Crysta">Innova Crysta</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                value={draft.vehicleNumber}
                onChange={(e) =>
                  updateField('vehicleNumber', e.target.value.toUpperCase())
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                value={draft.driverName}
                onChange={(e) => updateField('driverName', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Pricing & Charges Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Distance (KM)
              </label>
              <input
                type="number"
                value={draft.distanceKm}
                onChange={(e) =>
                  updateField('distanceKm', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Rate / KM (₹)
              </label>
              <input
                type="number"
                value={draft.perKmRate}
                onChange={(e) =>
                  updateField('perKmRate', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Base Fare (₹)
              </label>
              <input
                type="number"
                value={draft.baseFare}
                onChange={(e) =>
                  updateField('baseFare', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Driver Bata (₹)
              </label>
              <input
                type="number"
                value={draft.driverAllowance}
                onChange={(e) =>
                  updateField('driverAllowance', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                State Tax/Toll (₹)
              </label>
              <input
                type="number"
                value={draft.stateTax}
                onChange={(e) =>
                  updateField('stateTax', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Parking/Extra (₹)
              </label>
              <input
                type="number"
                value={draft.parkingTollExtra}
                onChange={(e) =>
                  updateField('parkingTollExtra', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                value={draft.marketDiscount}
                onChange={(e) =>
                  updateField('marketDiscount', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Advance Paid (₹)
              </label>
              <input
                type="number"
                value={draft.advancePaid}
                onChange={(e) =>
                  updateField('advancePaid', Number(e.target.value))
                }
                className="w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Signatory Name
              </label>
              <input
                type="text"
                value={draft.authorizedSignatoryName}
                onChange={(e) =>
                  updateField('authorizedSignatoryName', e.target.value)
                }
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Live Branded Invoice Paper Preview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden text-slate-900">
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
            {/* Invoice Top Header with Uploaded Logo */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
              <div className="flex items-start gap-4">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="SafarIndiaCabs Official Logo"
                  className="w-20 h-20 object-contain rounded-xl border border-slate-200 p-1 bg-white shrink-0"
                />
                <div>
                  <div className="text-xl font-bold text-slate-900 font-display tracking-tight">
                    SafarIndiaCabs
                  </div>
                  <div className="text-xs font-semibold text-amber-700 tracking-wide">
                    A1 CAB SERVICES • N. INDIA — Your Journey, Our Priority
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Web: safarindiacabs.com · Support: +91 98114 27650
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                    Official GSTIN: {OFFICIAL_GSTIN} · SAC: 996412
                  </div>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {draft.includeGst
                    ? 'GST TAX INVOICE'
                    : 'OFFICIAL TRIP RECEIPT'}
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                  {draft.invoiceNumber}
                </div>
                <div className="text-xs font-mono text-slate-600 mt-0.5">
                  Booking Ref: #{draft.bookingId}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Date: {draft.invoiceDate}
                </div>
              </div>
            </div>

            {/* Customer & Journey Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Billed To (Traveller / Corporate)
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {draft.customerName}
                </div>
                {draft.billingCompanyName && (
                  <div className="font-semibold text-slate-700">
                    {draft.billingCompanyName}
                  </div>
                )}
                <div className="font-mono text-slate-600">
                  Phone: {draft.customerPhone}
                </div>
                {draft.customerEmail && (
                  <div className="text-slate-600">{draft.customerEmail}</div>
                )}
                <div className="font-mono text-slate-800 pt-1">
                  Customer GSTIN:{' '}
                  <strong>{draft.customerGstin || 'B2C / Unregistered'}</strong>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Trip & Chauffeur Particulars
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {draft.pickupCity} → {draft.dropCity}
                </div>
                <div className="text-slate-700">
                  {draft.tripType} · {draft.pickupDate} ({draft.pickupTime})
                </div>
                <div className="font-mono text-slate-700">
                  Cab: {draft.vehicleCategory} ({draft.vehicleNumber})
                </div>
                <div className="font-mono text-slate-700">
                  Chauffeur: {draft.driverName} ({draft.driverPhone})
                </div>
              </div>
            </div>

            {/* Fare Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-4 text-left font-bold">
                      Description of Cab Service (SAC 996412)
                    </th>
                    <th className="py-2.5 px-4 text-left font-bold">
                      Rate / Basis
                    </th>
                    <th className="py-2.5 px-4 text-right font-bold">
                      Amount (INR)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="py-2.5 px-4 font-medium">
                      Base Trip Fare ({draft.vehicleCategory})
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {draft.distanceKm} KM × ₹{draft.perKmRate}/KM (
                      {draft.tripDays}d)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">
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
                    <tr className="bg-emerald-50/70 text-emerald-900">
                      <td className="py-2.5 px-4 font-medium">
                        Less: SafarIndiaCabs Promotional Market Discount
                      </td>
                      <td className="py-2.5 px-4">Instant Rebate</td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold">
                        - {formatINR(draft.marketDiscount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-semibold">
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
                      <td className="py-2.5 px-4 font-mono">SAC 996412</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatINR(gstAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-900 text-white font-bold text-sm">
                    <td className="py-3 px-4">Grand Total Bill Amount</td>
                    <td className="py-3 px-4 text-xs font-normal text-slate-300 font-mono">
                      Adv: {formatINR(draft.advancePaid)} · Bal:{' '}
                      {formatINR(balanceDue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      {formatINR(grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mohur Stamp & Signature Footer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pt-4 border-t border-dashed border-slate-300">
              <div className="space-y-1.5 text-xs text-slate-600 max-w-sm">
                <div className="font-semibold text-slate-900">
                  Terms & Settlement Summary:
                </div>
                <p className="text-[11px] leading-relaxed">{draft.notes}</p>
                <div className="font-mono text-[11px] font-bold text-slate-900">
                  GSTIN: {OFFICIAL_GSTIN} · PAN: DQHPA3025F
                </div>
              </div>

              <div className="flex items-center gap-5 self-end sm:self-auto">
                {draft.includeMohurStamp && (
                  <div
                    className="relative w-28 h-28 flex items-center justify-center select-none"
                    title="Official Safar India Cabs Circular Mohur"
                  >
                    <svg
                      viewBox="0 0 120 120"
                      className="w-28 h-28 text-blue-900/90 -rotate-12"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="55"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeDasharray="3 2"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="35"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        id="mohurArcTop"
                        d="M 18,60 A 42,42 0 1,1 102,60"
                        fill="none"
                      />
                      <path
                        id="mohurArcBottom"
                        d="M 102,60 A 42,42 0 1,1 18,60"
                        fill="none"
                      />
                      <text
                        fontSize="7.3"
                        fontWeight="800"
                        fill="currentColor"
                        letterSpacing="1.1"
                      >
                        <textPath
                          href="#mohurArcTop"
                          startOffset="50%"
                          textAnchor="middle"
                        >
                          SAFAR INDIA CABS • N. INDIA
                        </textPath>
                      </text>
                      <text
                        fontSize="6.4"
                        fontWeight="700"
                        fill="currentColor"
                        letterSpacing="0.7"
                      >
                        <textPath
                          href="#mohurArcBottom"
                          startOffset="50%"
                          textAnchor="middle"
                        >
                          GSTIN: {OFFICIAL_GSTIN}
                        </textPath>
                      </text>
                      <text
                        x="60"
                        y="55"
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="800"
                        fill="currentColor"
                      >
                        A1 CAB SERVICES
                      </text>
                      <text
                        x="60"
                        y="65"
                        textAnchor="middle"
                        fontSize="6.8"
                        fontWeight="700"
                        fill="currentColor"
                      >
                        VERIFIED MOHUR
                      </text>
                    </svg>
                  </div>
                )}

                <div className="text-right">
                  {draft.includeDigitalSign && (
                    <div className="mb-1">
                      <svg
                        viewBox="0 0 160 46"
                        className="w-36 h-11 text-blue-950 ml-auto"
                      >
                        <path
                          d="M12,34 C28,10 38,38 56,18 C68,8 78,32 98,16 C114,6 126,30 150,12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M22,40 L142,36"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="text-xs font-bold text-blue-950">
                        {draft.authorizedSignatoryName}
                      </div>
                    </div>
                  )}
                  <div className="text-xs font-bold text-slate-900">
                    Authorized Signatory
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    For SafarIndiaCabs ({OFFICIAL_GSTIN})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
