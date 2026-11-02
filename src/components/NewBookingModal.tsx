import React, { useState, useMemo } from 'react';
import {
  Booking,
  TariffPlan,
  VehicleCategory,
  TripType,
  PaymentMode,
  BLUEPRINT_CONSTRAINTS,
  sanitizeString,
  clampNumber,
  formatINR,
} from '../types/safar';
import { X, PlusCircle } from 'lucide-react';

interface NewBookingModalProps {
  tariffs: TariffPlan[];
  existingBookingIds: string[];
  onClose: () => void;
  onCreateBooking: (
    bookingData: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  tariffs,
  existingBookingIds,
  onClose,
  onCreateBooking,
}) => {
  const nextBookingId = useMemo(() => {
    let maxNum = 2606;
    existingBookingIds.forEach((id) => {
      const num = parseInt(id.replace('SIC', ''), 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `SIC${maxNum + 1}`;
  }, [existingBookingIds]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [tripType, setTripType] = useState<TripType>('Round Trip Outstation');
  const [pickupCity, setPickupCity] = useState('New Delhi');
  const [dropCity, setDropCity] = useState('Agra (UP)');
  const [pickupDate, setPickupDate] = useState('2026-11-04');
  const [pickupTime, setPickupTime] = useState('07:00 AM');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('Sedan');
  const [distanceKm, setDistanceKm] = useState(450);
  const [tripDays, setTripDays] = useState(2);
  const [includeNightCharge, setIncludeNightCharge] = useState(false);
  const [includeStateTax, setIncludeStateTax] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('20% Advance');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedTariff = useMemo(() => {
    return (
      tariffs.find((t) => t.vehicleCategory === vehicleCategory) || {
        categoryId: 'sedan',
        vehicleCategory: 'Sedan' as VehicleCategory,
        sampleModels: 'Swift Dzire, Etios',
        seatingCapacity: 4,
        baseRatePerKm: 13,
        oneWayRatePerKm: 15,
        minKmPerDay: 250,
        driverAllowancePerDay: 350,
        nightChargeDefault: 300,
        stateTaxDefault: 550,
        gstPercentage: 5,
        marketDiscountEnabled: true,
        marketDiscountAmount: 200,
      }
    );
  }, [tariffs, vehicleCategory]);

  const fareCalculation = useMemo(() => {
    const safeDays = clampNumber(tripDays, 1, 90);
    const minBillableKm =
      tripType === 'Round Trip Outstation'
        ? selectedTariff.minKmPerDay * safeDays
        : selectedTariff.minKmPerDay;
    const billableKm = Math.max(clampNumber(distanceKm, 1, 25000), minBillableKm);
    const perKmRate =
      tripType === 'One Way Outstation'
        ? selectedTariff.oneWayRatePerKm
        : selectedTariff.baseRatePerKm;

    const baseFare = Math.round(billableKm * perKmRate);
    const driverAllowance = Math.round(selectedTariff.driverAllowancePerDay * safeDays);
    const stateTax = includeStateTax ? Math.round(selectedTariff.stateTaxDefault) : 0;
    const nightCharges = includeNightCharge ? Math.round(selectedTariff.nightChargeDefault) : 0;
    const marketDiscount = selectedTariff.marketDiscountEnabled
      ? Math.round(selectedTariff.marketDiscountAmount)
      : 0;

    const taxableSubTotal = Math.max(
      0,
      baseFare + driverAllowance + stateTax + nightCharges - marketDiscount
    );
    const gstAmount = Math.round(taxableSubTotal * (selectedTariff.gstPercentage / 100));
    const totalFare = taxableSubTotal + gstAmount;
    const advancePaid =
      paymentMode === 'Full Paid' ? totalFare : Math.round(totalFare * 0.2);
    const balanceAmount = Math.max(0, totalFare - advancePaid);

    return {
      billableKm,
      safeDays,
      perKmRate,
      baseFare,
      driverAllowance,
      stateTax,
      nightCharges,
      marketDiscount,
      gstAmount,
      totalFare,
      advancePaid,
      balanceAmount,
    };
  }, [
    distanceKm,
    tripDays,
    tripType,
    selectedTariff,
    includeStateTax,
    includeNightCharge,
    paymentMode,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeString(customerName, BLUEPRINT_CONSTRAINTS.MAX_CUSTOMER_NAME);
    const cleanPhone = sanitizeString(customerPhone, BLUEPRINT_CONSTRAINTS.MAX_PHONE);
    const cleanEmail = sanitizeString(customerEmail, BLUEPRINT_CONSTRAINTS.MAX_EMAIL);
    const cleanGstin = sanitizeString(
      customerGstin.toUpperCase(),
      BLUEPRINT_CONSTRAINTS.MAX_GSTIN
    );
    const cleanPickup = sanitizeString(pickupCity, BLUEPRINT_CONSTRAINTS.MAX_CITY);
    const cleanDrop = sanitizeString(dropCity, BLUEPRINT_CONSTRAINTS.MAX_CITY);

    if (cleanName.length < 2) {
      setErrorMsg('Customer name must be at least 2 characters.');
      return;
    }
    if (!BLUEPRINT_CONSTRAINTS.PHONE_REGEX.test(cleanPhone)) {
      setErrorMsg('Enter a valid 10-digit Indian phone number (e.g. +91 98114 27650).');
      return;
    }
    if (cleanEmail.length < 5 || !cleanEmail.includes('@')) {
      setErrorMsg('Enter a valid customer email address.');
      return;
    }
    if (!BLUEPRINT_CONSTRAINTS.DATE_REGEX.test(pickupDate)) {
      setErrorMsg('Pickup date must be in YYYY-MM-DD format.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreateBooking({
        bookingId: nextBookingId,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerEmail: cleanEmail,
        customerGstin: cleanGstin,
        tripType,
        pickupCity: cleanPickup,
        dropCity: cleanDrop,
        pickupDate,
        pickupTime,
        vehicleCategory,
        distanceKm: fareCalculation.billableKm,
        tripDays: fareCalculation.safeDays,
        perKmRate: fareCalculation.perKmRate,
        baseFare: fareCalculation.baseFare,
        driverAllowance: fareCalculation.driverAllowance,
        stateTax: fareCalculation.stateTax,
        nightCharges: fareCalculation.nightCharges,
        marketDiscount: fareCalculation.marketDiscount,
        gstAmount: fareCalculation.gstAmount,
        totalFare: fareCalculation.totalFare,
        paymentMode,
        advancePaid: fareCalculation.advancePaid,
        balanceAmount: fareCalculation.balanceAmount,
        status: 'Pending',
        driverName: '',
        driverPhone: '',
        vehicleNumber: '',
        vehicleModel: '',
        invoiceNumber: '',
        invoiceReady: false,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
              Create Customer Booking · {nextBookingId}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Computes live fare using active Outstation Tariff & ₹200 Market Discount rules
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rohit Khanna"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Customer Mobile Number *
              </label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98112 34567"
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Customer Email *
              </label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="rohit.khanna@company.in"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Customer GSTIN (Optional)
              </label>
              <input
                type="text"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                placeholder="07AABCK1234F1Z5"
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Trip Type
              </label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Round Trip Outstation">Round Trip Outstation</option>
                <option value="One Way Outstation">One Way Outstation</option>
                <option value="Local 8Hr/80Km">Local 8Hr/80Km</option>
                <option value="Airport Transfer">Airport Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Vehicle Class
              </label>
              <select
                value={vehicleCategory}
                onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Innova Crysta">Innova Crysta</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Advance Plan
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="20% Advance">20% Advance</option>
                <option value="Full Paid">Full Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Pickup City
              </label>
              <input
                type="text"
                required
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Drop City
              </label>
              <input
                type="text"
                required
                value={dropCity}
                onChange={(e) => setDropCity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Pickup Date
              </label>
              <input
                type="date"
                required
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Pickup Time
              </label>
              <input
                type="text"
                required
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Est. Distance (KM)
              </label>
              <input
                type="number"
                min={50}
                max={20000}
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={tripDays}
                onChange={(e) => setTripDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStateTax}
                onChange={(e) => setIncludeStateTax(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Include State Permit Tax ({formatINR(selectedTariff.stateTaxDefault)})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNightCharge}
                onChange={(e) => setIncludeNightCharge(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Include Night Driving Allowance ({formatINR(selectedTariff.nightChargeDefault)})</span>
            </label>
          </div>

          {/* Computed Tariff Summary */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400">
                Base Fare ({fareCalculation.billableKm} KM)
              </div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatINR(fareCalculation.baseFare)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">DA + Taxes + Night</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatINR(
                  fareCalculation.driverAllowance +
                    fareCalculation.stateTax +
                    fareCalculation.nightCharges
                )}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Market Discount & 5% GST</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                -{formatINR(fareCalculation.marketDiscount)} / +{formatINR(fareCalculation.gstAmount)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">
                Total Payable ({paymentMode})
              </div>
              <div className="font-mono font-bold text-slate-900 dark:text-amber-400 text-sm mt-0.5">
                {formatINR(fareCalculation.totalFare)} (Adv: {formatINR(fareCalculation.advancePaid)})
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving Booking...' : 'Create Customer Booking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
