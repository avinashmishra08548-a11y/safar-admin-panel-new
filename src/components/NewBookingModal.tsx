import React, { useState, useMemo } from 'react';
import {
  Booking,
  TariffPlan,
  FleetDriver,
  VehicleCategory,
  TripType,
  PaymentMode,
  BookingStatus,
  BLUEPRINT_CONSTRAINTS,
  sanitizeString,
  clampNumber,
  formatINR,
} from '../types/safar';
import {
  X,
  PlusCircle,
  Car,
  UserCheck,
  Calculator,
  Sparkles,
  CheckCircle2,
  MapPin,
  Phone,
  User,
} from 'lucide-react';

interface NewBookingModalProps {
  tariffs: TariffPlan[];
  fleetDrivers?: FleetDriver[];
  existingBookingIds: string[];
  onClose: () => void;
  onCreateBooking: (
    bookingData: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

/**
 * Normalizes any Indian mobile input (e.g. "9811427650", "09811427650", "+919811427650")
 * into "+91 XXXXX XXXXX" (15 chars) which strictly satisfies BLUEPRINT_CONSTRAINTS.PHONE_REGEX.
 */
export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let tenDigits = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  } else if (digits.length > 10) {
    tenDigits = digits.slice(-10);
  }
  if (tenDigits.length === 10) {
    return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5, 10)}`;
  }
  return raw.trim();
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  tariffs,
  fleetDrivers = [],
  existingBookingIds,
  onClose,
  onCreateBooking,
}) => {
  const nextBookingId = useMemo(() => {
    let maxNum = 2606;
    existingBookingIds.forEach((id) => {
      const num = parseInt(id.replace(/\D/g, ''), 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `SIC${maxNum + 1}`;
  }, [existingBookingIds]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [tripType, setTripType] = useState<TripType>('Round Trip Outstation');
  const [pickupCity, setPickupCity] = useState('New Delhi');
  const [dropCity, setDropCity] = useState('Agra (UP)');
  const [pickupDate, setPickupDate] = useState(todayIso);
  const [pickupTime, setPickupTime] = useState('07:00 AM');
  const [vehicleCategory, setVehicleCategory] =
    useState<VehicleCategory>('Sedan');
  const [distanceKm, setDistanceKm] = useState(450);
  const [tripDays, setTripDays] = useState(2);
  const [includeNightCharge, setIncludeNightCharge] = useState(false);
  const [includeStateTax, setIncludeStateTax] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('20% Advance');

  // Custom Fare Override Support
  const [useCustomFare, setUseCustomFare] = useState(false);
  const [customTotalFare, setCustomTotalFare] = useState<number>(6500);
  const [customAdvancePaid, setCustomAdvancePaid] = useState<number>(1300);

  // Optional Immediate Driver Assignment inside Create Booking
  const [assignDriverNow, setAssignDriverNow] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('+91 ');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

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

  // Adjust sensible defaults when changing trip type
  const handleTripTypeChange = (nextType: TripType) => {
    setTripType(nextType);
    if (nextType === 'Local 8Hr/80Km') {
      setDistanceKm(80);
      setTripDays(1);
      setIncludeStateTax(false);
    } else if (nextType === 'Airport Transfer') {
      setDistanceKm(40);
      setTripDays(1);
      setIncludeStateTax(false);
    } else if (nextType === 'One Way Outstation') {
      setDistanceKm(260);
      setTripDays(1);
      setIncludeStateTax(true);
    } else {
      setDistanceKm(450);
      setTripDays(2);
      setIncludeStateTax(true);
    }
  };

  const fareCalculation = useMemo(() => {
    const safeDays = clampNumber(tripDays, 1, 90);
    const rawKm = clampNumber(distanceKm, 1, 25000);
    const minBillableKm =
      tripType === 'Round Trip Outstation'
        ? selectedTariff.minKmPerDay * safeDays
        : tripType === 'One Way Outstation'
        ? Math.min(150, selectedTariff.minKmPerDay)
        : rawKm;

    const billableKm =
      tripType === 'Local 8Hr/80Km' || tripType === 'Airport Transfer'
        ? rawKm
        : Math.max(rawKm, minBillableKm);

    const perKmRate =
      tripType === 'One Way Outstation'
        ? selectedTariff.oneWayRatePerKm
        : selectedTariff.baseRatePerKm;

    const computedBaseFare = Math.round(billableKm * perKmRate);
    const driverAllowance =
      tripType === 'Airport Transfer'
        ? 0
        : Math.round(selectedTariff.driverAllowancePerDay * safeDays);
    const stateTax = includeStateTax
      ? Math.round(selectedTariff.stateTaxDefault)
      : 0;
    const nightCharges = includeNightCharge
      ? Math.round(selectedTariff.nightChargeDefault)
      : 0;
    const marketDiscount = selectedTariff.marketDiscountEnabled
      ? Math.round(selectedTariff.marketDiscountAmount)
      : 0;

    if (useCustomFare) {
      const safeCustomTotal = clampNumber(customTotalFare, 100, 2000000);
      const gstAmount = Math.round(safeCustomTotal - safeCustomTotal / 1.05);
      const baseFare = Math.max(0, safeCustomTotal - gstAmount);
      const advancePaid =
        paymentMode === 'Full Paid'
          ? safeCustomTotal
          : clampNumber(customAdvancePaid, 0, safeCustomTotal);
      const balanceAmount = Math.max(0, safeCustomTotal - advancePaid);

      return {
        billableKm,
        safeDays,
        perKmRate,
        baseFare,
        driverAllowance: 0,
        stateTax: 0,
        nightCharges: 0,
        marketDiscount: 0,
        gstAmount,
        totalFare: safeCustomTotal,
        advancePaid,
        balanceAmount,
      };
    }

    const taxableSubTotal = Math.max(
      0,
      computedBaseFare +
        driverAllowance +
        stateTax +
        nightCharges -
        marketDiscount
    );
    const gstAmount = Math.round(
      taxableSubTotal * (selectedTariff.gstPercentage / 100)
    );
    const totalFare = taxableSubTotal + gstAmount;
    const advancePaid =
      paymentMode === 'Full Paid' ? totalFare : Math.round(totalFare * 0.2);
    const balanceAmount = Math.max(0, totalFare - advancePaid);

    return {
      billableKm,
      safeDays,
      perKmRate,
      baseFare: computedBaseFare,
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
    useCustomFare,
    customTotalFare,
    customAdvancePaid,
  ]);

  const matchingDrivers = useMemo(() => {
    const exact = fleetDrivers.filter(
      (d) => d.vehicleCategory === vehicleCategory
    );
    return exact.length > 0 ? exact : fleetDrivers.slice(0, 4);
  }, [fleetDrivers, vehicleCategory]);

  const handleSelectPoolDriver = (drv: FleetDriver) => {
    setAssignDriverNow(true);
    setDriverName(drv.driverName);
    setDriverPhone(drv.driverPhone);
    setVehicleNumber(drv.vehicleNumber);
    setVehicleModel(drv.vehicleModel);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = sanitizeString(
      customerName,
      BLUEPRINT_CONSTRAINTS.MAX_CUSTOMER_NAME
    );
    const normalizedPhone = normalizeIndianPhone(customerPhone);
    const cleanPhone = sanitizeString(
      normalizedPhone,
      BLUEPRINT_CONSTRAINTS.MAX_PHONE
    );

    // Default email if left blank so quick phone dispatch never fails
    const rawEmail = customerEmail.trim() || 'booking@safarindiacabs.com';
    const cleanEmail = sanitizeString(
      rawEmail,
      BLUEPRINT_CONSTRAINTS.MAX_EMAIL
    );
    const cleanGstin = sanitizeString(
      customerGstin.toUpperCase(),
      BLUEPRINT_CONSTRAINTS.MAX_GSTIN
    );
    const cleanPickup = sanitizeString(
      pickupCity,
      BLUEPRINT_CONSTRAINTS.MAX_CITY
    );
    const cleanDrop = sanitizeString(dropCity, BLUEPRINT_CONSTRAINTS.MAX_CITY);

    if (cleanName.length < 2) {
      setErrorMsg('Please enter Customer Name (at least 2 characters).');
      return;
    }
    if (!BLUEPRINT_CONSTRAINTS.PHONE_REGEX.test(cleanPhone)) {
      setErrorMsg(
        'Please enter a valid 10-digit mobile number (e.g. 9811427650 or +91 98114 27650).'
      );
      return;
    }
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      setErrorMsg(
        'Please enter a valid email or leave blank for default booking email.'
      );
      return;
    }
    if (! cleanPickup || !cleanDrop) {
      setErrorMsg('Please enter both Pickup City and Drop City.');
      return;
    }
    const safePickupDate = BLUEPRINT_CONSTRAINTS.DATE_REGEX.test(pickupDate)
      ? pickupDate
      : todayIso;

    let cleanDriverName = '';
    let cleanDriverPhone = '';
    let cleanVehicleNumber = '';
    let cleanVehicleModel = '';
    let initialStatus: BookingStatus = 'Pending';

    if (assignDriverNow && driverName.trim() && vehicleNumber.trim()) {
      cleanDriverName = sanitizeString(
        driverName,
        BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
      );
      cleanDriverPhone = sanitizeString(
        normalizeIndianPhone(driverPhone),
        BLUEPRINT_CONSTRAINTS.MAX_PHONE
      );
      cleanVehicleNumber = sanitizeString(
        vehicleNumber.toUpperCase(),
        BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
      );
      cleanVehicleModel = sanitizeString(
        vehicleModel || `${vehicleCategory} AC Cab`,
        BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL
      );
      initialStatus = 'Confirmed';
    }

    setSubmitting(true);
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
        pickupDate: safePickupDate,
        pickupTime: sanitizeString(pickupTime || '07:00 AM', 20),
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
        status: initialStatus,
        driverName: cleanDriverName,
        driverPhone: cleanDriverPhone,
        vehicleNumber: cleanVehicleNumber,
        vehicleModel: cleanVehicleModel,
        invoiceNumber: '',
        invoiceReady: false,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to save booking. Please check the fields and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-4 sm:my-8">
        {/* Bold Executive Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
              SIC
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white font-display flex items-center gap-2">
                <span>Create Customer Booking</span>
                <span className="px-2 py-0.5 text-xs font-mono font-extrabold bg-amber-500 text-slate-950 rounded-md">
                  {nextBookingId}
                </span>
              </h2>
              <p className="text-xs font-medium text-slate-300 mt-0.5">
                Instant sync with Dispatch Control Room, Customer Directory & GST Billing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/80 border-2 border-red-400 dark:border-red-700 rounded-xl text-xs font-bold text-red-800 dark:text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-amber-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                1. Customer & Contact Information
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                * Name & 10-Digit Mobile Required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rajeshwar Singhania"
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Customer Mobile Number * (10 Digits or +91)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onBlur={() =>
                      setCustomerPhone((prev) => normalizeIndianPhone(prev))
                    }
                    placeholder="+91 98114 27650"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Customer Email (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Optional (defaults to booking@safarindiacabs.com)"
                  className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Corporate Customer GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={customerGstin}
                  onChange={(e) =>
                    setCustomerGstin(e.target.value.toUpperCase())
                  }
                  placeholder="07AABCK1234F1Z5 (B2B Credit)"
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-bold uppercase bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Trip Route, Cab Category & Schedule */}
          <div className="space-y-3 pt-3 border-t-2 border-slate-100 dark:border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-amber-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              2. Route, Cab Class & Schedule
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Trip Category
                </label>
                <select
                  value={tripType}
                  onChange={(e) =>
                    handleTripTypeChange(e.target.value as TripType)
                  }
                  className="w-full px-3 py-2.5 text-sm font-bold border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Round Trip Outstation">
                    Round Trip Outstation
                  </option>
                  <option value="One Way Outstation">One Way Outstation</option>
                  <option value="Local 8Hr/80Km">Local 8Hr/80Km</option>
                  <option value="Airport Transfer">Airport Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Vehicle Category
                </label>
                <select
                  value={vehicleCategory}
                  onChange={(e) =>
                    setVehicleCategory(e.target.value as VehicleCategory)
                  }
                  className="w-full px-3 py-2.5 text-sm font-bold border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Hatchback">Hatchback (WagonR / Celerio)</option>
                  <option value="Sedan">Sedan (Swift Dzire / Etios)</option>
                  <option value="SUV">SUV (Ertiga / Carens 6+1)</option>
                  <option value="Innova Crysta">
                    Innova Crysta (7+1 Luxury)
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Payment Plan
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) =>
                    setPaymentMode(e.target.value as PaymentMode)
                  }
                  className="w-full px-3 py-2.5 text-sm font-bold border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="20% Advance">20% Advance Online</option>
                  <option value="Full Paid">100% Full Paid</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pickup City / Location *
                </label>
                <input
                  type="text"
                  required
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  placeholder="e.g. New Delhi (IGI T3 / Connaught Place)"
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Drop City / Destination *
                </label>
                <input
                  type="text"
                  required
                  value={dropCity}
                  onChange={(e) => setDropCity(e.target.value)}
                  placeholder="e.g. Agra / Manali / Jaipur"
                  className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pickup Date *
                </label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pickup Time *
                </label>
                <input
                  type="text"
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  placeholder="07:00 AM"
                  className="w-full px-3 py-2.5 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Est. Distance (KM)
                </label>
                <input
                  type="number"
                  min={1}
                  max={25000}
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Trip Duration (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={tripDays}
                  onChange={(e) => setTripDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing Mode (Auto Tariff vs Custom Fixed Deal Fare) */}
          <div className="space-y-3 pt-3 border-t-2 border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-amber-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                3. Fare Calculation & Advance Amount
              </span>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUseCustomFare(false)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                    !useCustomFare
                      ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Auto Tariff Rate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomFare(true);
                    setCustomTotalFare(fareCalculation.totalFare);
                    setCustomAdvancePaid(fareCalculation.advancePaid);
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                    useCustomFare
                      ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Custom Fixed Deal Fare
                </button>
              </div>
            </div>

            {!useCustomFare ? (
              <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-slate-800 dark:text-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStateTax}
                    onChange={(e) => setIncludeStateTax(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-amber-500"
                  />
                  <span>
                    Include State Permit Tax (
                    {formatINR(selectedTariff.stateTaxDefault)})
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNightCharge}
                    onChange={(e) => setIncludeNightCharge(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-amber-500"
                  />
                  <span>
                    Include Night Allowance (
                    {formatINR(selectedTariff.nightChargeDefault)})
                  </span>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-900 dark:text-amber-300">
                    Agreed Total Fare (Inclusive of 5% GST) ₹
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={customTotalFare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCustomTotalFare(val);
                      setCustomAdvancePaid(
                        paymentMode === 'Full Paid' ? val : Math.round(val * 0.2)
                      );
                    }}
                    className="w-full px-3 py-2 text-sm font-mono font-extrabold bg-white dark:bg-slate-900 border-2 border-amber-400 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-900 dark:text-amber-300">
                    Advance Received Online ₹
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={
                      paymentMode === 'Full Paid'
                        ? customTotalFare
                        : customAdvancePaid
                    }
                    onChange={(e) => setCustomAdvancePaid(Number(e.target.value))}
                    disabled={paymentMode === 'Full Paid'}
                    className="w-full px-3 py-2 text-sm font-mono font-extrabold bg-white dark:bg-slate-900 border-2 border-amber-400 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            {/* High-Contrast Executive Fare Summary Box */}
            <div className="p-4 rounded-xl bg-slate-900 text-white border-2 border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-400 font-semibold">
                  Billable ({fareCalculation.billableKm} KM)
                </div>
                <div className="font-mono font-extrabold text-white text-sm mt-0.5">
                  {formatINR(fareCalculation.baseFare)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">
                  DA + Taxes + Night
                </div>
                <div className="font-mono font-extrabold text-white text-sm mt-0.5">
                  {formatINR(
                    fareCalculation.driverAllowance +
                      fareCalculation.stateTax +
                      fareCalculation.nightCharges
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">
                  Rebate & 5% GST
                </div>
                <div className="font-mono font-extrabold text-emerald-400 text-sm mt-0.5">
                  -{formatINR(fareCalculation.marketDiscount)} / +
                  {formatINR(fareCalculation.gstAmount)}
                </div>
              </div>
              <div>
                <div className="text-amber-300 font-bold">
                  Total Fare ({paymentMode})
                </div>
                <div className="font-mono font-extrabold text-amber-400 text-base mt-0.5">
                  {formatINR(fareCalculation.totalFare)}
                </div>
                <div className="font-mono text-[11px] font-bold text-slate-300">
                  Adv: {formatINR(fareCalculation.advancePaid)} · Bal:{' '}
                  {formatINR(fareCalculation.balanceAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Optional Immediate Chauffeur & Vehicle Allotment */}
          <div className="space-y-3 pt-3 border-t-2 border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignDriverNow}
                  onChange={(e) => setAssignDriverNow(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-amber-500"
                />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-amber-400 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  4. Assign Driver & Vehicle Immediately (Optional)
                </span>
              </label>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                {assignDriverNow
                  ? 'Will create as CONFIRMED (Allotted)'
                  : 'Or assign later from Dispatch table'}
              </span>
            </div>

            {assignDriverNow && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 space-y-3.5">
                {matchingDrivers.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>1-Tap Select from Active {vehicleCategory} Fleet Pool:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matchingDrivers.map((drv) => (
                        <button
                          key={drv.driverId}
                          type="button"
                          onClick={() => handleSelectPoolDriver(drv)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 hover:border-amber-500 text-slate-900 dark:text-slate-100 cursor-pointer"
                        >
                          {drv.driverName} ·{' '}
                          <span className="font-mono text-amber-600 dark:text-amber-400">
                            {drv.vehicleNumber}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chauffeur Name
                    </label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="e.g. Rajendra Prasad Verma"
                      className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chauffeur Mobile
                    </label>
                    <input
                      type="tel"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      onBlur={() =>
                        setDriverPhone((prev) => normalizeIndianPhone(prev))
                      }
                      placeholder="+91 98182 74105"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vehicle Registration Plate
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) =>
                        setVehicleNumber(e.target.value.toUpperCase())
                      }
                      placeholder="DL 01 CAB 6812"
                      className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vehicle Model
                    </label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder={`${vehicleCategory} AC Cab`}
                      className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              {assignDriverNow && driverName.trim() ? (
                <UserCheck className="w-4 h-4" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <span>
                {submitting
                  ? 'Saving Booking...'
                  : assignDriverNow && driverName.trim()
                  ? `Create & Allot Booking (${nextBookingId})`
                  : `Create Customer Booking (${nextBookingId})`}
              </span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
