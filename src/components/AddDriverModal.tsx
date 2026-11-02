import React, { useState, useMemo } from 'react';
import {
  FleetDriver,
  VehicleCategory,
  DriverDutyStatus,
  DriverKycStatus,
  BLUEPRINT_CONSTRAINTS,
  sanitizeString,
} from '../types/safar';
import { X, UserPlus, ShieldCheck } from 'lucide-react';

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
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('Maruti Swift Dzire Tour S');
  const [vehicleCategory, setVehicleCategory] =
    useState<VehicleCategory>('Sedan');
  const [homeBaseCity, setHomeBaseCity] = useState('New Delhi / NCR');
  const [dlNumber, setDlNumber] = useState('');
  const [dlExpiryDate, setDlExpiryDate] = useState('2032-12-31');
  const [aadhaarKycRef, setAadhaarKycRef] = useState('');
  const [policeVerificationStatus, setPoliceVerificationStatus] = useState<
    'Verified' | 'Pending' | 'In Progress'
  >('Verified');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [joiningDate, setJoiningDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [employmentType, setEmploymentType] = useState<
    'Full-Time Fleet' | 'Commission Partner' | 'Vendor Attached'
  >('Commission Partner');
  const [commissionPct, setCommissionPct] = useState(12);
  const [bankUpiDetails, setBankUpiDetails] = useState('');
  const [internalRemarks, setInternalRemarks] = useState('');
  const [dutyStatus, setDutyStatus] = useState<DriverDutyStatus>('Available');
  const [kycStatus, setKycStatus] = useState<DriverKycStatus>('Verified');
  const [rcVerified, setRcVerified] = useState(true);
  const [insuranceVerified, setInsuranceVerified] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeString(
      driverName,
      BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
    );
    const cleanPhone = sanitizeString(
      driverPhone,
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
      setErrorMsg(
        'Please enter a valid 10-digit Indian mobile number (e.g. +91 98114 27650).'
      );
      return;
    }
    if (cleanPlate.length < 4) {
      setErrorMsg(
        'Please enter a valid vehicle registration plate (e.g. DL 01 CAB 6812).'
      );
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
        alternatePhone: sanitizeString(alternatePhone, 20),
        email: sanitizeString(email, 80),
        currentAddress: sanitizeString(currentAddress, 180),
        vehicleNumber: cleanPlate,
        vehicleModel: cleanModel,
        vehicleCategory,
        homeBaseCity: cleanCity,
        dutyStatus,
        kycStatus,
        dlNumber: cleanDl,
        dlExpiryDate,
        aadhaarKycRef: sanitizeString(aadhaarKycRef, 40),
        policeVerificationStatus,
        emergencyContact: sanitizeString(emergencyContact, 40),
        joiningDate,
        employmentType,
        commissionPct,
        bankUpiDetails: sanitizeString(bankUpiDetails, 120),
        internalRemarks: sanitizeString(internalRemarks, 200),
        rcVerified,
        insuranceVerified,
        rating: 4.9,
        completedTrips: 0,
        totalEarnings: 0,
        commissionDeducted: 0,
        pendingPayout: 0,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to onboard driver.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 font-display">
                Appoint & Onboard Chauffeur · {nextDriverId}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-900">
                Admin-Appointed Network
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Direct admin verification of KYC, Commercial DL, Police Verification, Vehicle & Payout Bank/UPI details
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Personal & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Chauffeur Full Name *
              </label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Kuldeep Singh"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Primary Mobile (WhatsApp) *
              </label>
              <input
                type="text"
                required
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+91 98114 22109"
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Alternate / Emergency Contact
              </label>
              <input
                type="text"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="+91 99100 00000"
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@safarindiacabs.com"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Current / Permanent Residential Address
              </label>
              <input
                type="text"
                value={currentAddress}
                onChange={(e) => setCurrentAddress(e.target.value)}
                placeholder="Burari / Rohini, North Delhi - 110084"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Section 2: Vehicle & Hub */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3.5 text-xs">
            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Vehicle Registration Plate *
              </label>
              <input
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="DL 01 CAB 9012"
                className="w-full px-3 py-2 font-mono font-extrabold uppercase bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Vehicle Category
              </label>
              <select
                value={vehicleCategory}
                onChange={(e) =>
                  setVehicleCategory(e.target.value as VehicleCategory)
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Innova Crysta">Innova Crysta</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Car Make & Model *
              </label>
              <input
                type="text"
                required
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Toyota Innova Crysta GX"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Home Base Hub *
              </label>
              <input
                type="text"
                required
                value={homeBaseCity}
                onChange={(e) => setHomeBaseCity(e.target.value)}
                placeholder="New Delhi / NCR"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Section 3: KYC, Commercial DL, Police Verification & Payout */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3.5 text-xs">
            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Commercial DL Number *
              </label>
              <input
                type="text"
                required
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                placeholder="DL0420180049182"
                className="w-full px-3 py-2 font-mono font-bold uppercase bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                DL Expiry Date
              </label>
              <input
                type="date"
                value={dlExpiryDate}
                onChange={(e) => setDlExpiryDate(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Aadhaar / KYC Reference
              </label>
              <input
                type="text"
                value={aadhaarKycRef}
                onChange={(e) => setAadhaarKycRef(e.target.value)}
                placeholder="XXXX-XXXX-8412"
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Police Verification
              </label>
              <select
                value={policeVerificationStatus}
                onChange={(e) =>
                  setPoliceVerificationStatus(
                    e.target.value as 'Verified' | 'Pending' | 'In Progress'
                  )
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                <option value="Verified">Police Verified</option>
                <option value="In Progress">Verification In Progress</option>
                <option value="Pending">Pending Submission</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Employment / Association
              </label>
              <select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(
                    e.target.value as
                      | 'Full-Time Fleet'
                      | 'Commission Partner'
                      | 'Vendor Attached'
                  )
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                <option value="Commission Partner">Commission Partner</option>
                <option value="Full-Time Fleet">Full-Time Salaried</option>
                <option value="Vendor Attached">Vendor Attached</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Platform Commission (%)
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Bank / UPI Payout ID
              </label>
              <input
                type="text"
                value={bankUpiDetails}
                onChange={(e) => setBankUpiDetails(e.target.value)}
                placeholder="driver@okaxis / HDFC A/C"
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Initial Duty Status
              </label>
              <select
                value={dutyStatus}
                onChange={(e) =>
                  setDutyStatus(e.target.value as DriverDutyStatus)
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                <option value="Available">Available</option>
                <option value="On Trip">On Trip</option>
                <option value="Off Duty">Off Duty</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Joining Date
              </label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full px-3 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                Internal Admin Remarks
              </label>
              <input
                type="text"
                value={internalRemarks}
                onChange={(e) => setInternalRemarks(e.target.value)}
                placeholder="Experienced hill-station & North India outstation chauffeur"
                className="w-full px-3 py-1.5 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1 text-xs font-bold text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rcVerified}
                onChange={(e) => setRcVerified(e.target.checked)}
                className="rounded border-slate-300 accent-amber-500"
              />
              <span>Commercial Vehicle RC Verified</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={insuranceVerified}
                onChange={(e) => setInsuranceVerified(e.target.checked)}
                className="rounded border-slate-300 accent-amber-500"
              />
              <span>Comprehensive Commercial Insurance Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={kycStatus === 'Verified'}
                onChange={(e) =>
                  setKycStatus(e.target.checked ? 'Verified' : 'Pending Review')
                }
                className="rounded border-slate-300 accent-amber-500"
              />
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Approve KYC Immediately
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
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
              className="px-5 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? 'Onboarding Chauffeur...'
                  : 'Appoint & Save Chauffeur to Fleet'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
