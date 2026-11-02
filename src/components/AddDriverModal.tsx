import React, { useState, useMemo } from 'react';
import {
  FleetDriver,
  VehicleCategory,
  DriverDutyStatus,
  DriverKycStatus,
  BLUEPRINT_CONSTRAINTS,
  sanitizeString,
} from '../types/safar';
import { X, UserPlus } from 'lucide-react';

interface AddDriverModalProps {
  existingDriverIds: string[];
  onClose: () => void;
  onAddDriver: (
    driver: Omit<FleetDriver, 'createdBy' | 'updatedAt'>
  ) => Promise<void>;
}

export const AddDriverModal: React.FC<AddDriverModalProps> = ({
  existingDriverIds,
  onClose,
  onAddDriver,
}) => {
  const nextDriverId = useMemo(() => {
    let maxNum = 106;
    existingDriverIds.forEach((id) => {
      const num = parseInt(id.replace('DRV', ''), 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `DRV${maxNum + 1}`;
  }, [existingDriverIds]);

  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('+91 ');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('Maruti Swift Dzire Tour S');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('Sedan');
  const [homeBaseCity, setHomeBaseCity] = useState('New Delhi / NCR');
  const [dlNumber, setDlNumber] = useState('');
  const [dutyStatus, setDutyStatus] = useState<DriverDutyStatus>('Available');
  const [kycStatus, setKycStatus] = useState<DriverKycStatus>('Verified');
  const [rcVerified, setRcVerified] = useState(true);
  const [insuranceVerified, setInsuranceVerified] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeString(driverName, BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME);
    const cleanPhone = sanitizeString(driverPhone, BLUEPRINT_CONSTRAINTS.MAX_PHONE);
    const cleanPlate = sanitizeString(
      vehicleNumber.toUpperCase(),
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
    );
    const cleanModel = sanitizeString(vehicleModel, BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL);
    const cleanCity = sanitizeString(homeBaseCity, 80);
    const cleanDl = sanitizeString(
      dlNumber.toUpperCase(),
      BLUEPRINT_CONSTRAINTS.MAX_DL_NUMBER
    );

    if (cleanName.length < 2) {
      setErrorMsg('Please enter the chauffeur full name.');
      return;
    }
    if (!BLUEPRINT_CONSTRAINTS.PHONE_REGEX.test(cleanPhone)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number (e.g. +91 98114 27650).');
      return;
    }
    if (cleanPlate.length < 4) {
      setErrorMsg('Please enter a valid vehicle registration plate (e.g. DL 01 CAB 6812).');
      return;
    }
    if (cleanDl.length < 4) {
      setErrorMsg('Please enter the Commercial Driving License (DL) number.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onAddDriver({
        driverId: nextDriverId,
        driverName: cleanName,
        driverPhone: cleanPhone,
        vehicleNumber: cleanPlate,
        vehicleModel: cleanModel,
        vehicleCategory,
        homeBaseCity: cleanCity,
        dutyStatus,
        kycStatus,
        dlNumber: cleanDl,
        rcVerified,
        insuranceVerified,
        rating: 4.8,
        completedTrips: 0,
        totalEarnings: 0,
        commissionDeducted: 0,
        pendingPayout: 0,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to onboard driver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full overflow-hidden shadow-xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
              Onboard Fleet Chauffeur · {nextDriverId}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Add verified commercial driver and vehicle to SafarIndiaCabs dispatch pool
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Driver Full Name *
              </label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Kuldeep Singh"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+91 98114 22109"
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Vehicle Registration Plate *
              </label>
              <input
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="DL 01 CAB 9012"
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Vehicle Category
              </label>
              <select
                value={vehicleCategory}
                onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Innova Crysta">Innova Crysta</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Car Make & Model *
              </label>
              <input
                type="text"
                required
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Toyota Innova Crysta GX"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Home Base Hub *
              </label>
              <input
                type="text"
                required
                value={homeBaseCity}
                onChange={(e) => setHomeBaseCity(e.target.value)}
                placeholder="New Delhi / NCR"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Commercial DL Number *
              </label>
              <input
                type="text"
                required
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                placeholder="DL0420180049182"
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                KYC Verification Status
              </label>
              <select
                value={kycStatus}
                onChange={(e) => setKycStatus(e.target.value as DriverKycStatus)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="Verified">Verified</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Expiring Soon">Expiring Soon</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 dark:text-slate-300 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rcVerified}
                onChange={(e) => setRcVerified(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Commercial RC & Permit Verified</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={insuranceVerified}
                onChange={(e) => setInsuranceVerified(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Passenger Insurance Verified</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dutyStatus === 'Available'}
                onChange={(e) =>
                  setDutyStatus(e.target.checked ? 'Available' : 'Off Duty')
                }
                className="rounded border-slate-300"
              />
              <span>Mark Active & Available for Dispatch</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{saving ? 'Onboarding...' : 'Onboard Fleet Driver'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
