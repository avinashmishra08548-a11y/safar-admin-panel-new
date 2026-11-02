import React, { useState } from 'react';
import { Booking, BLUEPRINT_CONSTRAINTS, sanitizeString } from '../types/safar';
import { X, UserCheck, Phone, Car, CheckCircle2, Smartphone } from 'lucide-react';

interface AssignDriverModalProps {
  booking: Booking;
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

const FLEET_CHAUFFEUR_PRESETS: Record<
  Booking['vehicleCategory'],
  { driverName: string; driverPhone: string; vehicleNumber: string; vehicleModel: string }[]
> = {
  Hatchback: [
    {
      driverName: 'Deepak Kumar Sharma',
      driverPhone: '+91 98104 55210',
      vehicleNumber: 'DL 1Z A 4921',
      vehicleModel: 'Maruti WagonR Tour H3 CNG',
    },
    {
      driverName: 'Santosh Yadav',
      driverPhone: '+91 97118 30492',
      vehicleNumber: 'UP 16 KT 2190',
      vehicleModel: 'Tata Tiago XZ+',
    },
  ],
  Sedan: [
    {
      driverName: 'Rajendra Prasad Verma',
      driverPhone: '+91 98182 74105',
      vehicleNumber: 'DL 01 CAB 6812',
      vehicleModel: 'Maruti Swift Dzire Tour S',
    },
    {
      driverName: 'Harish Chandra Singh',
      driverPhone: '+91 99105 63821',
      vehicleNumber: 'HR 38 AB 9044',
      vehicleModel: 'Toyota Etios Platinum VX',
    },
  ],
  SUV: [
    {
      driverName: 'Balwinder Singh Gill',
      driverPhone: '+91 98721 44901',
      vehicleNumber: 'PB 01 D 7732',
      vehicleModel: 'Maruti Suzuki Ertiga ZXi',
    },
    {
      driverName: 'Rameshwar Gurjar',
      driverPhone: '+91 94142 91038',
      vehicleNumber: 'RJ 14 TC 5581',
      vehicleModel: 'Kia Carens Prestige 7-Str',
    },
  ],
  'Innova Crysta': [
    {
      driverName: 'Mahendra Singh Rathore',
      driverPhone: '+91 94140 88211',
      vehicleNumber: 'HR 55 AN 3319',
      vehicleModel: 'Toyota Innova Crysta 2.4 GX',
    },
    {
      driverName: 'Suresh Kumar Yadav',
      driverPhone: '+91 97654 11209',
      vehicleNumber: 'MH 12 QN 8492',
      vehicleModel: 'Toyota Innova Crysta ZX Captain',
    },
  ],
};

export const AssignDriverModal: React.FC<AssignDriverModalProps> = ({
  booking,
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

  const presets = FLEET_CHAUFFEUR_PRESETS[booking.vehicleCategory] || [];

  const handleApplyPreset = (preset: (typeof presets)[0]) => {
    setDriverName(preset.driverName);
    setDriverPhone(preset.driverPhone);
    setVehicleNumber(preset.vehicleNumber);
    setVehicleModel(preset.vehicleModel);
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Assign Chauffeur & Vehicle · {booking.bookingId}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Syncs immediately to {booking.customerName}&apos;s &apos;My Rides&apos; screen on safarindiacabs.com
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quick Dispatch Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              Quick Fill Verified {booking.vehicleCategory} Chauffeur from Fleet Pool
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((preset) => (
                <button
                  key={preset.vehicleNumber}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-900">{preset.driverName}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {preset.vehicleNumber} · {preset.driverPhone}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {validationError}
            </div>
          )}

          {/* Manual Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
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
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
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
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
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
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Dispatched Car Model
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL}
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Maruti Swift Dzire Tour S"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {booking.status === 'Pending' && (
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={markConfirmed}
                onChange={(e) => setMarkConfirmed(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>
                Automatically transition booking status from <strong>Pending</strong> to <strong>Confirmed</strong> upon driver assignment
              </span>
            </label>
          )}

          {/* Customer 'My Rides' Real-Time Card Preview */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
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
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
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
