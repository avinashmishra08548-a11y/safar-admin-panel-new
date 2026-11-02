import React, { useState } from 'react';
import {
  Booking,
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
} from '../types/safar';
import {
  bookingToStandardBillDraft,
  downloadBillAsPdf,
  shareBillPdfOnWhatsApp,
  getFormattedDigitalSignTimestamp,
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

  const invoiceNo =
    booking.invoiceNumber ||
    `INV-SIC-2026-${booking.bookingId.replace('SIC', '')}`;
  const taxableValue = Math.max(
    0,
    booking.baseFare +
      booking.driverAllowance +
      booking.stateTax +
      booking.nightCharges -
      booking.marketDiscount
  );
  const cgst = Math.round(booking.gstAmount / 2);
  const sgst = booking.gstAmount - cgst;
  const signTimestamp = getFormattedDigitalSignTimestamp(booking.pickupDate);

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
      <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-8">
        {/* Modal Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Official Digitally Signed GST Invoice ({OFFICIAL_GSTIN})
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

        {/* Printable Invoice Area */}
        <div
          id="printable-gst-invoice"
          className="p-6 sm:p-8 space-y-6 bg-white text-slate-900"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
            <div className="flex items-start gap-3.5">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="SafarIndiaCabs Official Logo"
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 bg-white shrink-0"
              />
              <div className="space-y-0.5">
                <div className="text-xl font-extrabold text-slate-900 font-display">
                  {OFFICIAL_COMPANY_NAME}
                </div>
                <div className="text-xs font-bold text-amber-700">
                  Proprietor: {OFFICIAL_PROPRIETOR} · GSTIN: {OFFICIAL_GSTIN} ·
                  SAC: {OFFICIAL_SAC_CODE}
                </div>
                <div className="text-[11px] font-semibold text-slate-700">
                  {OFFICIAL_REGISTERED_ADDRESS}
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Email: {OFFICIAL_EMAIL} · Helpline: {OFFICIAL_HELPLINE}
                </div>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <div className="text-xs font-extrabold text-slate-500">
                GST TAX INVOICE
              </div>
              <div className="text-lg font-extrabold font-mono text-slate-900 mt-0.5">
                {invoiceNo}
              </div>
              <div className="text-xs text-slate-600 font-mono mt-0.5">
                Booking Ref: #{booking.bookingId} · Date: {booking.pickupDate}
              </div>
            </div>
          </div>

          {/* Customer & Trip Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-extrabold text-slate-900 uppercase">
                Billed To Customer
              </div>
              <div className="text-sm font-extrabold text-slate-900">
                {booking.customerName}
              </div>
              <div className="text-slate-700 font-mono font-semibold">
                {booking.customerPhone}
              </div>
              <div className="text-slate-600">{booking.customerEmail}</div>
              <div className="text-slate-900 font-mono pt-1">
                Customer GSTIN:{' '}
                <strong>
                  {booking.customerGstin || 'Unregistered / B2C Consumer'}
                </strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-extrabold text-slate-900 uppercase">
                Itinerary & Chauffeur Details
              </div>
              <div className="text-slate-900 font-extrabold text-sm">
                {booking.pickupCity} → {booking.dropCity}
              </div>
              <div className="text-slate-700 font-semibold">
                {booking.tripType} · {booking.vehicleCategory} (
                {booking.vehicleModel || 'AC Cab'})
              </div>
              <div className="text-slate-800 font-mono font-bold">
                Vehicle Plate: {booking.vehicleNumber || 'Assigned'} ·
                Chauffeur: {booking.driverName || 'Assigned'}
              </div>
              <div className="text-slate-600 font-mono">
                Distance: {booking.distanceKm} KM · Duration: {booking.tripDays}{' '}
                Day(s)
              </div>
            </div>
          </div>

          {/* Itemized Fare Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="py-2.5 px-4 text-left font-extrabold">
                    Particulars (SAC {OFFICIAL_SAC_CODE})
                  </th>
                  <th className="py-2.5 px-4 text-left font-extrabold">
                    Computation Basis
                  </th>
                  <th className="py-2.5 px-4 text-right font-extrabold">
                    Amount (INR)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    Outstation Base Distance Fare ({booking.vehicleCategory})
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    {booking.distanceKm} KM × ₹{booking.perKmRate}/KM
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold">
                    {formatINR(booking.baseFare)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">
                    Driver Allowance (DA / Daily Bata)
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    {booking.tripDays} Day(s)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(booking.driverAllowance)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">
                    State Border Permit & Toll Tax
                  </td>
                  <td className="py-2.5 px-4">Inter-state allocation</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(booking.stateTax)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">Night Driving Charges</td>
                  <td className="py-2.5 px-4">10:00 PM – 06:00 AM window</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(booking.nightCharges)}
                  </td>
                </tr>
                {booking.marketDiscount > 0 && (
                  <tr className="bg-emerald-50/70 text-emerald-900">
                    <td className="py-2.5 px-4 font-bold">
                      Less: Competitive Market Price Discount
                    </td>
                    <td className="py-2.5 px-4">
                      SafarIndiaCabs Promotional Rebate
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      - {formatINR(booking.marketDiscount)}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50 font-bold text-slate-900">
                  <td className="py-2.5 px-4">Net Taxable Value</td>
                  <td className="py-2.5 px-4 font-mono">Before GST</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(taxableValue)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">
                    GST @ 5% (CGST 2.5%: {formatINR(cgst)} + SGST 2.5%:{' '}
                    {formatINR(sgst)})
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    SAC {OFFICIAL_SAC_CODE}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(booking.gstAmount)}
                  </td>
                </tr>
                <tr className="bg-slate-900 text-white font-extrabold text-sm">
                  <td className="py-3 px-4">TOTAL</td>
                  <td className="py-3 px-4 text-xs font-semibold text-amber-300 font-mono">
                    Adv Paid: {formatINR(booking.advancePaid)} · Bal:{' '}
                    {formatINR(booking.balanceAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-400 text-base">
                    INR {Math.round(booking.totalFare).toLocaleString('en-IN')}.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Settlement Breakdown + Rectangular Stamp & Digitally Signed Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pt-4 border-t-2 border-slate-200 text-xs text-slate-700">
            <div className="space-y-1 max-w-sm">
              <div className="font-extrabold text-slate-900">
                {OFFICIAL_COMPANY_NAME} (Proprietor: {OFFICIAL_PROPRIETOR})
              </div>
              <div className="font-mono text-[11px] font-bold text-slate-800">
                GSTIN: {OFFICIAL_GSTIN} · SAC: {OFFICIAL_SAC_CODE}
              </div>
              <div className="text-[11px] text-slate-700">
                Address: {OFFICIAL_REGISTERED_ADDRESS}
              </div>
              <div className="text-[11px] font-mono text-slate-600">
                Email: {OFFICIAL_EMAIL} · Helpline: {OFFICIAL_HELPLINE}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {OFFICIAL_ADMIN_PORTAL_URL}
              </div>
            </div>

            {/* Rectangular Stamp + Digitally Signed Block */}
            <div className="flex flex-col items-end gap-2.5 self-end sm:self-auto w-full sm:w-auto">
              <div className="border-2 border-blue-900 px-3.5 py-2 rounded-xs bg-blue-50/40 text-blue-950 text-center w-full sm:w-72">
                <div className="text-xs font-extrabold tracking-wider uppercase">
                  FOR {OFFICIAL_LEGAL_NAME}
                </div>
                <div className="text-[10px] font-mono font-bold text-blue-900 mt-0.5">
                  GSTIN: {OFFICIAL_GSTIN} • NORTH DELHI 110084
                </div>
                <div className="text-[11px] font-extrabold text-blue-950 mt-1 border-t border-blue-900/30 pt-0.5 uppercase">
                  PROPRIETOR: {OFFICIAL_PROPRIETOR}
                </div>
              </div>

              <div className="border border-slate-400 bg-white px-4 py-3 text-left text-slate-900 w-full sm:w-72">
                <div className="text-[13px] leading-snug font-sans text-slate-900">
                  Digitally signed by {OFFICIAL_LEGAL_NAME}
                </div>
                <div className="text-[12px] leading-snug font-sans font-semibold text-slate-800">
                  PROPRIETOR: {OFFICIAL_PROPRIETOR.toUpperCase()} ({OFFICIAL_GSTIN})
                </div>
                <div className="text-[12px] leading-snug font-sans text-slate-900 mt-0.5">
                  Date: {signTimestamp}
                </div>
                <div className="text-[12px] leading-snug font-sans text-slate-900">
                  Location: IN
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
