import React, { useState, useMemo } from 'react';
import {
  Booking,
  GatewayConfig,
  AppReleaseInfo,
  DEFAULT_GATEWAY_CONFIG,
  DEFAULT_APP_RELEASE_INFO,
  formatINR,
  OFFICIAL_COMPANY_NAME,
  OFFICIAL_GSTIN,
  OFFICIAL_SAC_CODE,
  OFFICIAL_PROPRIETOR,
  OFFICIAL_EMAIL,
  OFFICIAL_HELPLINE,
  OFFICIAL_REGISTERED_ADDRESS,
  OFFICIAL_ADMIN_PORTAL_URL,
  OFFICIAL_LOGO_URL,
  OFFICIAL_BANNER_URL,
  OLA_MAPS_CONFIG,
  WHATSAPP_CLOUD_CONFIG,
  RAZORPAY_DEFAULT_CONFIG,
} from '../types/safar';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Search,
  Phone,
  MessageSquare,
  FileText,
  Download,
  CreditCard,
  Smartphone,
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  Save,
  Copy,
  Database,
  Package,
  MapPin,
  Building2,
} from 'lucide-react';

/* ============================================================================
 * 1. CUSTOMERS DIRECTORY TAB
 * ========================================================================== */
interface CustomersDirectoryProps {
  bookings: Booking[];
  onOpenBillForBooking: (booking: Booking) => void;
  onOpenWhatsAppForBooking: (booking: Booking) => void;
  onExportCsv: () => void;
}

interface AggregatedCustomer {
  phoneKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  totalTrips: number;
  completedTrips: number;
  totalSpent: number;
  totalAdvancePaid: number;
  totalBalanceDue: number;
  lastPickupDate: string;
  lastRoute: string;
  latestBooking: Booking;
}

export const CustomersDirectoryModule: React.FC<CustomersDirectoryProps> = ({
  bookings,
  onOpenBillForBooking,
  onOpenWhatsAppForBooking,
  onExportCsv,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Corporate' | 'Repeat'>(
    'All'
  );

  const customers = useMemo(() => {
    const map = new Map<string, AggregatedCustomer>();

    bookings.forEach((b) => {
      const key = b.customerPhone.replace(/\D/g, '').slice(-10) || b.bookingId;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          phoneKey: key,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          customerEmail: b.customerEmail,
          customerGstin: b.customerGstin || '',
          totalTrips: 1,
          completedTrips: b.status === 'Completed' ? 1 : 0,
          totalSpent: b.status !== 'Cancelled' ? b.totalFare : 0,
          totalAdvancePaid: b.status !== 'Cancelled' ? b.advancePaid : 0,
          totalBalanceDue: b.status !== 'Cancelled' ? b.balanceAmount : 0,
          lastPickupDate: b.pickupDate,
          lastRoute: `${b.pickupCity} → ${b.dropCity}`,
          latestBooking: b,
        });
      } else {
        existing.totalTrips += 1;
        if (b.status === 'Completed') existing.completedTrips += 1;
        if (b.status !== 'Cancelled') {
          existing.totalSpent += b.totalFare;
          existing.totalAdvancePaid += b.advancePaid;
          existing.totalBalanceDue += b.balanceAmount;
        }
        if (b.customerGstin && !existing.customerGstin) {
          existing.customerGstin = b.customerGstin;
        }
        if (b.pickupDate >= existing.lastPickupDate) {
          existing.lastPickupDate = b.pickupDate;
          existing.lastRoute = `${b.pickupCity} → ${b.dropCity}`;
          existing.latestBooking = b;
        }
      }
    });

    return Array.from(map.values());
  }, [bookings]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesQ =
        !q ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.toLowerCase().includes(q) ||
        c.customerEmail.toLowerCase().includes(q) ||
        c.customerGstin.toLowerCase().includes(q) ||
        c.lastRoute.toLowerCase().includes(q);

      const matchesFilter =
        filterType === 'All' ||
        (filterType === 'Corporate' && Boolean(c.customerGstin)) ||
        (filterType === 'Repeat' && c.totalTrips > 1);

      return matchesQ && matchesFilter;
    });
  }, [customers, search, filterType]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Managed Customers Directory & Travel Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete directory of safarindiacabs.com travellers, corporate GSTIN accounts, travel frequency, and lifetime booking value
          </p>
        </div>

        <button
          type="button"
          onClick={onExportCsv}
          className="px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Customer Ledger CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer Name, Mobile Number, Email, Corporate GSTIN, or City..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['All', 'Corporate', 'Repeat'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterType === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab === 'All'
                ? `All Customers (${customers.length})`
                : tab === 'Corporate'
                ? 'Corporate GST Accounts'
                : 'Repeat Travellers'}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4 text-left font-semibold">
                  Customer Profile & Contact
                </th>
                <th className="py-3 px-4 text-left font-semibold">
                  Corporate GSTIN & Segment
                </th>
                <th className="py-3 px-4 text-left font-semibold">
                  Latest Route & Pickup
                </th>
                <th className="py-3 px-4 text-right font-semibold">
                  Travel Frequency
                </th>
                <th className="py-3 px-4 text-right font-semibold">
                  Lifetime Billing & Balance
                </th>
                <th className="py-3 px-4 text-right font-semibold">
                  Quick Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredCustomers.map((c) => (
                <tr
                  key={c.phoneKey}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {c.customerName}
                    </div>
                    <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                      {c.customerPhone}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {c.customerEmail}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 align-top">
                    {c.customerGstin ? (
                      <div>
                        <div className="font-semibold text-amber-700 dark:text-amber-400">
                          B2B Corporate Traveller
                        </div>
                        <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                          GSTIN: {c.customerGstin}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          Individual / Retail Guest
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          B2C Unregistered
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 align-top">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {c.lastRoute}
                    </div>
                    <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      Last Ride: {c.lastPickupDate} ({c.latestBooking.bookingId})
                    </div>
                  </td>

                  <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {c.totalTrips} {c.totalTrips === 1 ? 'Booking' : 'Bookings'}
                    </div>
                    <div className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {c.completedTrips} Completed
                    </div>
                  </td>

                  <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatINR(c.totalSpent)}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                      Adv Paid: {formatINR(c.totalAdvancePaid)}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Collect Due: {formatINR(c.totalBalanceDue)}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 align-top text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <a
                        href={`tel:${c.customerPhone.replace(/\s+/g, '')}`}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => onOpenWhatsAppForBooking(c.latestBooking)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenBillForBooking(c.latestBooking)}
                        className="px-2.5 py-1.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF Bill</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

/* ============================================================================
 * 2. GATEWAYS & APIS TAB
 * ========================================================================== */
interface GatewaysAndApisProps {
  onShowToast: (msg: string) => void;
}

export const GatewaysAndApisModule: React.FC<GatewaysAndApisProps> = ({
  onShowToast,
}) => {
  const [config, setConfig] = useState<GatewayConfig>(() => {
    const saved = localStorage.getItem('safar_gateway_config');
    return saved
      ? { ...DEFAULT_GATEWAY_CONFIG, ...JSON.parse(saved) }
      : DEFAULT_GATEWAY_CONFIG;
  });

  const handleSaveGateways = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('safar_gateway_config', JSON.stringify(config));
    onShowToast(
      'Saved Ola Maps API, Razorpay Payment Gateway, and Meta WhatsApp Cloud API configurations.'
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-display">
            Ola Maps, Razorpay Gateway & Meta WhatsApp Cloud APIs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Live Production Credentials for {OFFICIAL_COMPANY_NAME} ({OFFICIAL_ADMIN_PORTAL_URL})
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveGateways}
          className="px-4 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save All API Configurations</span>
        </button>
      </div>

      {/* Official Company GST & Registered Office Card */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Official Company GST & Contact Details (Active in PDF Invoices)
            </div>
            <div>
              <strong>Company Name:</strong> {OFFICIAL_COMPANY_NAME} ·{' '}
              <strong>Proprietor / Signatory:</strong> {OFFICIAL_PROPRIETOR}
            </div>
            <div className="font-mono font-bold text-amber-700 dark:text-amber-400">
              GSTIN: {OFFICIAL_GSTIN} · SAC Code: {OFFICIAL_SAC_CODE}
            </div>
            <div>
              <strong>Registered Address:</strong> {OFFICIAL_REGISTERED_ADDRESS}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Official Contact & Firebase Cloud Sync
            </div>
            <div>
              <strong>Official Email:</strong> {OFFICIAL_EMAIL}
            </div>
            <div>
              <strong>Helpline / WhatsApp:</strong> {OFFICIAL_HELPLINE}
            </div>
            <div className="font-mono text-slate-600 dark:text-slate-400">
              Firebase Project: <strong>{firebaseConfig.projectId}</strong> ·
              Portal: {OFFICIAL_ADMIN_PORTAL_URL}
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSaveGateways}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Card 1: Ola Maps API */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-display">
                1. Ola Maps API (Autocomplete & KM)
              </h2>
            </div>
            <span className="px-2 py-0.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-md">
              Active
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                Ola Maps API Key
              </label>
              <input
                type="text"
                value={config.olaMapsApiKey}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, olaMapsApiKey: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                Ola Maps Client ID
              </label>
              <input
                type="text"
                value={config.olaMapsClientId}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, olaMapsClientId: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
              <div>Autocomplete: {OLA_MAPS_CONFIG.autocompleteEndpoint}</div>
              <div>Directions: {OLA_MAPS_CONFIG.directionsEndpoint}</div>
              <div>Distance Matrix: {OLA_MAPS_CONFIG.distanceMatrixEndpoint}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Razorpay Payment Gateway */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-display">
                2. Razorpay 20% Advance Gateway
              </h2>
            </div>
            <span className="px-2 py-0.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-md">
              Active
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                Razorpay Key ID (VITE_RAZORPAY_KEY_ID)
              </label>
              <input
                type="text"
                value={config.razorpayKeyId}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, razorpayKeyId: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                Merchant Direct UPI ID
              </label>
              <input
                type="text"
                value={config.merchantUpiId}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, merchantUpiId: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
              <div>Create Order: {RAZORPAY_DEFAULT_CONFIG.createOrderEndpoint}</div>
              <div>Verify Payment: {RAZORPAY_DEFAULT_CONFIG.verifyPaymentEndpoint}</div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold">
              <input
                type="checkbox"
                checked={config.autoSplitAdvance20Pct}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    autoSplitAdvance20Pct: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 accent-amber-500"
              />
              <span className="text-slate-700 dark:text-slate-300">
                20% Advance Online + 80% Driver Collect Split
              </span>
            </label>
          </div>
        </div>

        {/* Card 3: Meta WhatsApp Cloud API */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-display">
                3. Meta WhatsApp Cloud API
              </h2>
            </div>
            <span className="px-2 py-0.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-md">
              Active
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                Phone Number ID (WHATSAPP_PHONE_NUMBER_ID)
              </label>
              <input
                type="text"
                value={config.whatsappPhoneNumberId}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    whatsappPhoneNumberId: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                WhatsApp Business Account ID (WHATSAPP_WABA_ID)
              </label>
              <input
                type="text"
                value={config.whatsappWabaId}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, whatsappWabaId: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                Official Admin WhatsApp Number
              </label>
              <input
                type="text"
                value={config.whatsappBusinessPhone}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    whatsappBusinessPhone: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[10px] break-all text-slate-600 dark:text-slate-400">
              Endpoint: {WHATSAPP_CLOUD_CONFIG.endpoint}
            </div>
          </div>
        </div>
      </form>
    </section>
  );
};

/* ============================================================================
 * 3. SECURITY & APP FILES (AAB / APK) TAB
 * ========================================================================== */
interface SecurityAndApkProps {
  onShowToast: (msg: string) => void;
  onTriggerPinLockNow: () => void;
}

export const SecurityAndApkModule: React.FC<SecurityAndApkProps> = ({
  onShowToast,
  onTriggerPinLockNow,
}) => {
  const [releaseInfo, setReleaseInfo] = useState<AppReleaseInfo>(() => {
    const saved = localStorage.getItem('safar_app_release_info');
    return saved ? JSON.parse(saved) : DEFAULT_APP_RELEASE_INFO;
  });

  const handleSaveSecurityConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('safar_app_release_info', JSON.stringify(releaseInfo));
    onShowToast(
      `Saved Security PIN & Android Package (${releaseInfo.packageName}) configuration.`
    );
  };

  const handleDownloadReleaseArtifact = (
    artifactType: 'aab' | 'apk' | 'keystore'
  ) => {
    const fileMap = {
      aab: {
        filename: `com.safarindiacabs.app-v${releaseInfo.versionName}-code${releaseInfo.versionCode}-release-manifest.json`,
        content: JSON.stringify(
          {
            artifact: 'Android App Bundle (.aab) Production Release Descriptor',
            packageName: releaseInfo.packageName,
            appName: releaseInfo.appName,
            versionName: releaseInfo.versionName,
            versionCode: releaseInfo.versionCode,
            minSdk: releaseInfo.minSdk,
            targetSdk: releaseInfo.targetSdk,
            companyGstin: OFFICIAL_GSTIN,
            proprietor: OFFICIAL_PROPRIETOR,
            registeredAddress: OFFICIAL_REGISTERED_ADDRESS,
            firebaseProjectId: firebaseConfig.projectId,
            signingConfig: {
              keystoreAlias: releaseInfo.keystoreAlias,
              sha1: releaseInfo.sha1Fingerprint,
              sha256: releaseInfo.sha256Fingerprint,
            },
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
      },
      apk: {
        filename: `SafarIndiaCabs-v${releaseInfo.versionName}-universal-release-spec.json`,
        content: JSON.stringify(
          {
            artifact: 'Universal Signed Android APK Distribution Spec',
            packageName: releaseInfo.packageName,
            versionName: releaseInfo.versionName,
            versionCode: releaseInfo.versionCode,
            companyGstin: OFFICIAL_GSTIN,
            proprietor: OFFICIAL_PROPRIETOR,
            helpline: OFFICIAL_HELPLINE,
            apiEndpoint: 'https://safarindiacabs.com',
            adminEndpoint: OFFICIAL_ADMIN_PORTAL_URL,
            sha256Fingerprint: releaseInfo.sha256Fingerprint,
          },
          null,
          2
        ),
      },
      keystore: {
        filename: `safarindiacabs-release-keystore-fingerprints.txt`,
        content: `SAFAR INDIA CABS — ANDROID RELEASE KEYSTORE & DIGITAL ASSET LINKS
===================================================================
Package Name   : ${releaseInfo.packageName}
App Name       : ${releaseInfo.appName}
Version        : ${releaseInfo.versionName} (versionCode: ${releaseInfo.versionCode})
Proprietor     : ${OFFICIAL_PROPRIETOR}
Official GSTIN : ${OFFICIAL_GSTIN}
Address        : ${OFFICIAL_REGISTERED_ADDRESS}
Keystore Alias : ${releaseInfo.keystoreAlias}
SHA-1          : ${releaseInfo.sha1Fingerprint}
SHA-256        : ${releaseInfo.sha256Fingerprint}
Firebase App   : ${firebaseConfig.projectId}
===================================================================`,
      },
    };

    const selected = fileMap[artifactType];
    const blob = new Blob([selected.content], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', selected.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(`Downloaded ${selected.filename}`);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Security & Android App Files (AAB / APK / Keystore)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage production Android builds for {releaseInfo.packageName}, release keystore SHA-256 fingerprints, brand assets, and Admin Route Security PIN
          </p>
        </div>

        <button
          type="button"
          onClick={onTriggerPinLockNow}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock Console with Admin PIN Now</span>
        </button>
      </div>

      {/* Android Production Build Cards (AAB & APK) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Google Play Production .AAB
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {releaseInfo.packageName}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {releaseInfo.aabSizeMb}
            </span>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono">
            <div>
              Version: {releaseInfo.versionName} (Code {releaseInfo.versionCode})
            </div>
            <div>
              SDK: minSdk {releaseInfo.minSdk} · targetSdk{' '}
              {releaseInfo.targetSdk}
            </div>
            <div>Track: {releaseInfo.playStoreTrack}</div>
          </div>

          <button
            type="button"
            onClick={() => handleDownloadReleaseArtifact('aab')}
            className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Production .AAB Bundle Spec</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Direct Universal Release .APK
                </div>
                <div className="text-xs font-mono text-slate-500">
                  arm64-v8a + armeabi-v7a
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
              {releaseInfo.apkSizeMb}
            </span>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono">
            <div>Signed with: {releaseInfo.keystoreAlias}</div>
            <div>Last Built: {releaseInfo.lastBuildDate}</div>
            <div>GSTIN Embedded: {OFFICIAL_GSTIN}</div>
          </div>

          <button
            type="button"
            onClick={() => handleDownloadReleaseArtifact('apk')}
            className="w-full py-2.5 px-3 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Universal .APK Package Spec</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Release Keystore & AssetLinks
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {releaseInfo.keystoreAlias}.jks
                </div>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono break-all">
            <div>SHA-1: {releaseInfo.sha1Fingerprint}</div>
            <div className="truncate">
              SHA-256: {releaseInfo.sha256Fingerprint}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownloadReleaseArtifact('keystore')}
            className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Keystore & assetlinks.json</span>
          </button>
        </div>
      </div>

      {/* Brand Assets & Admin Security PIN Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">
            Official Brand Assets & Invoice Logo Repository
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active across Login Screen, Sidebar, GST Tax Invoices, and the Bill Generator module
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center text-center gap-2">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="SafarIndiaCabs Square Logo"
                className="w-28 h-28 object-contain rounded-lg bg-white p-1 border border-slate-200"
              />
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Primary Invoice & App Logo
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {OFFICIAL_COMPANY_NAME} · {OFFICIAL_GSTIN}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center text-center gap-2">
              <img
                src={OFFICIAL_BANNER_URL}
                alt="Safar India Cabs Wide Banner"
                className="w-full h-28 object-cover rounded-lg border border-slate-200"
              />
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Official Wide Brand Banner
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Your Journey, Our Priority
              </div>
            </div>
          </div>
        </div>

        {/* Admin Security PIN & Package Config Form */}
        <form
          onSubmit={handleSaveSecurityConfig}
          className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">
                Admin Route Security PIN & Release Metadata
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Protect sensitive dispatch & payout controls with a 4-digit Owner Security PIN
              </p>
            </div>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Android Package Name
              </label>
              <input
                type="text"
                value={releaseInfo.packageName}
                onChange={(e) =>
                  setReleaseInfo((r) => ({ ...r, packageName: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                Release Version & Code
              </label>
              <input
                type="text"
                value={releaseInfo.versionName}
                onChange={(e) =>
                  setReleaseInfo((r) => ({ ...r, versionName: e.target.value }))
                }
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">
                4-Digit Owner Security PIN
              </label>
              <input
                type="text"
                maxLength={6}
                value={releaseInfo.adminSecurityPin}
                onChange={(e) =>
                  setReleaseInfo((r) => ({
                    ...r,
                    adminSecurityPin: e.target.value.replace(/\D/g, ''),
                  }))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={releaseInfo.adminPinEnabled}
                  onChange={(e) =>
                    setReleaseInfo((r) => ({
                      ...r,
                      adminPinEnabled: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Require PIN on Console Launch
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    releaseInfo.sha256Fingerprint
                  );
                  onShowToast('Copied SHA-256 fingerprint to clipboard.');
                } catch {
                  // ignore
                }
              }}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy SHA-256</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save PIN & Package Settings</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
