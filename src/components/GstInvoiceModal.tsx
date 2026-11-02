import React from 'react';
import { Booking, formatINR } from '../types/safar';
import { X, Printer, Download, CheckCircle2 } from 'lucide-react';

interface GstInvoiceModalProps {
  booking: Booking;
  onClose: () => void;
}

export const GstInvoiceModal: React.FC<GstInvoiceModalProps> = ({ booking, onClose }) => {
  const invoiceNo =
    booking.invoiceNumber || `INV-SIC-2026-${booking.bookingId.replace('SIC', '')}`;
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadInvoiceHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>GST Tax Invoice - ${invoiceNo} - SafarIndiaCabs</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 32px; max-width: 820px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  .num { text-align: right; font-family: monospace; }
  .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #0f172a; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:22px;">SafarIndiaCabs Mobility Pvt. Ltd.</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#475569;">safarindiacabs.com · GSTIN: 07AABCS4829K1Z5 · SAC Code: 996412</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#475569;">ORIGINAL FOR RECIPIENT · TAX INVOICE</div>
      <div style="font-size:16px;font-weight:700;font-family:monospace;margin-top:4px;">${invoiceNo}</div>
      <div style="font-size:12px;color:#475569;">Booking ID: ${booking.bookingId} · Date: ${booking.pickupDate}</div>
    </div>
  </div>
  <div class="grid">
    <div>
      <strong>Billed To (Customer):</strong><br/>
      ${booking.customerName}<br/>
      Phone: ${booking.customerPhone}<br/>
      Email: ${booking.customerEmail}<br/>
      Customer GSTIN: ${booking.customerGstin || 'Unregistered / Consumer'}
    </div>
    <div>
      <strong>Trip & Dispatch Summary:</strong><br/>
      Itinerary: ${booking.tripType} (${booking.pickupCity} → ${booking.dropCity})<br/>
      Vehicle Class: ${booking.vehicleCategory} (${booking.vehicleModel || 'Standard AC'})<br/>
      Vehicle Plate: ${booking.vehicleNumber || 'Assigned'} · Chauffeur: ${booking.driverName || 'Assigned'}<br/>
      Billable Distance: ${booking.distanceKm} KM (${booking.tripDays} Day${booking.tripDays > 1 ? 's' : ''})
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description of Service (SAC 996412)</th>
        <th>Rate / Basis</th>
        <th class="num">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Outstation Base Distance Fare (${booking.vehicleCategory})</td>
        <td>${booking.distanceKm} KM @ ₹${booking.perKmRate}/KM</td>
        <td class="num">${formatINR(booking.baseFare)}</td>
      </tr>
      <tr>
        <td>Chauffeur Daily Allowance (DA / Bata)</td>
        <td>${booking.tripDays} Day(s)</td>
        <td class="num">${formatINR(booking.driverAllowance)}</td>
      </tr>
      <tr>
        <td>Inter-State Permit & Toll Tax</td>
        <td>Actual / Standard State Entry</td>
        <td class="num">${formatINR(booking.stateTax)}</td>
      </tr>
      <tr>
        <td>Night Driving Allowance</td>
        <td>10:00 PM – 06:00 AM Window</td>
        <td class="num">${formatINR(booking.nightCharges)}</td>
      </tr>
      ${
        booking.marketDiscount > 0
          ? `<tr>
        <td>Less: SafarIndiaCabs Competitive Market Price Discount</td>
        <td>Promotional Rebate</td>
        <td class="num">- ${formatINR(booking.marketDiscount)}</td>
      </tr>`
          : ''
      }
      <tr>
        <td><strong>Taxable Value</strong></td>
        <td>Before GST</td>
        <td class="num"><strong>${formatINR(taxableValue)}</strong></td>
      </tr>
      <tr>
        <td>CGST @ 2.5% + SGST @ 2.5% (Total 5% GST on Cab Renting)</td>
        <td>CGST: ${formatINR(cgst)} + SGST: ${formatINR(sgst)}</td>
        <td class="num">${formatINR(booking.gstAmount)}</td>
      </tr>
      <tr class="total-row">
        <td>Grand Total Invoice Fare (Inclusive of 5% GST)</td>
        <td>Payment Mode: ${booking.paymentMode}</td>
        <td class="num">${formatINR(booking.totalFare)}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:12px;color:#475569;">Computer generated GST Tax Invoice issued via admin.safarindiacabs.com. No physical signature required.</p>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${invoiceNo}_${booking.bookingId}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden shadow-xl my-8">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {booking.invoiceReady
                ? 'Customer Download Enabled on safarindiacabs.com/my-rides'
                : 'Proforma / Duplicate Tax Invoice Preview'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadInvoiceHtml}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Invoice File</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Area */}
        <div id="printable-gst-invoice" className="p-6 sm:p-8 space-y-6 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xl font-bold text-slate-900 font-display">
                SafarIndiaCabs Mobility Pvt. Ltd.
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Connaught Place, New Delhi – 110001 · support@safarindiacabs.com
              </div>
              <div className="text-xs font-mono text-slate-700 mt-1">
                Company GSTIN: 07AABCS4829K1Z5 · SAC: 996412
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-semibold text-slate-500">
                GST TAX INVOICE
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {invoiceNo}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Booking Ref: {booking.bookingId} · Date: {booking.pickupDate}
              </div>
            </div>
          </div>

          {/* Customer & Trip Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Billed To Customer</div>
              <div className="text-sm font-medium text-slate-900">{booking.customerName}</div>
              <div className="text-slate-600 font-mono">{booking.customerPhone}</div>
              <div className="text-slate-600">{booking.customerEmail}</div>
              <div className="text-slate-600 font-mono pt-1">
                Customer GSTIN: {booking.customerGstin || 'Unregistered / B2C Consumer'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Itinerary & Chauffeur Details</div>
              <div className="text-slate-800 font-medium">
                {booking.pickupCity} → {booking.dropCity}
              </div>
              <div className="text-slate-600">
                {booking.tripType} · {booking.vehicleCategory} ({booking.vehicleModel || 'AC Cab'})
              </div>
              <div className="text-slate-600 font-mono">
                Vehicle Plate: {booking.vehicleNumber || 'Assigned'} · Chauffeur:{' '}
                {booking.driverName || 'Assigned'}
              </div>
              <div className="text-slate-600 font-mono">
                Distance: {booking.distanceKm} KM · Duration: {booking.tripDays} Day(s)
              </div>
            </div>
          </div>

          {/* Itemized Fare Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 text-left font-semibold">Particulars (SAC 996412)</th>
                  <th className="py-2.5 px-4 text-left font-semibold">Computation Basis</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    Outstation Base Distance Fare ({booking.vehicleCategory})
                  </td>
                  <td className="py-2.5 px-4 font-mono">
                    {booking.distanceKm} KM × ₹{booking.perKmRate}/KM
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(booking.baseFare)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">Driver Allowance (DA / Daily Bata)</td>
                  <td className="py-2.5 px-4 font-mono">{booking.tripDays} Day(s)</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(booking.driverAllowance)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">State Border Permit & Toll Tax</td>
                  <td className="py-2.5 px-4">Inter-state allocation</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(booking.stateTax)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">Night Driving Charges</td>
                  <td className="py-2.5 px-4">10:00 PM – 06:00 AM window</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatINR(booking.nightCharges)}
                  </td>
                </tr>
                {booking.marketDiscount > 0 && (
                  <tr className="bg-emerald-50/50 text-emerald-900">
                    <td className="py-2.5 px-4 font-medium">
                      Less: Competitive Market Price Discount
                    </td>
                    <td className="py-2.5 px-4">SafarIndiaCabs Promotional Rebate</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">
                      - {formatINR(booking.marketDiscount)}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50/70 font-medium text-slate-900">
                  <td className="py-2.5 px-4">Net Taxable Value</td>
                  <td className="py-2.5 px-4 font-mono">Before GST</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(taxableValue)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">
                    GST @ 5% (CGST 2.5%: {formatINR(cgst)} + SGST 2.5%: {formatINR(sgst)})
                  </td>
                  <td className="py-2.5 px-4 font-mono">SAC 996412 (Motor Cab Passenger Transport)</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(booking.gstAmount)}</td>
                </tr>
                <tr className="bg-slate-900 text-white font-semibold text-sm">
                  <td className="py-3 px-4">Total Final Invoice Fare</td>
                  <td className="py-3 px-4 text-xs font-normal text-slate-300">
                    Payment Plan: {booking.paymentMode}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-400">
                    {formatINR(booking.totalFare)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Settlement Breakdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 text-xs text-slate-600">
            <div>
              <span>Online Advance Paid ({booking.paymentMode}): </span>
              <strong className="font-mono text-slate-900">{formatINR(booking.advancePaid)}</strong>
              <span className="mx-2">·</span>
              <span>Balance Settled on Trip: </span>
              <strong className="font-mono text-slate-900">{formatINR(booking.balanceAmount)}</strong>
            </div>
            <div className="font-mono text-slate-500">
              Authorized Signatory · SafarIndiaCabs Mobility Pvt. Ltd.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
