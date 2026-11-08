import React, { useState, useEffect } from 'react';
import {
  Booking,
  formatINRDecimal,
  numberToIndianWords,
  OFFICIAL_LEGAL_NAME,
  OFFICIAL_SUBTITLE,
  OFFICIAL_GSTIN,
  OFFICIAL_SAC_CODE,
  OFFICIAL_PROPRIETOR,
  OFFICIAL_EMAIL,
  OFFICIAL_HELPLINE,
  OFFICIAL_REGISTERED_ADDRESS,
  OFFICIAL_LOGO_URL,
  OFFICIAL_SIGNATURE_URL,
} from '../types/safar';
import {
  bookingToStandardBillDraft,
  downloadBillAsPdf,
  shareBillPdfOnWhatsApp,
  getFormattedDigitalSignTimestamp,
  loadCleanSignaturePngDataUrl,
} from '../lib/pdfAndApis';
import { X, Printer, Download, CheckCircle2, Send } from 'lucide-react';

interface GstInvoiceModalProps {
  booking: Booking;
  onClose: () => void;
}

export const GstInvoiceModal: React.FC<GstInvoiceModalProps> = ({
  booking,
  onClose,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharingWaPdf, setSharingWaPdf] = useState(false);
  const [cleanSignUrl, setCleanSignUrl] = useState<string>(
    OFFICIAL_SIGNATURE_URL
  );

  useEffect(() => {
    let mounted = true;
    loadCleanSignaturePngDataUrl(OFFICIAL_SIGNATURE_URL).then((url) => {
      if (mounted && url) setCleanSignUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const numericRef = booking.bookingId.replace(/\D/g, '') || '2607';
  const invoiceNo = booking.invoiceNumber || `SIC-2026-${numericRef}`;
  const dutyRefId = booking.bookingId.startsWith('SIC-')
    ? booking.bookingId
    : `SIC-${numericRef}`;

  const days = Math.max(1, Number(booking.tripDays || 1));
  const durationDisplay =
    booking.tripType === 'Round Trip Outstation' && days === 1
      ? '1 Day (Same Day Return)'
      : `${days} Day(s)`;

  const baseCabFare = Math.max(0, Number(booking.baseFare || 0));
  const driverAllowanceAmt = Math.max(0, Number(booking.driverAllowance || 0));
  const highwayTollAmt = Math.max(0, Number(booking.tollTax || 0));
  const statePermitAmt = Math.max(0, Number(booking.stateTax || 0));
  const nightChargeAmt = Math.max(0, Number(booking.nightCharges || 0));
  const discountAmt = Math.max(0, Number(booking.marketDiscount || 0));

  const taxableValue = Math.max(
    0,
    baseCabFare +
      driverAllowanceAmt +
      highwayTollAmt +
      statePermitAmt +
      nightChargeAmt -
      discountAmt
  );
  const cgst = Math.round(booking.gstAmount / 2);
  const sgst = booking.gstAmount - cgst;
  const grandTotal = booking.totalFare || taxableValue + booking.gstAmount;
  const settledAmount = Math.min(grandTotal, Math.max(0, booking.advancePaid));
  const balanceDue = Math.max(0, grandTotal - settledAmount);
  const isPaidInFull = balanceDue === 0;
  const signTimestamp = getFormattedDigitalSignTimestamp(booking.pickupDate);

  const itemizedRows: Array<{
    sno: number;
    description: string;
    sac: string;
    amount: string;
    isDiscount?: boolean;
  }> = [
    {
      sno: 1,
      description: `Cab Hire / Base Trip Charges (${booking.tripType}${
        booking.tripType === 'Round Trip Outstation' && days === 1
          ? ' • Same Day Return'
          : ''
      } — ${booking.pickupCity} to ${booking.dropCity} · ${booking.distanceKm} KM @ ₹${booking.perKmRate}/KM)`,
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(baseCabFare),
    },
    {
      sno: 2,
      description: `Chauffeur / Driver Allowance (Bata — ${durationDisplay})`,
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(driverAllowanceAmt),
    },
    {
      sno: 3,
      description: 'Highway / Fastag Toll Tax Charges',
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(highwayTollAmt),
    },
    {
      sno: 4,
      description: 'Inter-State Entry Permit & State Tax Charges',
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(statePermitAmt),
    },
  ];

  if (nightChargeAmt > 0) {
    itemizedRows.push({
      sno: itemizedRows.length + 1,
      description: 'Night Driving Allowance Charges',
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(nightChargeAmt),
    });
  }

  if (discountAmt > 0) {
    itemizedRows.push({
      sno: itemizedRows.length + 1,
      description: 'Less: Special Promotional / Market Rebate Discount',
      sac: OFFICIAL_SAC_CODE,
      amount: `- ${formatINRDecimal(discountAmt)}`,
      isDiscount: true,
    });
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadRealPdf = async () => {
    setDownloadingPdf(true);
    try {
      const draft = bookingToStandardBillDraft(booking);
      await downloadBillAsPdf(draft);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleShareWhatsAppPdf = async () => {
    setSharingWaPdf(true);
    try {
      const draft = bookingToStandardBillDraft(booking);
      await shareBillPdfOnWhatsApp(draft);
    } finally {
      setSharingWaPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-8">
        {/* Modal Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Official Digitally Signed GST Tax Invoice ({OFFICIAL_GSTIN})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sharingWaPdf}
              onClick={handleShareWhatsAppPdf}
              className="px-3 py-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {sharingWaPdf ? 'Sharing PDF...' : 'Share PDF on WhatsApp'}
              </span>
            </button>
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadRealPdf}
              className="px-3 py-1.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloadingPdf ? 'Generating PDF...' : 'Download .PDF Invoice'}
              </span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Dual-Tone Bar */}
        <div className="flex w-full h-2.5">
          <div className="w-[68%] bg-slate-900" />
          <div className="w-[32%] bg-amber-600" />
        </div>

        {/* Printable Invoice Area */}
        <div
          id="printable-gst-invoice"
          className="p-6 sm:p-8 space-y-4 bg-white text-slate-900"
        >
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-start gap-3.5">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="SafarIndiaCabs Official Logo"
                className="w-20 h-20 object-contain rounded-xl border border-slate-300 p-1 bg-white shrink-0"
              />
              <div className="space-y-0.5">
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-display">
                  {OFFICIAL_LEGAL_NAME}
                </div>
                <div className="text-[10px] sm:text-[11px] font-extrabold text-amber-700 tracking-wide uppercase">
                  {OFFICIAL_SUBTITLE}
                </div>
                <div className="text-xs font-extrabold text-slate-900 pt-0.5">
                  GSTIN: {OFFICIAL_GSTIN} &nbsp;|&nbsp; Proprietor:{' '}
                  {OFFICIAL_PROPRIETOR}
                </div>
                <div className="text-[11px] text-slate-600">
                  Regd. Address: {OFFICIAL_REGISTERED_ADDRESS}
                </div>
                <div className="text-[11px] text-slate-600">
                  Phone / WhatsApp: {OFFICIAL_HELPLINE} &nbsp;|&nbsp; Email:{' '}
                  {OFFICIAL_EMAIL}
                </div>
              </div>
            </div>

            <div className="sm:w-64 shrink-0 rounded-xl border border-slate-300 overflow-hidden bg-white">
              <div className="bg-amber-100/90 border-b border-amber-300 py-1.5 px-3 text-center text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                GST TAX INVOICE
              </div>
              <div className="p-3 space-y-1 text-xs">
                <div className="font-extrabold text-slate-900 text-sm">
                  Invoice No: {invoiceNo}
                </div>
                <div className="text-slate-700">
                  Invoice Date: {booking.pickupDate}
                </div>
                <div className="text-slate-700">Duty / Ref ID: {dutyRefId}</div>
                <div className="text-slate-700">
                  SAC Code: {OFFICIAL_SAC_CODE} (Cab Service)
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-300 overflow-hidden bg-white">
              <div className="bg-slate-100 border-b border-slate-300 px-3.5 py-2 font-extrabold text-slate-900 uppercase text-[11px] tracking-wide">
                BILLED TO (PASSENGER / CORPORATE DETAILS)
              </div>
              <div className="p-3.5 space-y-1">
                <div className="text-sm font-extrabold text-slate-900">
                  {booking.customerName}
                </div>
                <div className="text-slate-700">
                  Mobile: {booking.customerPhone}
                </div>
                {booking.customerGstin && (
                  <div className="font-mono font-bold text-slate-900">
                    Customer GSTIN: {booking.customerGstin}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 overflow-hidden bg-white">
              <div className="bg-slate-100 border-b border-slate-300 px-3.5 py-2 font-extrabold text-slate-900 uppercase text-[11px] tracking-wide">
                VEHICLE, CHAUFFEUR & JOURNEY SUMMARY
              </div>
              <div className="p-3.5 space-y-1">
                <div className="font-extrabold text-slate-900 text-xs sm:text-[13px]">
                  Vehicle: {booking.vehicleCategory} AC (
                  {booking.vehicleModel || 'Swift Dzire / Toyota Etios'})
                </div>
                <div className="text-slate-700">
                  Vehicle Reg. No: {booking.vehicleNumber || 'HR55BE6324'}{' '}
                  &nbsp;|&nbsp; Duty: {booking.tripType}
                </div>
                <div className="text-slate-700">
                  Chauffeur: {booking.driverName || 'Assigned Chauffeur'} (
                  {booking.driverPhone || OFFICIAL_HELPLINE})
                </div>
                <div className="text-slate-700">
                  Travel Date: {booking.pickupDate} at {booking.pickupTime}
                </div>
                <div className="text-slate-700 font-semibold">
                  Total Distance: {booking.distanceKm} KM &nbsp;|&nbsp;
                  Duration:{' '}
                  <span className="font-extrabold text-slate-900">
                    {durationDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pickup & Drop Location Full-Width Box */}
          <div className="rounded-xl border border-slate-300 bg-slate-50/80 px-4 py-2.5 text-xs space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-slate-900 w-36 shrink-0">
                PICKUP LOCATION:
              </span>
              <span className="text-slate-800">{booking.pickupCity}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-slate-900 w-36 shrink-0">
                DROP LOCATION:
              </span>
              <span className="text-slate-800">{booking.dropCity}</span>
            </div>
          </div>

          {/* 4-Column Itemized Fare Breakup Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-300">
                  <th className="py-2.5 px-3 text-left font-extrabold w-12">
                    S.NO
                  </th>
                  <th className="py-2.5 px-3 text-left font-extrabold">
                    DESCRIPTION OF CAB / TRAVEL SERVICE (ITEMIZED BREAKUP)
                  </th>
                  <th className="py-2.5 px-3 text-center font-extrabold w-24">
                    SAC CODE
                  </th>
                  <th className="py-2.5 px-3.5 text-right font-extrabold w-36">
                    AMOUNT (INR)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {itemizedRows.map((row) => (
                  <tr
                    key={row.sno}
                    className={
                      row.isDiscount ? 'bg-emerald-50/40 text-emerald-800' : ''
                    }
                  >
                    <td className="py-2 px-3">{row.sno}</td>
                    <td className="py-2 px-3 font-medium">{row.description}</td>
                    <td className="py-2 px-3 text-center font-mono">
                      {row.sac}
                    </td>
                    <td className="py-2 px-3.5 text-right font-extrabold font-mono">
                      {row.amount}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/90">
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3 font-extrabold">
                    Taxable Service Value (Total Breakup Sub-Total)
                  </td>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3.5 text-right font-extrabold font-mono">
                    {formatINRDecimal(taxableValue)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3 text-slate-700">
                    CGST @ 2.5% (Central Goods & Services Tax)
                  </td>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3.5 text-right font-mono text-slate-800">
                    {formatINRDecimal(cgst)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3 text-slate-700">
                    SGST @ 2.5% (State Goods & Services Tax)
                  </td>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3.5 text-right font-mono text-slate-800">
                    {formatINRDecimal(sgst)}
                  </td>
                </tr>
                <tr className="bg-blue-50/70 font-extrabold text-slate-900">
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3 text-xs sm:text-sm">
                    TOTAL INVOICE AMOUNT
                  </td>
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3.5 text-right font-mono text-xs sm:text-sm">
                    {formatINRDecimal(grandTotal)}
                  </td>
                </tr>
                <tr className="bg-emerald-50/90 text-emerald-800 font-extrabold">
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3">
                    Amount Settled (UPI / Cash / Online)
                  </td>
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3.5 text-right font-mono">
                    {formatINRDecimal(settledAmount)} (
                    {isPaidInFull ? 'PAID IN FULL' : 'ADVANCE PAID'})
                  </td>
                </tr>
                <tr className="font-extrabold text-slate-900">
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3">Balance Payable</td>
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3.5 text-right font-mono">
                    {isPaidInFull
                      ? 'INR 0.00 (NIL - PAID IN FULL)'
                      : formatINRDecimal(balanceDue)}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="bg-slate-100 border-t border-slate-300 px-3.5 py-2 text-xs font-extrabold text-slate-900">
              Amount in Words: {numberToIndianWords(grandTotal)}
            </div>
          </div>

          {/* Bottom 3-Column Footer Box */}
          <div className="rounded-xl border border-slate-300 grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 overflow-hidden bg-white text-xs">
            {/* Column 1: Declaration & Terms */}
            <div className="sm:col-span-5 p-3.5 space-y-1 text-[10.5px] leading-snug text-slate-700">
              <div className="font-extrabold text-slate-900 uppercase text-xs mb-1">
                DECLARATION & TERMS:
              </div>
              <div>
                1. Certified that the particulars given above are true and
                correct for corporate travel claim.
              </div>
              <div>2. Regd. Office: {OFFICIAL_REGISTERED_ADDRESS}.</div>
              <div>
                3. GSTIN: {OFFICIAL_GSTIN} | SAC: {OFFICIAL_SAC_CODE}.
              </div>
              <div>4. Subject to North Delhi Jurisdiction. E. & O.E.</div>
              <div>
                5. Official Tax Invoice for Official / Personal Travel Claim &
                Company Reimbursement.
              </div>
            </div>

            {/* Column 2: Digitally Signed Block */}
            <div className="sm:col-span-3 p-3.5 flex flex-col justify-between text-[11px] leading-snug text-slate-800">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">
                  Digitally signed by {OFFICIAL_LEGAL_NAME}
                </div>
                <div className="font-semibold text-slate-900">
                  ({OFFICIAL_PROPRIETOR.toUpperCase()})
                </div>
                <div>GSTIN: {OFFICIAL_GSTIN}</div>
                <div>Date: {signTimestamp}</div>
                <div>Location: IN (North Delhi)</div>
              </div>
              <div className="pt-3 text-[10px] font-extrabold tracking-widest text-emerald-700 uppercase">
                • Digitally Verified Tax Invoice
              </div>
            </div>

            {/* Column 3: Rectangular Stamp + Pre-Filled Aman Mishra Signature */}
            <div className="sm:col-span-4 p-3.5 flex flex-col items-center justify-between text-center">
              <div className="font-extrabold text-slate-900 text-xs">
                For {OFFICIAL_LEGAL_NAME}
              </div>

              <div className="relative my-2 w-full max-w-[210px] flex items-center justify-center min-h-[82px]">
                <div className="w-full border-2 border-blue-900 p-0.5 rounded-xs bg-blue-50/20 text-blue-900">
                  <div className="border border-blue-800 px-2 py-1.5 space-y-0.5">
                    <div className="text-[10px] font-extrabold tracking-wider uppercase text-blue-950">
                      SAFARINDIACABS • NORTH DELHI
                    </div>
                    <div className="text-[9px] font-mono font-bold text-blue-900 border-b border-blue-800/40 pb-0.5">
                      GSTIN: {OFFICIAL_GSTIN}
                    </div>
                    <div className="h-7" />
                    <div className="text-[8px] font-extrabold tracking-widest uppercase text-blue-900">
                      OFFICIAL VERIFIED TAX SEAL
                    </div>
                  </div>
                </div>

                <img
                  src={cleanSignUrl}
                  alt="Aman Mishra Official Signature"
                  className="absolute inset-x-2 top-5 h-12 w-[calc(100%-16px)] object-contain pointer-events-none select-none"
                />
              </div>

              <div>
                <div className="font-extrabold text-slate-900 text-xs">
                  Prop. {OFFICIAL_PROPRIETOR}
                </div>
                <div className="text-[10px] text-slate-500">
                  Authorised Signatory & Seal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
