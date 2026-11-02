import React, { useState } from 'react';
import {
  Booking,
  FleetDriver,
  BLUEPRINT_CONSTRAINTS,
  sanitizeString,
} from '../types/safar';
import { X, UserCheck, Phone, Car, CheckCircle2, Smartphone } from 'lucide-react';

interface AssignDriverModalProps {
  booking: Booking;
  fleetDrivers: FleetDriver[];
  onClose: () => void;
  onSave: (
    bookingId: string,
    driverDetails: {
      driverName: string;
      driverPhone: string;
      vehicleNumber: string;
      vehicleModel: string;
      markConfirmed: boolean;
    }
  ) => Promise<void>;
}

export const AssignDriverModal: React.FC<AssignDriverModalProps> = ({
  booking,
  fleetDrivers,
  onClose,
  onSave,
}) => {
  const [driverName, setDriverName] = useState(booking.driverName || '');
  const [driverPhone, setDriverPhone] = useState(booking.driverPhone || '+91 ');
  const [vehicleNumber, setVehicleNumber] = useState(booking.vehicleNumber || '');
  const [vehicleModel, setVehicleModel] = useState(
    booking.vehicleModel || `${booking.vehicleCategory} AC Cab`
  );
  const [markConfirmed, setMarkConfirmed] = useState(
    booking.status === 'Pending' ? true : booking.status === 'Confirmed'
  );
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Prioritize drivers matching the booked vehicle category, then show all verified drivers
  const matchingDrivers = fleetDrivers.filter(
    (d) => d.vehicleCategory === booking.vehicleCategory
  );
  const quickPickDrivers =
    matchingDrivers.length > 0 ? matchingDrivers : fleetDrivers.slice(0, 4);

  const handleApplyDriver = (drv: FleetDriver) => {
    setDriverName(drv.driverName);
    setDriverPhone(drv.driverPhone);
    setVehicleNumber(drv.vehicleNumber);
    setVehicleModel(drv.vehicleModel);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeString(driverName, BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME);
    const cleanPhone = sanitizeString(driverPhone, BLUEPRINT_CONSTRAINTS.MAX_PHONE);
    const cleanPlate = sanitizeString(
      vehicleNumber.toUpperCase(),
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
    );
    const cleanModel = sanitizeString(vehicleModel, BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL);

    if (cleanName.length < 2) {
      setValidationError('Please enter a valid Driver Name (at least 2 characters).');
      return;
    }
    if (!BLUEPRINT_CONSTRAINTS.PHONE_REGEX.test(cleanPhone)) {
      setValidationError('Please enter a valid 10-digit Indian mobile number (e.g. +91 98114 27650).');
      return;
    }
    if (cleanPlate.length < 4) {
      setValidationError('Please enter a valid Vehicle Registration Number (e.g. DL 01 CAB 6812).');
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
        markConfirmed,
      });
      onClose();
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to assign driver');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
              Assign Chauffeur & Vehicle · {booking.bookingId}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Syncs immediately to {booking.customerName}&apos;s &apos;My Rides&apos; screen on safarindiacabs.com
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
          {/* Quick Dispatch Pool from Live Fleet Drivers */}
          {quickPickDrivers.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Select Verified {booking.vehicleCategory} Chauffeur from Active Fleet Pool
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quickPickDrivers.map((drv) => (
                  <button
                    key={drv.driverId}
                    type="button"
                    onClick={() => handleApplyDriver(drv)}
                    className="text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-500 bg-slate-50/70 dark:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <span>{drv.driverName}</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">
                        {drv.rating.toFixed(1)} ★
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {drv.vehicleNumber} · {drv.dutyStatus} · {drv.kycStatus}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {validationError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              {validationError}
            </div>
          )}

          {/* Manual Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Driver Full Name *
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME}
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Rajendra Prasad Verma"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Driver Mobile Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.MAX_PHONE}
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 98182 74105"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Vehicle Registration Plate *
              </label>
              <div className="relative">
                <Car className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER}
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="DL 01 CAB 6812"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Dispatched Car Model
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL}
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Maruti Swift Dzire Tour S"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {booking.status === 'Pending' && (
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={markConfirmed}
                onChange={(e) => setMarkConfirmed(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>
                Automatically transition booking status from <strong>Pending</strong> to <strong>Confirmed</strong> upon driver assignment
              </span>
            </label>
          )}

          {/* Customer 'My Rides' Real-Time Card Preview */}
          <div className="p-4 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                Customer App &apos;My Rides&apos; Live Preview (safarindiacabs.com)
              </span>
              <span className="font-mono text-amber-400">{booking.bookingId}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800 text-xs">
              <div>
                <div className="text-slate-400">Assigned Chauffeur</div>
                <div className="font-semibold text-white mt-0.5">
                  {driverName.trim() || 'Awaiting Assignment'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Chauffeur Contact</div>
                <div className="font-mono text-white mt-0.5">
                  {driverPhone.trim() || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Vehicle Plate & Model</div>
                <div className="font-mono text-amber-300 mt-0.5">
                  {vehicleNumber.trim() || '—'} · {vehicleModel.trim() || booking.vehicleCategory}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saving ? 'Syncing to Customer App...' : 'Assign Driver & Publish to My Rides'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
