import React, { useState, useMemo } from 'react';
import {
  Booking,
  BookingStatus,
  FleetDriver,
  BLUEPRINT_CONSTRAINTS,
  WHATSAPP_CLOUD_CONFIG,
  sanitizeString,
  clampNumber,
  formatINR,
} from '../types/safar';
import { normalizeIndianPhone } from './NewBookingModal';
import { triggerAutomatedWhatsAppWorkflow } from '../lib/pdfAndApis';
import {
  X,
  UserCheck,
  Phone,
  Car,
  CheckCircle2,
  Smartphone,
  MessageSquare,
  MapPin,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Search,
  Calculator,
} from 'lucide-react';

interface AssignDriverModalProps {
  booking: Booking;
  fleetDrivers: FleetDriver[];
  allBookings?: Booking[];
  onClose: () => void;
  onSave: (
    bookingId: string,
    driverDetails: {
      driverName: string;
      driverPhone: string;
      vehicleNumber: string;
      vehicleModel: string;
      markConfirmed: boolean;
      nextStatus?: BookingStatus;
      tollTax?: number;
      stateTax?: number;
      driverAllowance?: number;
    }
  ) => Promise<void>;
}

export const AssignDriverModal: React.FC<AssignDriverModalProps> = ({
  booking,
  fleetDrivers,
  allBookings = [],
  onClose,
  onSave,
}) => {
  const [driverName, setDriverName] = useState(booking.driverName || '');
  const [driverPhone, setDriverPhone] = useState(booking.driverPhone || '+91 ');
  const [vehicleNumber, setVehicleNumber] = useState(
    booking.vehicleNumber || ''
  );
  const [vehicleModel, setVehicleModel] = useState(
    booking.vehicleModel || `${booking.vehicleCategory} AC Cab`
  );
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus>(
    booking.status === 'Pending' ? 'Active' : booking.status
  );
  const [tollTax, setTollTax] = useState<number>(booking.tollTax ?? 0);
  const [stateTax, setStateTax] = useState<number>(booking.stateTax ?? 0);
  const [driverAllowance, setDriverAllowance] = useState<number>(
    booking.driverAllowance ?? 0
  );
  const [autoSendWhatsAppCloud, setAutoSendWhatsAppCloud] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Split-Screen Dispatch Filters
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

  // Live recalculated fare preview with updated Toll Tax & State Permit Tax
  const liveFareCalc = useMemo(() => {
    const cleanToll = clampNumber(Number(tollTax) || 0, 0, 500000);
    const cleanState = clampNumber(Number(stateTax) || 0, 0, 500000);
    const cleanDa = clampNumber(Number(driverAllowance) || 0, 0, 500000);
    const taxable = Math.max(
      0,
      booking.baseFare +
        cleanDa +
        cleanToll +
        cleanState +
        (booking.nightCharges || 0) -
        (booking.marketDiscount || 0)
    );
    const gstAmount = Math.round(taxable * 0.05);
    const totalFare = taxable + gstAmount;
    const advancePaid =
      selectedStatus === 'Completed' ? totalFare : booking.advancePaid;
    const balanceAmount =
      selectedStatus === 'Completed'
        ? 0
        : Math.max(0, totalFare - booking.advancePaid);
    return {
      cleanToll,
      cleanState,
      cleanDa,
      gstAmount,
      totalFare,
      advancePaid,
      balanceAmount,
    };
  }, [
    booking.baseFare,
    booking.nightCharges,
    booking.marketDiscount,
    booking.advancePaid,
    tollTax,
    stateTax,
    driverAllowance,
    selectedStatus,
  ]);

  // Detect scheduling conflicts (if a driver is already assigned to another active booking on the same pickupDate)
  const conflictingDriverPhones = useMemo(() => {
    const set = new Set<string>();
    allBookings.forEach((b) => {
      if (
        b.bookingId !== booking.bookingId &&
        b.pickupDate === booking.pickupDate &&
        b.status !== 'Cancelled' &&
        b.status !== 'Completed' &&
        b.driverPhone
      ) {
        set.add(b.driverPhone.replace(/\D/g, '').slice(-10));
      }
    });
    return set;
  }, [allBookings, booking.bookingId, booking.pickupDate]);

  const filteredPoolDrivers = useMemo(() => {
    return fleetDrivers.filter((d) => {
      const matchesCat =
        filterCategory === 'All' || d.vehicleCategory === filterCategory;
      const q = filterLocation.trim().toLowerCase();
      const matchesLoc =
        !q ||
        d.homeBaseCity.toLowerCase().includes(q) ||
        d.driverName.toLowerCase().includes(q) ||
        d.vehicleNumber.toLowerCase().includes(q);
      const matchesAvail = !onlyAvailable || d.dutyStatus === 'Available';
      return matchesCat && matchesLoc && matchesAvail;
    });
  }, [fleetDrivers, filterCategory, filterLocation, onlyAvailable]);

  const handleApplyDriver = (drv: FleetDriver) => {
    const phoneKey = drv.driverPhone.replace(/\D/g, '').slice(-10);
    if (conflictingDriverPhones.has(phoneKey)) {
      setValidationError(
        `Scheduling Conflict Alert: ${drv.driverName} (${drv.vehicleNumber}) is already assigned to another active trip on ${booking.pickupDate}.`
      );
      return;
    }
    setDriverName(drv.driverName);
    setDriverPhone(drv.driverPhone);
    setVehicleNumber(drv.vehicleNumber);
    setVehicleModel(drv.vehicleModel);
    if (selectedStatus === 'Pending') {
      setSelectedStatus('Active');
    }
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeString(
      driverName,
      BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
    );
    const normalizedPhone = normalizeIndianPhone(driverPhone);
    const cleanPhone = sanitizeString(
      normalizedPhone,
      BLUEPRINT_CONSTRAINTS.MAX_PHONE
    );
    const cleanPlate = sanitizeString(
      vehicleNumber.toUpperCase(),
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
    );
    const cleanModel = sanitizeString(
      vehicleModel,
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL
    );

    if (cleanName.length < 2) {
      setValidationError(
        'Please enter a valid Chauffeur Full Name (at least 2 characters).'
      );
      return;
    }
    if (!BLUEPRINT_CONSTRAINTS.PHONE_REGEX.test(cleanPhone)) {
      setValidationError(
        'Please enter a valid 10-digit Indian mobile number (e.g. 9818944089).'
      );
      return;
    }
    if (cleanPlate.length < 4) {
      setValidationError(
        'Please enter a valid Vehicle Registration Number (e.g. HR55BE6324).'
      );
      return;
    }

    setSaving(true);
    setValidationError(null);
    try {
      await onSave(booking.bookingId, {
        driverName: cleanName,
        driverPhone: cleanPhone,
        vehicleNumber: cleanPlate,
        vehicleModel: cleanModel,
        markConfirmed: selectedStatus !== 'Pending',
        nextStatus: selectedStatus,
        tollTax: liveFareCalc.cleanToll,
        stateTax: liveFareCalc.cleanState,
        driverAllowance: liveFareCalc.cleanDa,
      });

      if (autoSendWhatsAppCloud) {
        const updatedBooking: Booking = {
          ...booking,
          driverName: cleanName,
          driverPhone: cleanPhone,
          vehicleNumber: cleanPlate,
          vehicleModel: cleanModel,
          status: selectedStatus,
          tollTax: liveFareCalc.cleanToll,
          stateTax: liveFareCalc.cleanState,
          driverAllowance: liveFareCalc.cleanDa,
          gstAmount: liveFareCalc.gstAmount,
          totalFare: liveFareCalc.totalFare,
          advancePaid: liveFareCalc.advancePaid,
          balanceAmount: liveFareCalc.balanceAmount,
        };
        triggerAutomatedWhatsAppWorkflow(updatedBooking, {
          sendCustomerConfirmation: true,
          sendDriverPickupAlert: true,
        }).catch(() => {
          // non-blocking
        });
      }

      onClose();
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : 'Failed to assign driver'
      );
    } finally {
      setSaving(false);
    }
  };

  const cleanDriverDigits = driverPhone.replace(/\D/g, '');
  const driverDutyWhatsAppText = `*SAFAR INDIA CABS - NEW PICKUP DUTY SLIP*\n*Booking ID:* ${booking.bookingId}\n*Customer:* ${booking.customerName} (${booking.customerPhone})\n*Pickup:* ${booking.pickupCity} (${booking.pickupDate} at ${booking.pickupTime})\n*Drop:* ${booking.dropCity}\n*Trip Type:* ${booking.tripType} (${booking.distanceKm} KM)\n*Vehicle:* ${vehicleNumber || 'Assigned Cab'} (${vehicleModel})\n*Toll Tax:* ${formatINR(liveFareCalc.cleanToll)} | *State Tax:* ${formatINR(liveFareCalc.cleanState)}\n*Collect Balance from Customer:* ${formatINR(liveFareCalc.balanceAmount)}\n\nPlease reply *ACCEPTED* to Admin Control Room (+91 7710080992).`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-5xl w-full overflow-hidden shadow-2xl my-6">
        {/* Header — Premium Light + Silver */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-b-2 border-slate-300 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-display">
                Admin Dispatch, Chauffeur Allotment & Toll/Tax Billing · {booking.bookingId}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                Pending → Active → Completed
              </span>
            </div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
              Assign chauffeur & vehicle, set trip status (Pending → Active → Completed), and verify Highway Toll / State Tax for final billing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Split-Screen Grid: Left = Booking Details & Direct Assignment Form | Right = Available Driver Pool & Conflict Detector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-300 dark:divide-slate-800">
          {/* LEFT COLUMN (7 cols): Booking Overview + Manual/Selected Driver Form + Toll/State Tax + Status Stepper */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 p-5 sm:p-6 space-y-4">
            {/* Booking Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                  {booking.bookingId} · {booking.customerName} ({booking.customerPhone})
                </span>
                <span className="px-2.5 py-0.5 rounded-md font-extrabold bg-amber-500 text-slate-950">
                  {booking.vehicleCategory}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-bold text-slate-700 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  {booking.pickupCity} → {booking.dropCity}
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  {booking.pickupDate} at {booking.pickupTime}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300">
                <span>
                  {booking.tripType} · {booking.distanceKm} KM ({booking.tripDays}d)
                </span>
                <span>
                  Total: <strong>{formatINR(liveFareCalc.totalFare)}</strong> · Collect:{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {formatINR(liveFareCalc.balanceAmount)}
                  </strong>
                </span>
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border-2 border-red-300 dark:border-red-800 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Assigned Chauffeur & Vehicle Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Chauffeur Full Name *
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME}
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Enter or pick chauffeur name"
                    className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Chauffeur Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    maxLength={BLUEPRINT_CONSTRAINTS.MAX_PHONE}
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    onBlur={() =>
                      setDriverPhone((prev) => normalizeIndianPhone(prev))
                    }
                    placeholder="+91 9818944089"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Vehicle Registration Plate *
                </label>
                <div className="relative">
                  <Car className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER}
                    value={vehicleNumber}
                    onChange={(e) =>
                      setVehicleNumber(e.target.value.toUpperCase())
                    }
                    placeholder="HR55BE6324"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold uppercase bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Dispatched Car Make & Model
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL}
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Swift Dzire / Innova Crysta"
                  className="w-full px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Toll Tax, State Tax & Driver Allowance Final Billing Inputs */}
            <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-slate-950 border-2 border-amber-300/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-amber-400 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-amber-600" />
                  <span>Toll Tax, State Permit Tax & Allowance (Final Billing)</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  Base: {formatINR(booking.baseFare)} + 5% GST ({formatINR(liveFareCalc.gstAmount)})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Highway Toll Tax (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500000}
                    value={tollTax}
                    onChange={(e) => setTollTax(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    State Permit Tax (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500000}
                    value={stateTax}
                    onChange={(e) => setStateTax(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Driver Allowance (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500000}
                    value={driverAllowance}
                    onChange={(e) =>
                      setDriverAllowance(Number(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Trip Status Lifecycle Selector (Pending -> Active -> Completed) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                Update Booking Dispatch Status (Pending → Active → Completed)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { status: 'Pending', label: '1. Pending' },
                    { status: 'Confirmed', label: '2. Allotted' },
                    { status: 'Active', label: '3. Active Trip' },
                    { status: 'Completed', label: '4. Completed' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => setSelectedStatus(item.status)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-extrabold border-2 transition-colors cursor-pointer ${
                      selectedStatus === item.status
                        ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-900 dark:border-amber-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:border-amber-500'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Driver Communication Bar (No Driver App Needed) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Direct Chauffeur Communication (Phone / WhatsApp / SMS Duty Slip)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`tel:${cleanDriverDigits || '917710080992'}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Call Driver</span>
                </a>
                <a
                  href={`https://wa.me/${cleanDriverDigits || '917710080992'}?text=${encodeURIComponent(driverDutyWhatsAppText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Duty Slip</span>
                </a>
                <a
                  href={`sms:${cleanDriverDigits || '917710080992'}?body=${encodeURIComponent(
                    `SafarIndiaCabs Duty ${booking.bookingId}: Pickup ${booking.customerName} (${booking.customerPhone}) at ${booking.pickupCity} on ${booking.pickupDate} ${booking.pickupTime}. Drop: ${booking.dropCity}. Collect INR ${liveFareCalc.balanceAmount}.`
                  )}`}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Send SMS</span>
                </a>
              </div>
            </div>

            {/* Meta WhatsApp Cloud API Automated Dual Alert Toggle */}
            <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="assign-wa-cloud"
                checked={autoSendWhatsAppCloud}
                onChange={(e) => setAutoSendWhatsAppCloud(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-emerald-400 accent-emerald-600"
              />
              <label
                htmlFor="assign-wa-cloud"
                className="text-xs text-emerald-950 dark:text-emerald-200 cursor-pointer leading-relaxed"
              >
                <strong className="font-extrabold">
                  Auto-Send Meta WhatsApp Cloud API ({WHATSAPP_CLOUD_CONFIG.phoneNumberId}):
                </strong>{' '}
                Dispatches Chauffeur & Cab details to Customer ({booking.customerPhone}) and Pickup Duty Alert to Chauffeur.
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {saving
                    ? 'Saving & Syncing...'
                    : `Save Dispatch (${selectedStatus}) & Sync Firestore`}
                </span>
              </button>
            </div>
          </form>

          {/* RIGHT COLUMN (5 cols): Admin-Appointed Fleet Pool with Filter & Conflict Detection */}
          <div className="lg:col-span-5 p-5 sm:p-6 bg-slate-50/80 dark:bg-slate-950/60 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-amber-400">
                  Admin-Appointed Chauffeur Pool ({filteredPoolDrivers.length})
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any verified chauffeur to populate details. Conflicting schedules on {booking.pickupDate} are automatically blocked.
                </p>
              </div>

              {/* Filter Controls */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="Filter by hub city, driver name, or plate..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="All">All Cab Categories</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Innova Crysta">Innova Crysta</option>
                  </select>

                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyAvailable}
                      onChange={(e) => setOnlyAvailable(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>Available Only</span>
                  </label>
                </div>
              </div>

              {/* Driver List */}
              {filteredPoolDrivers.length === 0 ? (
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                  <Car className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    No matching chauffeurs in pool
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    You can type any chauffeur name, phone number, and vehicle plate directly on the left, or onboard drivers in the Chauffeur & Fleet tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {filteredPoolDrivers.map((drv) => {
                    const phoneKey = drv.driverPhone.replace(/\D/g, '').slice(-10);
                    const hasConflict = conflictingDriverPhones.has(phoneKey);
                    const isUnavailable = drv.dutyStatus !== 'Available';

                    return (
                      <div
                        key={drv.driverId}
                        className={`p-3 rounded-xl border-2 transition-colors text-xs ${
                          hasConflict
                            ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800 opacity-80'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{drv.driverName}</span>
                              <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                                {drv.rating.toFixed(1)} ★
                              </span>
                            </div>
                            <div className="font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                              {drv.vehicleNumber} · {drv.vehicleModel}
                            </div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                              Hub: {drv.homeBaseCity} · {drv.driverPhone}
                            </div>
                          </div>

                          <div className="text-right space-y-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-extrabold text-[10px] ${
                                hasConflict
                                  ? 'bg-red-100 text-red-800'
                                  : isUnavailable
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {hasConflict ? 'Schedule Conflict' : drv.dutyStatus}
                            </span>
                            <div>
                              <button
                                type="button"
                                disabled={hasConflict}
                                onClick={() => handleApplyDriver(drv)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold text-[11px] disabled:opacity-40 cursor-pointer"
                              >
                                {hasConflict ? 'Busy on Date' : 'Select Chauffeur'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                All drivers are verified and appointed directly by SafarIndiaCabs Admin. No external driver login app is used.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
