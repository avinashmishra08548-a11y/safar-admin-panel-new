import React, { useState, useEffect } from 'react';
import {
  Booking,
  CustomBillDraft,
  TripType,
  VehicleCategory,
  formatINR,
  formatINRDecimal,
  numberToIndianWords,
  OFFICIAL_COMPANY_NAME,
  OFFICIAL_LEGAL_NAME,
  OFFICIAL_SUBTITLE,
  OFFICIAL_GSTIN,
  OFFICIAL_SAC_CODE,
  OFFICIAL_PROPRIETOR,
  OFFICIAL_EMAIL,
  OFFICIAL_HELPLINE,
  OFFICIAL_REGISTERED_ADDRESS,
  OFFICIAL_LOGO_URL,
  OFFICIAL_BANNER_URL,
  OFFICIAL_SIGNATURE_URL,
} from '../types/safar';
import {
  bookingToStandardBillDraft,
  calculateOlaRouteDistance,
  downloadBillAsPdf,
  shareBillPdfOnWhatsApp,
  getFormattedDigitalSignTimestamp,
  loadCleanSignaturePngDataUrl,
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
  Navigation,
  Calendar,
} from 'lucide-react';

interface BillGeneratorModuleProps {
  bookings: Booking[];
  initialBooking?: Booking | null;
  onShowToast: (msg: string) => void;
}

const DEFAULT_CUSTOM_BILL: CustomBillDraft = {
  invoiceNumber: 'SIC-2026-5442',
  bookingId: 'SIC-5442',
  invoiceDate: new Date().toISOString().slice(0, 10),
  customerName: 'Rohit kumar',
  customerPhone: '+91 9990710871',
  customerEmail: OFFICIAL_EMAIL,
  customerGstin: '',
  billingCompanyName: '',
  tripType: 'Round Trip Outstation',
  sameDayReturn: true,
  pickupCity: 'Nathupura Burari 110084',
  dropCity: 'Dera Bassi Punjab',
  pickupDate: new Date().toISOString().slice(0, 10),
  pickupTime: '08:30 AM',
  vehicleCategory: 'Sedan',
  vehicleModel: 'Swift Dzire / Toyota Etios',
  vehicleNumber: 'HR55BE6324',
  driverName: 'NITISH KUMAR',
  driverPhone: '+91 9818944089',
  distanceKm: 460,
  tripDays: 1,
  perKmRate: 14,
  baseFare: 6440,
  driverAllowance: 350,
  tollTax: 510,
  stateTax: 550,
  nightCharges: 0,
  parkingTollExtra: 0,
  marketDiscount: 200,
  includeGst: true,
  gstPercentage: 5,
  advancePaid: 8033,
  paymentMode: 'Full Paid',
  includeMohurStamp: true,
  includeDigitalSign: true,
  authorizedSignatoryName: OFFICIAL_PROPRIETOR,
  digitalSignatureTimestamp: getFormattedDigitalSignTimestamp(),
  notes: `Registered Office: ${OFFICIAL_REGISTERED_ADDRESS}. Helpline: ${OFFICIAL_HELPLINE}. Subject to North Delhi Jurisdiction.`,
};

function computeDraftTotals(d: CustomBillDraft) {
  const baseCabFare = Math.max(0, Number(d.baseFare || 0));
  const driverAllowanceAmt = Math.max(0, Number(d.driverAllowance || 0));
  const highwayTollAmt = Math.max(0, Number(d.tollTax || 0));
  const statePermitAmt = Math.max(0, Number(d.stateTax || 0));
  const nightChargeAmt = Math.max(0, Number(d.nightCharges || 0));
  const parkingExtraAmt = Math.max(0, Number(d.parkingTollExtra || 0));
  const discountAmt = Math.max(0, Number(d.marketDiscount || 0));

  const taxableAmount = Math.max(
    0,
    baseCabFare +
      driverAllowanceAmt +
      highwayTollAmt +
      statePermitAmt +
      nightChargeAmt +
      parkingExtraAmt -
      discountAmt
  );
  const gstAmount = d.includeGst
    ? Math.round(taxableAmount * (Number(d.gstPercentage || 5) / 100))
    : 0;
  const cgst = Math.round(gstAmount / 2);
  const sgst = gstAmount - cgst;
  const grandTotal = taxableAmount + gstAmount;
  return {
    baseCabFare,
    driverAllowanceAmt,
    highwayTollAmt,
    statePermitAmt,
    nightChargeAmt,
    parkingExtraAmt,
    discountAmt,
    taxableAmount,
    gstAmount,
    cgst,
    sgst,
    grandTotal,
  };
}

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
  const [settlementPreset, setSettlementPreset] = useState<
    'full' | 'advance20' | 'custom'
  >('full');
  const [showBannerInBill, setShowBannerInBill] = useState(false);
  const [detectingKm, setDetectingKm] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sharingPdfWa, setSharingPdfWa] = useState(false);
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

  useEffect(() => {
    if (initialBooking) {
      const nextDraft = bookingToStandardBillDraft(initialBooking);
      setDraft(nextDraft);
      setSettlementPreset(
        initialBooking.paymentMode === 'Full Paid' ? 'full' : 'advance20'
      );
    }
  }, [initialBooking]);

  const syncAdvanceWithPreset = (
    nextDraft: CustomBillDraft,
    preset = settlementPreset
  ): CustomBillDraft => {
    const totals = computeDraftTotals(nextDraft);
    if (preset === 'full') {
      return {
        ...nextDraft,
        paymentMode: 'Full Paid',
        advancePaid: totals.grandTotal,
      };
    }
    if (preset === 'advance20') {
      return {
        ...nextDraft,
        paymentMode: '20% Advance',
        advancePaid: Math.round(totals.grandTotal * 0.2),
      };
    }
    return nextDraft;
  };

  const updateField = <K extends keyof CustomBillDraft>(
    key: K,
    value: CustomBillDraft[K]
  ) => {
    setDraft((prev) => {
      let next: CustomBillDraft = { ...prev, [key]: value };

      if (key === 'distanceKm' || key === 'perKmRate') {
        next.baseFare = Math.round(
          Math.max(0, Number(next.distanceKm)) *
            Math.max(0, Number(next.perKmRate))
        );
      }

      if (key === 'tripType') {
        const nextType = value as TripType;
        if (nextType === 'Round Trip Outstation') {
          // Always default Round Trip to 1 Day (Same Day Return) instead of forcing 2 days
          next.tripDays = 1;
          next.sameDayReturn = true;
        } else if (nextType === 'One Way Outstation') {
          next.tripDays = 1;
          next.sameDayReturn = false;
        } else if (nextType === 'Local 8Hr/80Km') {
          next.tripDays = 1;
          next.distanceKm = 80;
          next.sameDayReturn = true;
          next.baseFare = Math.round(80 * Number(next.perKmRate));
        } else if (nextType === 'Airport Transfer') {
          next.tripDays = 1;
          next.sameDayReturn = true;
        }
      }

      if (key === 'tripDays') {
        const days = Math.max(1, Number(value));
        next.tripDays = days;
        next.sameDayReturn =
          next.tripType === 'Round Trip Outstation' && days === 1;
      }

      if (key === 'vehicleCategory') {
        const cat = value as VehicleCategory;
        next.vehicleModel =
          cat === 'Sedan'
            ? 'Swift Dzire / Toyota Etios'
            : cat === 'SUV'
            ? 'Maruti Ertiga / Kia Carens'
            : cat === 'Innova Crysta'
            ? 'Toyota Innova Crysta 7+1'
            : 'Maruti WagonR / Celerio';
      }

      if (key === 'invoiceDate') {
        next.digitalSignatureTimestamp = getFormattedDigitalSignTimestamp(
          String(value)
        );
      }

      // If any fare breakup field changed and preset is 'full' or 'advance20', keep settled amount synced
      if (
        key === 'distanceKm' ||
        key === 'perKmRate' ||
        key === 'baseFare' ||
        key === 'driverAllowance' ||
        key === 'tollTax' ||
        key === 'stateTax' ||
        key === 'nightCharges' ||
        key === 'parkingTollExtra' ||
        key === 'marketDiscount' ||
        key === 'includeGst' ||
        key === 'gstPercentage'
      ) {
        next = syncAdvanceWithPreset(next, settlementPreset);
      }

      return next;
    });
  };

  const handleDetectRouteKm = async () => {
    if (!draft.pickupCity.trim() || !draft.dropCity.trim()) return;
    setDetectingKm(true);
    try {
      const res = await calculateOlaRouteDistance(
        draft.pickupCity,
        draft.dropCity,
        draft.tripType
      );
      setDraft((prev) => {
        const nextKm = res.recommendedTripDistanceKm;
        const nextBase = Math.round(nextKm * Number(prev.perKmRate));
        const next = syncAdvanceWithPreset(
          {
            ...prev,
            distanceKm: nextKm,
            // Preserve Same Day (1 Day) if already 1 Day or recommended 1 Day
            tripDays: prev.tripDays === 1 ? 1 : res.recommendedDays,
            sameDayReturn:
              prev.tripType === 'Round Trip Outstation' &&
              (prev.tripDays === 1 || res.recommendedDays === 1),
            baseFare: nextBase,
          },
          settlementPreset
        );
        return next;
      });
      onShowToast(
        `Detected ${res.recommendedTripDistanceKm} KM (${res.oneWayDistanceKm} KM One-Way) via ${res.source}.`
      );
    } finally {
      setDetectingKm(false);
    }
  };

  const totals = computeDraftTotals(draft);
  const {
    baseCabFare,
    driverAllowanceAmt,
    highwayTollAmt,
    statePermitAmt,
    nightChargeAmt,
    parkingExtraAmt,
    discountAmt,
    taxableAmount,
    cgst,
    sgst,
    grandTotal,
  } = totals;

  const settledAmount = Math.min(
    grandTotal,
    Math.max(0, Number(draft.advancePaid))
  );
  const balanceDue = Math.max(0, grandTotal - settledAmount);
  const isPaidInFull = balanceDue === 0;

  const durationDisplay =
    draft.tripType === 'Round Trip Outstation' && Number(draft.tripDays) === 1
      ? '1 Day (Same Day Return)'
      : `${draft.tripDays} Day(s)`;

  const digitalSignTimestamp =
    draft.digitalSignatureTimestamp ||
    getFormattedDigitalSignTimestamp(draft.invoiceDate);

  // Build dynamic itemized rows with sequential S.NO so every component is crystal clear
  const itemizedRows: Array<{
    sno: number;
    description: string;
    sac: string;
    amount: string;
    isDiscount?: boolean;
  }> = [];

  itemizedRows.push({
    sno: itemizedRows.length + 1,
    description: `Cab Hire / Base Trip Charges (${draft.tripType}${
      draft.tripType === 'Round Trip Outstation' && Number(draft.tripDays) === 1
        ? ' • Same Day Return'
        : ''
    } — ${draft.pickupCity} to ${draft.dropCity} · ${draft.distanceKm} KM @ ₹${draft.perKmRate}/KM)`,
    sac: OFFICIAL_SAC_CODE,
    amount: formatINRDecimal(baseCabFare),
  });

  itemizedRows.push({
    sno: itemizedRows.length + 1,
    description: `Chauffeur / Driver Allowance (Bata — ${durationDisplay})`,
    sac: OFFICIAL_SAC_CODE,
    amount: formatINRDecimal(driverAllowanceAmt),
  });

  itemizedRows.push({
    sno: itemizedRows.length + 1,
    description: 'Highway / Fastag Toll Tax Charges',
    sac: OFFICIAL_SAC_CODE,
    amount: formatINRDecimal(highwayTollAmt),
  });

  itemizedRows.push({
    sno: itemizedRows.length + 1,
    description: 'Inter-State Entry Permit & State Tax Charges',
    sac: OFFICIAL_SAC_CODE,
    amount: formatINRDecimal(statePermitAmt),
  });

  if (nightChargeAmt > 0) {
    itemizedRows.push({
      sno: itemizedRows.length + 1,
      description: 'Night Driving Allowance Charges',
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(nightChargeAmt),
    });
  }

  if (parkingExtraAmt > 0) {
    itemizedRows.push({
      sno: itemizedRows.length + 1,
      description: 'Airport / Parking / Other Extra Charges',
      sac: OFFICIAL_SAC_CODE,
      amount: formatINRDecimal(parkingExtraAmt),
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
          `Generated & downloaded real PDF (${res.fileName}) + sent itemized WhatsApp Cloud API invoice to ${draft.customerPhone}.`
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Corporate Tax Invoice Studio (Itemized Breakup, Seal & Signature)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Official {OFFICIAL_COMPANY_NAME} Tax Invoices · Separate Breakup for Base Fare, Driver Allowance, Highway Toll & State Tax · GSTIN:{' '}
            <strong className="font-mono font-bold text-slate-900 dark:text-white">
              {OFFICIAL_GSTIN}
            </strong>
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
              Load Details from Live Customer Booking (or Edit Custom Below)
            </label>
            <div className="flex items-center gap-2">
              <select
                id="select-booking-prefill"
                value={draft.bookingId}
                onChange={(e) => {
                  const found = bookings.find(
                    (b) =>
                      b.bookingId === e.target.value ||
                      `SIC-${b.bookingId.replace(/\D/g, '')}` === e.target.value
                  );
                  if (found) {
                    const loaded = bookingToStandardBillDraft(found);
                    setDraft(loaded);
                    setSettlementPreset(
                      found.paymentMode === 'Full Paid' ? 'full' : 'advance20'
                    );
                    onShowToast(
                      `Loaded bill details from booking ${found.bookingId} (${found.customerName}).`
                    );
                  }
                }}
                className="flex-1 px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {bookings.length === 0 ? (
                  <option value={draft.bookingId}>
                    Custom Invoice Mode ({draft.invoiceNumber})
                  </option>
                ) : (
                  bookings.map((b) => (
                    <option
                      key={b.bookingId}
                      value={`SIC-${b.bookingId.replace(/\D/g, '')}`}
                    >
                      {b.bookingId} — {b.customerName} ({b.pickupCity} →{' '}
                      {b.dropCity})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => {
                  const randomNum = Math.floor(5400 + Math.random() * 900);
                  setSettlementPreset('full');
                  setDraft({
                    ...DEFAULT_CUSTOM_BILL,
                    bookingId: `SIC-${randomNum}`,
                    invoiceNumber: `SIC-2026-${randomNum}`,
                    tripDays: 1,
                    sameDayReturn: true,
                    digitalSignatureTimestamp: getFormattedDigitalSignTimestamp(),
                  });
                  onShowToast('Reset to fresh Same-Day Round Trip invoice draft.');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Blank Bill</span>
              </button>
            </div>
          </div>

          {/* Official Seal & Digital Signature Controls */}
          <div className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Official Rectangular Seal & Digital Signature Controls
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  updateField('includeMohurStamp', !draft.includeMohurStamp)
                }
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                  draft.includeMohurStamp
                    ? 'bg-slate-900 text-white dark:bg-blue-950/60 border-slate-900 dark:border-blue-700 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-500'
                }`}
              >
                <Stamp className="w-4 h-4 shrink-0" />
                <span>
                  Official Seal: {draft.includeMohurStamp ? 'ON' : 'OFF'}
                </span>
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
                <span>
                  5% GST Tax: {draft.includeGst ? 'Included' : 'Non-GST'}
                </span>
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
                <span>
                  Wide Banner: {showBannerInBill ? 'Shown' : 'Compact'}
                </span>
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

          {/* Route, Trip Category, Same-Day Return Option & Chauffeur Fields */}
          <div className="space-y-3 text-xs pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                Journey Route, Same-Day / Multi-Day & Chauffeur Details
              </span>
              <button
                type="button"
                disabled={detectingKm}
                onClick={handleDetectRouteKm}
                className="px-2.5 py-1 text-[11px] font-extrabold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3 h-3" />
                <span>
                  {detectingKm ? 'Detecting KM...' : 'Auto-Detect KM'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pickup Location
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
                  Drop Location
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

              {/* Trip Duration / Round Trip Same Day Selector */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Trip Duration (Same Day / Days)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateField('tripDays', 1)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border cursor-pointer whitespace-nowrap transition-colors ${
                      Number(draft.tripDays) === 1
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Same Day (1 Day)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('tripDays', 2)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-extrabold border cursor-pointer whitespace-nowrap transition-colors ${
                      Number(draft.tripDays) === 2
                        ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 border-slate-900'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    2 Days
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={draft.tripDays}
                    onChange={(e) =>
                      updateField(
                        'tripDays',
                        Math.max(1, Number(e.target.value))
                      )
                    }
                    title="Custom Trip Days"
                    className="w-14 px-2 py-1.5 text-center font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Travel / Pickup Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={draft.pickupDate}
                    onChange={(e) => updateField('pickupDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pickup Time
                </label>
                <input
                  type="text"
                  value={draft.pickupTime}
                  onChange={(e) => updateField('pickupTime', e.target.value)}
                  placeholder="e.g. 08:30 AM"
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
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
                  Car Model Name
                </label>
                <input
                  type="text"
                  value={draft.vehicleModel}
                  onChange={(e) => updateField('vehicleModel', e.target.value)}
                  placeholder="Swift Dzire / Toyota Etios"
                  className="w-full px-2.5 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Reg. Number
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
                  Chauffeur Name & Mobile
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={draft.driverName}
                    onChange={(e) => updateField('driverName', e.target.value)}
                    placeholder="Driver Name"
                    className="w-full px-2 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="text"
                    value={draft.driverPhone}
                    onChange={(e) => updateField('driverPhone', e.target.value)}
                    placeholder="+91 Mobile"
                    className="w-full px-2 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Fare Breakup Inputs (Separate Base Fare, Driver Allowance, Highway Toll, State Tax, Night, Parking, Discount) */}
          <div className="space-y-3 text-xs pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                Itemized Bill Breakup (Shown Separately on Invoice)
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                Grand Total: {formatINR(grandTotal)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  1. Base Cab Fare (₹)
                </label>
                <input
                  type="number"
                  value={draft.baseFare}
                  onChange={(e) =>
                    updateField('baseFare', Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-amber-50/60 dark:bg-slate-950 border-2 border-amber-400 dark:border-amber-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Driver Allowance (₹)
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
                  3. Highway Toll Tax (₹)
                </label>
                <input
                  type="number"
                  value={draft.tollTax}
                  onChange={(e) =>
                    updateField('tollTax', Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  4. State Permit Tax (₹)
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
                  5. Night Charge (₹)
                </label>
                <input
                  type="number"
                  value={draft.nightCharges}
                  onChange={(e) =>
                    updateField('nightCharges', Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  6. Parking / Extra (₹)
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
                <label className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  7. Discount Less (₹)
                </label>
                <input
                  type="number"
                  value={draft.marketDiscount}
                  onChange={(e) =>
                    updateField('marketDiscount', Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-emerald-50/50 dark:bg-slate-950 border border-emerald-400 dark:border-emerald-700 rounded-lg text-emerald-800 dark:text-emerald-300"
                />
              </div>
            </div>

            {/* Payment Settlement Mode & Amount Settled */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  Invoice Settlement Status
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementPreset('full');
                      setDraft((prev) => syncAdvanceWithPreset(prev, 'full'));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      settlementPreset === 'full'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    100% Paid in Full
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementPreset('advance20');
                      setDraft((prev) =>
                        syncAdvanceWithPreset(prev, 'advance20')
                      );
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      settlementPreset === 'advance20'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    20% Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementPreset('custom')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      settlementPreset === 'custom'
                        ? 'bg-slate-900 text-white dark:bg-slate-700'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Custom Settled
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount Settled / Received (₹)
                  </label>
                  <input
                    type="number"
                    value={draft.advancePaid}
                    onChange={(e) => {
                      setSettlementPreset('custom');
                      updateField('advancePaid', Number(e.target.value));
                    }}
                    className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
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
                    className="w-full px-2.5 py-1.5 font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Branded Invoice Paper Preview (WITH SEPARATE ITEMIZED BREAKUP) */}
        <div className="lg:col-span-7 bg-white border-2 border-slate-300 rounded-xl shadow-md overflow-hidden text-slate-900">
          {/* Top Dual-Tone Bar: Left 68% Dark Slate/Navy, Right 32% Warm Amber/Gold */}
          <div className="flex w-full h-2.5">
            <div className="w-[68%] bg-slate-900" />
            <div className="w-[32%] bg-amber-600" />
          </div>

          {showBannerInBill && (
            <div className="w-full h-32 overflow-hidden border-b border-slate-200">
              <img
                src={OFFICIAL_BANNER_URL}
                alt="Safar India Cabs Banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-5 sm:p-7 space-y-4">
            {/* Header Section: Left Logo + Company Details | Right GST TAX INVOICE Card */}
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

              {/* Right GST TAX INVOICE Card */}
              <div className="sm:w-64 shrink-0 rounded-xl border border-slate-300 overflow-hidden bg-white">
                <div className="bg-amber-100/90 border-b border-amber-300 py-1.5 px-3 text-center text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                  {draft.includeGst ? 'GST TAX INVOICE' : 'OFFICIAL TRIP INVOICE'}
                </div>
                <div className="p-3 space-y-1 text-xs">
                  <div className="font-extrabold text-slate-900 text-sm">
                    Invoice No: {draft.invoiceNumber}
                  </div>
                  <div className="text-slate-700">
                    Invoice Date: {draft.invoiceDate}
                  </div>
                  <div className="text-slate-700">
                    Duty / Ref ID: {draft.bookingId}
                  </div>
                  <div className="text-slate-700">
                    SAC Code: {OFFICIAL_SAC_CODE} (Cab Service)
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column Summary Cards: BILLED TO & VEHICLE, CHAUFFEUR & JOURNEY SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-300 overflow-hidden bg-white">
                <div className="bg-slate-100 border-b border-slate-300 px-3.5 py-2 font-extrabold text-slate-900 uppercase text-[11px] tracking-wide">
                  BILLED TO (PASSENGER / CORPORATE DETAILS)
                </div>
                <div className="p-3.5 space-y-1">
                  <div className="text-sm font-extrabold text-slate-900">
                    {draft.customerName}
                  </div>
                  <div className="text-slate-700">
                    Mobile: {draft.customerPhone}
                  </div>
                  {draft.billingCompanyName && (
                    <div className="font-semibold text-slate-800">
                      Company: {draft.billingCompanyName}
                    </div>
                  )}
                  {draft.customerGstin && (
                    <div className="font-mono font-bold text-slate-900">
                      Customer GSTIN: {draft.customerGstin}
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
                    Vehicle: {draft.vehicleCategory} AC (
                    {draft.vehicleModel || 'Swift Dzire / Toyota Etios'})
                  </div>
                  <div className="text-slate-700">
                    Vehicle Reg. No: {draft.vehicleNumber} &nbsp;|&nbsp; Duty:{' '}
                    {draft.tripType}
                  </div>
                  <div className="text-slate-700">
                    Chauffeur: {draft.driverName} ({draft.driverPhone})
                  </div>
                  <div className="text-slate-700">
                    Travel Date: {draft.pickupDate} at {draft.pickupTime}
                  </div>
                  <div className="text-slate-700 font-semibold">
                    Total Distance: {draft.distanceKm} KM &nbsp;|&nbsp;
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
                <span className="text-slate-800">{draft.pickupCity}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-slate-900 w-36 shrink-0">
                  DROP LOCATION:
                </span>
                <span className="text-slate-800">{draft.dropCity}</span>
              </div>
            </div>

            {/* 4-Column Itemized Service Breakup Table */}
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
                      <td className="py-2 px-3 font-medium">
                        {row.description}
                      </td>
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
                      {formatINRDecimal(taxableAmount)}
                    </td>
                  </tr>
                  {draft.includeGst && (
                    <>
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
                    </>
                  )}
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

            {/* Bottom 3-Column Footer Box (Declaration & Terms | Digital Signature | Rectangular Stamp + Pre-Filled Aman Mishra Signature) */}
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
                  5. Official Tax Invoice for Official / Personal Travel Claim
                  & Company Reimbursement.
                </div>
              </div>

              {/* Column 2: Digitally Signed Block */}
              <div className="sm:col-span-3 p-3.5 flex flex-col justify-between text-[11px] leading-snug text-slate-800">
                {draft.includeDigitalSign ? (
                  <>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">
                        Digitally signed by {OFFICIAL_LEGAL_NAME}
                      </div>
                      <div className="font-semibold text-slate-900">
                        (
                        {(
                          draft.authorizedSignatoryName || OFFICIAL_PROPRIETOR
                        ).toUpperCase()}
                        )
                      </div>
                      <div>GSTIN: {OFFICIAL_GSTIN}</div>
                      <div>Date: {digitalSignTimestamp}</div>
                      <div>Location: IN (North Delhi)</div>
                    </div>
                    <div className="pt-3 text-[10px] font-extrabold tracking-widest text-emerald-700 uppercase">
                      • Digitally Verified Tax Invoice
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 italic">
                    Digital signature disabled
                  </div>
                )}
              </div>

              {/* Column 3: For SAFARINDIACABS + Rectangular Stamp + Pre-Filled Aman Mishra Signature */}
              <div className="sm:col-span-4 p-3.5 flex flex-col items-center justify-between text-center">
                <div className="font-extrabold text-slate-900 text-xs">
                  For {OFFICIAL_LEGAL_NAME}
                </div>

                {/* Rectangular Official Stamp + Pre-filled Aman Mishra Signature Overlaid */}
                <div className="relative my-2 w-full max-w-[210px] flex items-center justify-center min-h-[82px]">
                  {draft.includeMohurStamp && (
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
                  )}

                  {/* Pre-Filled Handwritten Signature of Aman Mishra */}
                  <img
                    src={cleanSignUrl}
                    alt="Aman Mishra Official Signature"
                    className="absolute inset-x-2 top-5 h-12 w-[calc(100%-16px)] object-contain pointer-events-none select-none"
                  />
                </div>

                <div>
                  <div className="font-extrabold text-slate-900 text-xs">
                    Prop. {draft.authorizedSignatoryName || OFFICIAL_PROPRIETOR}
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
    </section>
  );
};
