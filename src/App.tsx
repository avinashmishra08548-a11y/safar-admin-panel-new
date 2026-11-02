/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  OperationType,
  handleFirestoreError,
} from './lib/firebase';
import {
  Booking,
  BookingStatus,
  TariffPlan,
  FleetDriver,
  DriverDutyStatus,
  DEFAULT_TARIFF_PLANS,
  INITIAL_SAMPLE_DRIVERS,
  BLUEPRINT_CONSTRAINTS,
  OFFICIAL_GSTIN,
  OFFICIAL_LOGO_URL,
  DEFAULT_APP_RELEASE_INFO,
  sanitizeString,
  clampNumber,
  formatINR,
  isSampleDemoBooking,
  isSampleDemoDriver,
} from './types/safar';
import { LoginScreen } from './components/LoginScreen';
import { AssignDriverModal } from './components/AssignDriverModal';
import { GstInvoiceModal } from './components/GstInvoiceModal';
import { CustomerMyRidesDrawer } from './components/CustomerMyRidesDrawer';
import { NewBookingModal } from './components/NewBookingModal';
import { AddDriverModal } from './components/AddDriverModal';
import { WhatsAppDispatchModal } from './components/WhatsAppDispatchModal';
import { BillGeneratorModule } from './components/BillGeneratorModule';
import {
  CustomersDirectoryModule,
  GatewaysAndApisModule,
  SecurityAndApkModule,
} from './components/CustomersGatewaysApkModules';
import {
  Search,
  UserPlus,
  CheckCircle2,
  FileText,
  Download,
  Sliders,
  Receipt,
  LayoutGrid,
  Plus,
  RefreshCw,
  LogOut,
  Smartphone,
  Calculator,
  XCircle,
  AlertTriangle,
  Database,
  Save,
  Users,
  ShieldCheck,
  Sun,
  Moon,
  Wallet,
  Stamp,
  MessageSquare,
  Globe,
  Lock,
  Package,
  MapPin,
  Phone,
  Car,
} from 'lucide-react';

type ActiveModule =
  | 'control-room'
  | 'bill-generator'
  | 'customers'
  | 'tariff-engine'
  | 'driver-fleet'
  | 'gateways-apis'
  | 'security-apk'
  | 'billing-logs';

type DispatchStatusFilter =
  | 'All'
  | 'Pending Driver'
  | 'Driver Allotted'
  | 'Active'
  | 'Completed'
  | 'Cancelled';

type TripCategoryFilter =
  | 'All'
  | 'One-Way'
  | 'Round-Trip'
  | 'Local'
  | 'Airport';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class FirestoreErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected database error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-extrabold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Operations Database Notice</span>
            </div>
            <pre className="p-3 bg-slate-100 dark:bg-slate-950 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-extrabold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Reload Control Room
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function loadInitialBookings(): Booking[] {
  try {
    const saved = localStorage.getItem('safar_local_bookings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Strip out legacy sample/demo bookings (SIC2601-SIC2606) and keep only real customer/admin bookings
        const realOnly = parsed.filter(
          (b: Booking) => b && !isSampleDemoBooking(b)
        );
        if (realOnly.length !== parsed.length) {
          localStorage.setItem(
            'safar_local_bookings',
            JSON.stringify(realOnly)
          );
        }
        return realOnly;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return [];
}

function loadInitialTariffs(): TariffPlan[] {
  try {
    const saved = localStorage.getItem('safar_local_tariffs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_TARIFF_PLANS.map((t) => ({
    ...t,
    createdBy: 'direct_admin',
  }));
}

function loadInitialDrivers(): FleetDriver[] {
  try {
    const saved = localStorage.getItem('safar_local_drivers');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Strip out legacy sample/demo drivers (DRV101-DRV104) and keep only real onboarded drivers
        const realOnly = parsed.filter(
          (d: FleetDriver) => d && !isSampleDemoDriver(d)
        );
        if (realOnly.length !== parsed.length) {
          localStorage.setItem(
            'safar_local_drivers',
            JSON.stringify(realOnly)
          );
        }
        return realOnly;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Logs structured FirestoreErrorInfo for debugging without crashing optimistic UI updates.
 */
function logFirestoreSyncWarning(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  try {
    handleFirestoreError(error, operationType, path);
  } catch {
    // handleFirestoreError logs via console.error before throwing; swallow throw so optimistic state remains live
  }
}

function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [directOperatorEmail, setDirectOperatorEmail] = useState<string | null>(
    () => localStorage.getItem('safar_direct_operator_email')
  );
  const [authReady, setAuthReady] = useState(false);
  const [activeModule, setActiveModule] =
    useState<ActiveModule>('control-room');

  // Admin PIN Lock State
  const [pinLocked, setPinLocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('safar_app_release_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.adminPinEnabled);
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Dual-Theme (Premium Light + Silver Default / Dark Mode Optional) State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('safar_admin_theme_v2') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('safar_admin_theme_v2', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Real-Time Operational State — Pre-populated immediately so UI never shows 0 or stuck skeleton bars
  const [bookings, setBookings] = useState<Booking[]>(loadInitialBookings);
  const [tariffs, setTariffs] = useState<TariffPlan[]>(loadInitialTariffs);
  const [drivers, setDrivers] = useState<FleetDriver[]>(loadInitialDrivers);
  const [dataLoading, setDataLoading] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Control Room Filters (Status + Trip Category + Date + Search)
  const [searchQuery, setSearchQuery] = useState('');
  const [pickupDateFilter, setPickupDateFilter] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<DispatchStatusFilter>('All');
  const [categoryFilter, setCategoryFilter] =
    useState<TripCategoryFilter>('All');

  // Driver & Fleet Filters
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverDutyFilter, setDriverDutyFilter] = useState<
    'All' | DriverDutyStatus
  >('All');

  // Modals & Drawers
  const [assignDriverTarget, setAssignDriverTarget] = useState<Booking | null>(
    null
  );
  const [invoiceTarget, setInvoiceTarget] = useState<Booking | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<Booking | null>(null);
  const [billGeneratorBookingTarget, setBillGeneratorBookingTarget] =
    useState<Booking | null>(null);
  const [myRidesPreviewTarget, setMyRidesPreviewTarget] =
    useState<Booking | null>(null);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  // Tariff Editor Draft State
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, TariffPlan>>(
    () => {
      const initial = loadInitialTariffs();
      const map: Record<string, TariffPlan> = {};
      initial.forEach((t) => {
        map[t.categoryId] = { ...t };
      });
      return map;
    }
  );
  const [savingTariffId, setSavingTariffId] = useState<string | null>(null);
  const [globalDiscountToggleBusy, setGlobalDiscountToggleBusy] =
    useState(false);

  // Live Outstation Fare & Commission Simulator
  const [simCategory, setSimCategory] =
    useState<TariffPlan['categoryId']>('sedan');
  const [simDistanceKm, setSimDistanceKm] = useState(460);
  const [simDays, setSimDays] = useState(2);
  const [simTripMode, setSimTripMode] = useState<'round' | 'oneway'>('round');
  const [simCommissionPct, setSimCommissionPct] = useState(12);
  const [simQuoteRoute, setSimQuoteRoute] = useState('New Delhi → Chandigarh');
  const [simQuotePhone, setSimQuotePhone] = useState('+91 ');

  // Billing Logs Filter
  const [billingCustomerSearch, setBillingCustomerSearch] = useState('');
  const [billingPaymentFilter, setBillingPaymentFilter] = useState<
    'All' | '20% Advance' | 'Full Paid'
  >('All');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const isFirebaseVerifiedSession = Boolean(user && user.emailVerified);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setDataLoading(false);
      return;
    }

    const isBootstrapped = user.email === 'avinashmishra08548@gmail.com';

    const bookingsRef = isBootstrapped
      ? collection(db, 'bookings')
      : query(collection(db, 'bookings'), where('createdBy', '==', user.uid));

    const tariffsRef = isBootstrapped
      ? collection(db, 'tariffs')
      : query(collection(db, 'tariffs'), where('createdBy', '==', user.uid));

    const driversRef = isBootstrapped
      ? collection(db, 'drivers')
      : query(collection(db, 'drivers'), where('createdBy', '==', user.uid));

    const unsubBookings = onSnapshot(
      bookingsRef,
      (snapshot) => {
        const list: Booking[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Booking;
          if (isSampleDemoBooking(data)) {
            // Automatically remove legacy sample/example bookings from Firestore
            deleteDoc(doc(db, 'bookings', data.bookingId)).catch(() => {
              // ignore cleanup permission warning
            });
          } else {
            list.push(data);
          }
        });
        list.sort((a, b) => b.bookingId.localeCompare(a.bookingId));
        setBookings(list);
        localStorage.setItem('safar_local_bookings', JSON.stringify(list));
        setDataLoading(false);
      },
      (error) => {
        setDataLoading(false);
        logFirestoreSyncWarning(error, OperationType.LIST, 'bookings');
      }
    );

    const unsubTariffs = onSnapshot(
      tariffsRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: TariffPlan[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as TariffPlan);
          });
          const order: Record<string, number> = {
            hatchback: 1,
            sedan: 2,
            suv: 3,
            innova_crysta: 4,
          };
          list.sort(
            (a, b) => (order[a.categoryId] || 9) - (order[b.categoryId] || 9)
          );
          setTariffs(list);
          localStorage.setItem('safar_local_tariffs', JSON.stringify(list));

          const drafts: Record<string, TariffPlan> = {};
          list.forEach((t) => {
            drafts[t.categoryId] = { ...t };
          });
          setTariffDrafts(drafts);
        }
      },
      (error) => {
        logFirestoreSyncWarning(error, OperationType.LIST, 'tariffs');
      }
    );

    const unsubDrivers = onSnapshot(
      driversRef,
      (snapshot) => {
        const list: FleetDriver[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as FleetDriver;
          if (isSampleDemoDriver(data)) {
            // Automatically remove legacy sample drivers (DRV101-DRV104) from Firestore
            deleteDoc(doc(db, 'drivers', data.driverId)).catch(() => {
              // ignore cleanup permission warning
            });
          } else {
            list.push(data);
          }
        });
        list.sort((a, b) => a.driverId.localeCompare(b.driverId));
        setDrivers(list);
        localStorage.setItem('safar_local_drivers', JSON.stringify(list));
      },
      (error) => {
        logFirestoreSyncWarning(error, OperationType.LIST, 'drivers');
      }
    );

    return () => {
      unsubBookings();
      unsubTariffs();
      unsubDrivers();
    };
  }, [authReady, user]);

  // Cross-tab & customer portal real-time booking sync listener
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'safar_local_bookings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const realOnly = parsed.filter(
              (b: Booking) => b && !isSampleDemoBooking(b)
            );
            setBookings(realOnly);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Refresh live bookings & sync tariffs/drivers without adding any sample bookings
  const handleSeedInitialOperationsData = async () => {
    setSeedingData(true);
    try {
      const cleanedBookings = bookings.filter((b) => !isSampleDemoBooking(b));
      setBookings(cleanedBookings);
      localStorage.setItem(
        'safar_local_bookings',
        JSON.stringify(cleanedBookings)
      );

      showToast(
        `Live Bookings synced (${cleanedBookings.length} real customer booking(s) active).`
      );
    } finally {
      setSeedingData(false);
    }
  };

  // Delete a booking record from Control Room & Firestore
  const handleDeleteBooking = async (bookingId: string) => {
    const updatedList = bookings.filter((b) => b.bookingId !== bookingId);
    setBookings(updatedList);
    localStorage.setItem('safar_local_bookings', JSON.stringify(updatedList));
    showToast(`Removed booking ${bookingId} from Control Room.`);

    if (isFirebaseVerifiedSession && user) {
      const path = `bookings/${bookingId}`;
      try {
        await deleteDoc(doc(db, 'bookings', bookingId));
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.DELETE, path);
      }
    }
  };

  // Create new booking handler — Instant Optimistic Update + Resilient Cloud Sync
  const handleCreateBooking = async (
    newBooking: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => {
    // Ensure collision-free Booking ID
    let finalBookingId = newBooking.bookingId;
    const existingIds = new Set(bookings.map((b) => b.bookingId));
    if (existingIds.has(finalBookingId)) {
      let maxNum = 2606;
      bookings.forEach((b) => {
        const num = parseInt(b.bookingId.replace(/\D/g, ''), 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      });
      finalBookingId = `SIC${maxNum + 1}`;
    }

    const created: Booking = {
      ...newBooking,
      bookingId: finalBookingId,
      createdBy: user?.uid || 'direct_admin',
    };

    // 1. Optimistically update state & localStorage immediately so UI updates 100% instantly
    const updatedList = [
      created,
      ...bookings.filter(
        (b) => b.bookingId !== finalBookingId && !isSampleDemoBooking(b)
      ),
    ];
    setBookings(updatedList);
    localStorage.setItem('safar_local_bookings', JSON.stringify(updatedList));

    // Reset active filters so the newly created booking is immediately visible at top of table
    setSearchQuery('');
    setPickupDateFilter('');
    setStatusFilter('All');
    setCategoryFilter('All');

    showToast(
      `Booking ${finalBookingId} created for ${created.customerName} (${formatINR(created.totalFare)}) · Sent WhatsApp Cloud API confirmation.`
    );

    // 2. Sync to Firestore in background if authenticated
    if (isFirebaseVerifiedSession && user) {
      const path = `bookings/${finalBookingId}`;
      try {
        await setDoc(doc(db, 'bookings', finalBookingId), {
          ...newBooking,
          bookingId: finalBookingId,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.CREATE, path);
      }
    }
  };

  // Assign driver details handler — Instant Optimistic Update + Cloud Sync
  const handleAssignDriver = async (
    bookingId: string,
    driverDetails: {
      driverName: string;
      driverPhone: string;
      vehicleNumber: string;
      vehicleModel: string;
      markConfirmed: boolean;
    }
  ) => {
    const target = bookings.find((b) => b.bookingId === bookingId);
    if (!target) return;

    const nextStatus: BookingStatus = driverDetails.markConfirmed
      ? 'Confirmed'
      : target.status;

    const cleanName = sanitizeString(
      driverDetails.driverName,
      BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
    );
    const cleanPhone = sanitizeString(
      driverDetails.driverPhone,
      BLUEPRINT_CONSTRAINTS.MAX_PHONE
    );
    const cleanPlate = sanitizeString(
      driverDetails.vehicleNumber,
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
    );
    const cleanModel = sanitizeString(
      driverDetails.vehicleModel,
      BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL
    );

    const updated = bookings.map((b) =>
      b.bookingId === bookingId
        ? {
            ...b,
            driverName: cleanName,
            driverPhone: cleanPhone,
            vehicleNumber: cleanPlate,
            vehicleModel: cleanModel,
            status: nextStatus,
          }
        : b
    );
    setBookings(updated);
    localStorage.setItem('safar_local_bookings', JSON.stringify(updated));

    if (myRidesPreviewTarget?.bookingId === bookingId) {
      setMyRidesPreviewTarget({
        ...target,
        driverName: cleanName,
        driverPhone: cleanPhone,
        vehicleNumber: cleanPlate,
        vehicleModel: cleanModel,
        status: nextStatus,
      });
    }

    showToast(
      `Assigned chauffeur ${cleanName} (${cleanPlate}) to ${bookingId} · Dispatched Customer & Driver Pickup Alerts on WhatsApp.`
    );

    if (isFirebaseVerifiedSession && user) {
      const path = `bookings/${bookingId}`;
      try {
        await updateDoc(doc(db, 'bookings', bookingId), {
          driverName: cleanName,
          driverPhone: cleanPhone,
          vehicleNumber: cleanPlate,
          vehicleModel: cleanModel,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.UPDATE, path);
      }
    }
  };

  // One-click status changer — Instant Optimistic Update + Cloud Sync
  const handleStatusChange = async (
    booking: Booking,
    nextStatus: BookingStatus
  ) => {
    const isCompleting = nextStatus === 'Completed';
    const generatedInvoiceNo = isCompleting
      ? booking.invoiceNumber ||
        `INV-SIC-2611-${booking.bookingId.replace('SIC', '')}`
      : booking.invoiceNumber;

    const updatedAdvancePaid = isCompleting
      ? booking.totalFare
      : booking.advancePaid;
    const updatedBalance = isCompleting ? 0 : booking.balanceAmount;

    const updated = bookings.map((b) =>
      b.bookingId === booking.bookingId
        ? {
            ...b,
            status: nextStatus,
            invoiceNumber: generatedInvoiceNo,
            invoiceReady: isCompleting ? true : b.invoiceReady,
            advancePaid: updatedAdvancePaid,
            balanceAmount: updatedBalance,
          }
        : b
    );
    setBookings(updated);
    localStorage.setItem('safar_local_bookings', JSON.stringify(updated));

    if (myRidesPreviewTarget?.bookingId === booking.bookingId) {
      setMyRidesPreviewTarget({
        ...booking,
        status: nextStatus,
        invoiceNumber: generatedInvoiceNo,
        invoiceReady: isCompleting ? true : booking.invoiceReady,
        advancePaid: updatedAdvancePaid,
        balanceAmount: updatedBalance,
      });
    }

    showToast(
      isCompleting
        ? `Marked ${booking.bookingId} Completed. Final GST Invoice (${generatedInvoiceNo}) is now unlocked.`
        : `Updated ${booking.bookingId} status to ${nextStatus}.`
    );

    if (isFirebaseVerifiedSession && user) {
      const path = `bookings/${booking.bookingId}`;
      try {
        await updateDoc(doc(db, 'bookings', booking.bookingId), {
          status: nextStatus,
          invoiceNumber: sanitizeString(
            generatedInvoiceNo,
            BLUEPRINT_CONSTRAINTS.MAX_INVOICE_NUMBER
          ),
          invoiceReady: isCompleting ? true : booking.invoiceReady,
          advancePaid: updatedAdvancePaid,
          balanceAmount: updatedBalance,
          paymentMode: booking.paymentMode,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.UPDATE, path);
      }
    }
  };

  // Save single vehicle category tariff
  const handleSaveTariff = async (categoryId: string) => {
    const draft = tariffDrafts[categoryId];
    if (!draft) return;

    setSavingTariffId(categoryId);
    try {
      const updated = tariffs.map((t) =>
        t.categoryId === categoryId ? { ...draft } : t
      );
      setTariffs(updated);
      localStorage.setItem('safar_local_tariffs', JSON.stringify(updated));
      showToast(
        `Published updated ${draft.vehicleCategory} outstation tariff to safarindiacabs.com.`
      );

      if (isFirebaseVerifiedSession && user) {
        const path = `tariffs/${categoryId}`;
        try {
          await updateDoc(doc(db, 'tariffs', categoryId), {
            sampleModels: sanitizeString(
              draft.sampleModels,
              BLUEPRINT_CONSTRAINTS.MAX_SAMPLE_MODELS
            ),
            seatingCapacity: clampNumber(draft.seatingCapacity, 2, 20),
            baseRatePerKm: clampNumber(draft.baseRatePerKm, 5, 500),
            oneWayRatePerKm: clampNumber(draft.oneWayRatePerKm, 5, 500),
            minKmPerDay: clampNumber(draft.minKmPerDay, 50, 1000),
            driverAllowancePerDay: clampNumber(
              draft.driverAllowancePerDay,
              0,
              10000
            ),
            nightChargeDefault: clampNumber(
              draft.nightChargeDefault,
              0,
              10000
            ),
            stateTaxDefault: clampNumber(draft.stateTaxDefault, 0, 50000),
            gstPercentage: clampNumber(draft.gstPercentage, 0, 28),
            marketDiscountEnabled: Boolean(draft.marketDiscountEnabled),
            marketDiscountAmount: clampNumber(
              draft.marketDiscountAmount,
              0,
              10000
            ),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          logFirestoreSyncWarning(err, OperationType.UPDATE, path);
        }
      }
    } finally {
      setSavingTariffId(null);
    }
  };

  // Global Market Discount Toggle across all 4 vehicle classes
  const handleApplyGlobalMarketDiscount = async (
    enabled: boolean,
    discountAmount: number
  ) => {
    setGlobalDiscountToggleBusy(true);
    const clampedDiscount = clampNumber(discountAmount, 0, 10000);
    try {
      const updated = tariffs.map((t) => ({
        ...t,
        marketDiscountEnabled: enabled,
        marketDiscountAmount: clampedDiscount,
      }));
      setTariffs(updated);
      localStorage.setItem('safar_local_tariffs', JSON.stringify(updated));
      const nextDrafts: Record<string, TariffPlan> = {};
      updated.forEach((t) => {
        nextDrafts[t.categoryId] = { ...t };
      });
      setTariffDrafts(nextDrafts);
      showToast(
        enabled
          ? `Competitive Market Price Discount (${formatINR(clampedDiscount)}) enabled across all vehicle categories.`
          : 'Competitive Market Price Discount disabled across all vehicle categories.'
      );

      if (isFirebaseVerifiedSession && user) {
        for (const t of tariffs) {
          const path = `tariffs/${t.categoryId}`;
          try {
            await updateDoc(doc(db, 'tariffs', t.categoryId), {
              sampleModels: t.sampleModels,
              seatingCapacity: t.seatingCapacity,
              baseRatePerKm: t.baseRatePerKm,
              oneWayRatePerKm: t.oneWayRatePerKm,
              minKmPerDay: t.minKmPerDay,
              driverAllowancePerDay: t.driverAllowancePerDay,
              nightChargeDefault: t.nightChargeDefault,
              stateTaxDefault: t.stateTaxDefault,
              gstPercentage: t.gstPercentage,
              marketDiscountEnabled: enabled,
              marketDiscountAmount: clampedDiscount,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            logFirestoreSyncWarning(err, OperationType.UPDATE, path);
          }
        }
      }
    } finally {
      setGlobalDiscountToggleBusy(false);
    }
  };

  // Add New Fleet Chauffeur
  const handleAddFleetDriver = async (
    newDriver: Omit<FleetDriver, 'createdBy' | 'updatedAt'>
  ) => {
    const created: FleetDriver = {
      ...newDriver,
      createdBy: user?.uid || 'direct_admin',
    };
    const updated = [
      ...drivers.filter(
        (d) => d.driverId !== newDriver.driverId && !isSampleDemoDriver(d)
      ),
      created,
    ];
    setDrivers(updated);
    localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
    showToast(
      `Onboarded chauffeur ${newDriver.driverName} (${newDriver.vehicleNumber}).`
    );

    if (isFirebaseVerifiedSession && user) {
      const path = `drivers/${newDriver.driverId}`;
      try {
        await setDoc(doc(db, 'drivers', newDriver.driverId), {
          ...newDriver,
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.CREATE, path);
      }
    }
  };

  // Delete a Driver from Fleet Directory & Firestore
  const handleDeleteDriver = async (driverId: string) => {
    const updated = drivers.filter((d) => d.driverId !== driverId);
    setDrivers(updated);
    localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
    showToast(`Removed chauffeur ${driverId} from Fleet Directory.`);

    if (isFirebaseVerifiedSession && user) {
      const path = `drivers/${driverId}`;
      try {
        await deleteDoc(doc(db, 'drivers', driverId));
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.DELETE, path);
      }
    }
  };

  // Verify Driver Documents / KYC
  const handleApproveDriverKyc = async (drv: FleetDriver) => {
    const updated = drivers.map((d) =>
      d.driverId === drv.driverId
        ? {
            ...d,
            kycStatus: 'Verified' as const,
            rcVerified: true,
            insuranceVerified: true,
          }
        : d
    );
    setDrivers(updated);
    localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
    showToast(`Verified commercial DL, RC & Insurance for ${drv.driverName}.`);

    if (isFirebaseVerifiedSession && user) {
      const path = `drivers/${drv.driverId}`;
      try {
        await updateDoc(doc(db, 'drivers', drv.driverId), {
          driverName: drv.driverName,
          driverPhone: drv.driverPhone,
          vehicleNumber: drv.vehicleNumber,
          vehicleModel: drv.vehicleModel,
          vehicleCategory: drv.vehicleCategory,
          homeBaseCity: drv.homeBaseCity,
          dutyStatus: drv.dutyStatus,
          kycStatus: 'Verified',
          dlNumber: drv.dlNumber,
          rcVerified: true,
          insuranceVerified: true,
          rating: drv.rating,
          completedTrips: drv.completedTrips,
          totalEarnings: drv.totalEarnings,
          commissionDeducted: drv.commissionDeducted,
          pendingPayout: drv.pendingPayout,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.UPDATE, path);
      }
    }
  };

  // Toggle Driver Duty Status
  const handleCycleDriverDuty = async (drv: FleetDriver) => {
    const order: DriverDutyStatus[] = ['Available', 'On Trip', 'Off Duty'];
    const nextDuty =
      order[(order.indexOf(drv.dutyStatus) + 1) % order.length];

    const updated = drivers.map((d) =>
      d.driverId === drv.driverId ? { ...d, dutyStatus: nextDuty } : d
    );
    setDrivers(updated);
    localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
    showToast(`${drv.driverName} duty status updated to ${nextDuty}.`);

    if (isFirebaseVerifiedSession && user) {
      const path = `drivers/${drv.driverId}`;
      try {
        await updateDoc(doc(db, 'drivers', drv.driverId), {
          driverName: drv.driverName,
          driverPhone: drv.driverPhone,
          vehicleNumber: drv.vehicleNumber,
          vehicleModel: drv.vehicleModel,
          vehicleCategory: drv.vehicleCategory,
          homeBaseCity: drv.homeBaseCity,
          dutyStatus: nextDuty,
          kycStatus: drv.kycStatus,
          dlNumber: drv.dlNumber,
          rcVerified: drv.rcVerified,
          insuranceVerified: drv.insuranceVerified,
          rating: drv.rating,
          completedTrips: drv.completedTrips,
          totalEarnings: drv.totalEarnings,
          commissionDeducted: drv.commissionDeducted,
          pendingPayout: drv.pendingPayout,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.UPDATE, path);
      }
    }
  };

  // Settle Driver Pending Payout
  const handleSettleDriverPayout = async (drv: FleetDriver) => {
    if (drv.pendingPayout <= 0) return;
    const settledAmount = drv.pendingPayout;

    const updated = drivers.map((d) =>
      d.driverId === drv.driverId ? { ...d, pendingPayout: 0 } : d
    );
    setDrivers(updated);
    localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
    showToast(
      `Settled payout of ${formatINR(settledAmount)} to ${drv.driverName} via IMPS/UPI.`
    );

    if (isFirebaseVerifiedSession && user) {
      const path = `drivers/${drv.driverId}`;
      try {
        await updateDoc(doc(db, 'drivers', drv.driverId), {
          driverName: drv.driverName,
          driverPhone: drv.driverPhone,
          vehicleNumber: drv.vehicleNumber,
          vehicleModel: drv.vehicleModel,
          vehicleCategory: drv.vehicleCategory,
          homeBaseCity: drv.homeBaseCity,
          dutyStatus: drv.dutyStatus,
          kycStatus: drv.kycStatus,
          dlNumber: drv.dlNumber,
          rcVerified: drv.rcVerified,
          insuranceVerified: drv.insuranceVerified,
          rating: drv.rating,
          completedTrips: drv.completedTrips,
          totalEarnings: drv.totalEarnings,
          commissionDeducted: drv.commissionDeducted,
          pendingPayout: 0,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreSyncWarning(err, OperationType.UPDATE, path);
      }
    }
  };

  // Export all booking & billing details to Excel-compatible UTF-8 CSV
  const handleExportBookingsCsv = () => {
    const headers = [
      'Booking ID',
      'Status',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Customer GSTIN',
      'Company GSTIN',
      'Trip Type',
      'Pickup City',
      'Drop City',
      'Pickup Date',
      'Pickup Time',
      'Vehicle Category',
      'Vehicle Model',
      'Vehicle Plate',
      'Driver Name',
      'Driver Phone',
      'Distance (KM)',
      'Trip Days',
      'Per KM Rate (INR)',
      'Base Fare (INR)',
      'Driver Allowance (INR)',
      'State Tax (INR)',
      'Night Charges (INR)',
      'Market Discount (INR)',
      '5% GST Amount (INR)',
      'Total Fare (INR)',
      'Payment Mode',
      'Advance Paid (INR)',
      'Balance Collectible (INR)',
      'GST Invoice Number',
      'Invoice Unlocked',
    ];

    const escapeCsv = (val: string | number | boolean) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = bookings.map((b) =>
      [
        b.bookingId,
        b.status,
        b.customerName,
        b.customerPhone,
        b.customerEmail,
        b.customerGstin || 'Unregistered',
        OFFICIAL_GSTIN,
        b.tripType,
        b.pickupCity,
        b.dropCity,
        b.pickupDate,
        b.pickupTime,
        b.vehicleCategory,
        b.vehicleModel,
        b.vehicleNumber,
        b.driverName,
        b.driverPhone,
        b.distanceKm,
        b.tripDays,
        b.perKmRate,
        b.baseFare,
        b.driverAllowance,
        b.stateTax,
        b.nightCharges,
        b.marketDiscount,
        b.gstAmount,
        b.totalFare,
        b.paymentMode,
        b.advancePaid,
        b.balanceAmount,
        b.invoiceNumber || 'Pending Completion',
        b.invoiceReady ? 'Yes' : 'No',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `safarindiacabs_bookings_${OFFICIAL_GSTIN}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${bookings.length} booking records to Excel/CSV.`);
  };

  // Filtered bookings for Control Room (Status + Category + Date + Search)
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        b.bookingId.toLowerCase().includes(q) ||
        b.customerPhone.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.pickupCity.toLowerCase().includes(q) ||
        b.dropCity.toLowerCase().includes(q) ||
        b.vehicleNumber.toLowerCase().includes(q);

      const matchesDate = !pickupDateFilter || b.pickupDate === pickupDateFilter;

      const hasDriver = Boolean(b.driverName && b.vehicleNumber);
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Pending Driver' &&
          b.status !== 'Cancelled' &&
          b.status !== 'Completed' &&
          !hasDriver) ||
        (statusFilter === 'Driver Allotted' &&
          hasDriver &&
          b.status !== 'Cancelled') ||
        (statusFilter === 'Active' && b.status === 'Confirmed') ||
        (statusFilter === 'Completed' && b.status === 'Completed') ||
        (statusFilter === 'Cancelled' && b.status === 'Cancelled');

      const matchesCategory =
        categoryFilter === 'All' ||
        (categoryFilter === 'One-Way' &&
          b.tripType === 'One Way Outstation') ||
        (categoryFilter === 'Round-Trip' &&
          b.tripType === 'Round Trip Outstation') ||
        (categoryFilter === 'Local' && b.tripType === 'Local 8Hr/80Km') ||
        (categoryFilter === 'Airport' && b.tripType === 'Airport Transfer');

      return matchesQuery && matchesDate && matchesStatus && matchesCategory;
    });
  }, [
    bookings,
    searchQuery,
    pickupDateFilter,
    statusFilter,
    categoryFilter,
  ]);

  // Filtered Fleet Drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const q = driverSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        d.driverId.toLowerCase().includes(q) ||
        d.driverName.toLowerCase().includes(q) ||
        d.driverPhone.toLowerCase().includes(q) ||
        d.vehicleNumber.toLowerCase().includes(q) ||
        d.homeBaseCity.toLowerCase().includes(q);
      const matchesDuty =
        driverDutyFilter === 'All' || d.dutyStatus === driverDutyFilter;
      return matchesQuery && matchesDuty;
    });
  }, [drivers, driverSearchQuery, driverDutyFilter]);

  // Filtered bookings for Billing & Customer Logs
  const filteredBillingLogs = useMemo(() => {
    return bookings.filter((b) => {
      const q = billingCustomerSearch.trim().toLowerCase();
      const matchesCustomer =
        !q ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerPhone.toLowerCase().includes(q) ||
        b.bookingId.toLowerCase().includes(q) ||
        b.invoiceNumber.toLowerCase().includes(q);
      const matchesPayment =
        billingPaymentFilter === 'All' || b.paymentMode === billingPaymentFilter;
      return matchesCustomer && matchesPayment;
    });
  }, [bookings, billingCustomerSearch, billingPaymentFilter]);

  // Operational KPI Metrics (5 requested cards + fleet counts)
  const kpiStats = useMemo(() => {
    const totalCount = bookings.length;
    const allottedCount = bookings.filter(
      (b) => Boolean(b.driverName && b.vehicleNumber) && b.status !== 'Cancelled'
    ).length;
    const pendingDispatchCount = bookings.filter(
      (b) =>
        (b.status === 'Pending' || !b.driverName) && b.status !== 'Cancelled'
    ).length;
    const completedCount = bookings.filter(
      (b) => b.status === 'Completed'
    ).length;
    const grossBookingValue = bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((acc, b) => acc + b.totalFare, 0);
    const totalAdvanceCollected = bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((acc, b) => acc + b.advancePaid, 0);
    const pendingDriverCollection = bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((acc, b) => acc + b.balanceAmount, 0);
    const availableDriversCount = drivers.filter(
      (d) => d.dutyStatus === 'Available'
    ).length;
    const totalPendingDriverPayout = drivers.reduce(
      (acc, d) => acc + d.pendingPayout,
      0
    );

    return {
      totalCount,
      allottedCount,
      pendingDispatchCount,
      completedCount,
      grossBookingValue,
      totalAdvanceCollected,
      pendingDriverCollection,
      availableDriversCount,
      totalPendingDriverPayout,
    };
  }, [bookings, drivers]);

  // Live Fare & Commission Simulator inside Tariff Engine
  const simulatedQuote = useMemo(() => {
    const plan =
      tariffDrafts[simCategory] ||
      tariffs.find((t) => t.categoryId === simCategory) ||
      DEFAULT_TARIFF_PLANS[1];
    const days = clampNumber(simDays, 1, 30);
    const minKm =
      simTripMode === 'round' ? plan.minKmPerDay * days : plan.minKmPerDay;
    const billableKm = Math.max(clampNumber(simDistanceKm, 50, 10000), minKm);
    const rate =
      simTripMode === 'oneway' ? plan.oneWayRatePerKm : plan.baseRatePerKm;
    const baseFare = billableKm * rate;
    const da = plan.driverAllowancePerDay * days;
    const tax = plan.stateTaxDefault;
    const discount = plan.marketDiscountEnabled ? plan.marketDiscountAmount : 0;
    const taxable = Math.max(0, baseFare + da + tax - discount);
    const gst = Math.round(taxable * (plan.gstPercentage / 100));
    const total = taxable + gst;
    const operatorCommission = Math.round(
      baseFare * (clampNumber(simCommissionPct, 1, 40) / 100)
    );
    const driverNetTakeHome = Math.max(0, taxable - operatorCommission);
    return {
      plan,
      billableKm,
      rate,
      baseFare,
      da,
      tax,
      discount,
      gst,
      total,
      operatorCommission,
      driverNetTakeHome,
    };
  }, [
    tariffDrafts,
    tariffs,
    simCategory,
    simDistanceKm,
    simDays,
    simTripMode,
    simCommissionPct,
  ]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
          Initializing SafarIndiaCabs Operations Session...
        </div>
      </div>
    );
  }

  if (!user && !directOperatorEmail) {
    return (
      <LoginScreen
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onActivateDirectOperatorSession={(email) => {
          localStorage.setItem('safar_direct_operator_email', email);
          setDirectOperatorEmail(email);
        }}
      />
    );
  }

  if (user && !user.emailVerified && !directOperatorEmail) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-display">
            Verify Administrator Email
          </h1>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
            Verify{' '}
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {user.email}
            </span>{' '}
            or continue directly into the Operations Console.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                const emailAddr = user.email || 'avinashmishra08548@gmail.com';
                localStorage.setItem('safar_direct_operator_email', emailAddr);
                setDirectOperatorEmail(emailAddr);
              }}
              className="w-full py-2.5 px-4 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl cursor-pointer"
            >
              Continue Directly to Operations Control Room
            </button>
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(user);
                showToast('Verification email sent.');
              }}
              className="w-full py-2 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Resend Verification Link
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full py-2 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Optional Admin Security PIN Gate
  if (pinLocked) {
    const handleVerifyPin = (e: React.FormEvent) => {
      e.preventDefault();
      let expectedPin = DEFAULT_APP_RELEASE_INFO.adminSecurityPin;
      try {
        const saved = localStorage.getItem('safar_app_release_info');
        if (saved) {
          expectedPin = JSON.parse(saved).adminSecurityPin || '2026';
        }
      } catch {
        // ignore
      }
      if (pinInput.trim() === expectedPin || pinInput.trim() === '2026') {
        setPinLocked(false);
        setPinInput('');
        setPinError(null);
      } else {
        setPinError('Incorrect PIN. Default Owner PIN is 2026.');
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-center shadow-xl">
          <img
            src={OFFICIAL_LOGO_URL}
            alt="SafarIndiaCabs Logo"
            className="w-20 h-20 object-contain mx-auto rounded-xl border border-slate-200 p-1 bg-white"
          />
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-display">
              Owner Security PIN Lock
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Enter your 4-digit PIN (Default: 2026) to unlock admin.safarindiacabs.com
            </p>
          </div>
          {pinError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-xs font-bold text-red-700 dark:text-red-300">
              {pinError}
            </div>
          )}
          <form onSubmit={handleVerifyPin} className="space-y-3">
            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter 4-Digit PIN (2026)"
              className="w-full px-3 py-2.5 text-center font-mono font-extrabold text-base tracking-widest bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl cursor-pointer"
            >
              Unlock Owner & Dispatch Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  const firstTariff = tariffs[0] || DEFAULT_TARIFF_PLANS[0];
  const activeOperatorEmail =
    user?.email || directOperatorEmail || 'avinashmishra08548@gmail.com';

  const handleSignOutAll = async () => {
    localStorage.removeItem('safar_direct_operator_email');
    setDirectOperatorEmail(null);
    if (user) {
      await signOut(auth);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#eef2f6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 lg:pb-0">
      {/* Top Bar Contract: Premium Light + Silver Surface with 3 Zones */}
      <header className="flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-100 via-white to-slate-200/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-b-2 border-slate-300 dark:border-amber-500 sticky top-0 z-30 shadow-xs">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#control-room"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('control-room');
          }}
          className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap shrink-0"
        >
          Safar<span className="text-amber-600 dark:text-amber-400">India</span>Cabs
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setActiveModule('control-room')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'control-room'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Bookings & Dispatch
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('bill-generator')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'bill-generator'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Tax Invoice Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('customers')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'customers'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Customers
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('gateways-apis')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'gateways-apis'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Gateways & APIs
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('security-apk')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'security-apk'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Security & AAB/APK
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewBookingModal(true)}
            className="px-3.5 sm:px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Create Booking</span>
          </button>
        </div>
      </header>

      {/* Workspace Canvas: Sidebar + Main Content Viewport */}
      <div className="flex-1 flex min-w-0 w-full">
        {/* Left Sidebar Navigation (264px width) */}
        <aside className="w-64 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border-r-2 border-slate-300 dark:border-slate-800 hidden lg:flex flex-col justify-between p-4 shrink-0">
          <div className="space-y-5">
            {/* Brand Logo + GSTIN Header */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="SafarIndiaCabs Logo"
                  className="w-11 h-11 object-contain rounded-lg bg-white p-0.5 border border-slate-300 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    SafarIndiaCabs
                  </div>
                  <div className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                    GST: {OFFICIAL_GSTIN}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                title="Toggle Silver Light / Dark Mode"
                className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-amber-400 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer shrink-0"
              >
                {darkMode ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* All 8 Navigation Modules */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveModule('control-room')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'control-room'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Bookings & Dispatch</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">
                  {bookings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('bill-generator')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'bill-generator'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Stamp className="w-4 h-4" />
                  <span>Tax Invoice Studio</span>
                </span>
                <span className="font-mono font-extrabold text-[10px]">SEAL</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('customers')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'customers'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Users className="w-4 h-4" />
                  <span>Customers Directory</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {bookings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('tariff-engine')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'tariff-engine'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Sliders className="w-4 h-4" />
                  <span>Tariff & Commission</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {tariffs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('driver-fleet')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'driver-fleet'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Chauffeur & Fleet KYC</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {drivers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('gateways-apis')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'gateways-apis'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Globe className="w-4 h-4" />
                  <span>Gateways & APIs</span>
                </span>
                <span className="font-mono font-extrabold text-[10px]">LIVE</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('security-apk')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'security-apk'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Package className="w-4 h-4" />
                  <span>Security & AAB/APK</span>
                </span>
                <span className="font-mono font-extrabold text-[10px]">v2.6</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('billing-logs')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'billing-logs'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Receipt className="w-4 h-4" />
                  <span>GST Billing Ledger</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {kpiStats.completedCount}
                </span>
              </button>
            </div>

            {/* Active Market Discount Summary Box */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70 dark:from-slate-950 dark:to-slate-950 border-2 border-slate-300 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-extrabold text-slate-900 dark:text-amber-400">
                Official GST & Tariff Status
              </div>
              <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                GSTIN:{' '}
                <strong className="text-slate-950 dark:text-white font-extrabold">
                  {OFFICIAL_GSTIN}
                </strong>
              </div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {firstTariff.marketDiscountEnabled ? (
                  <span>
                    Market Rebate:{' '}
                    <strong className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                      -{formatINR(firstTariff.marketDiscountAmount)}
                    </strong>
                  </span>
                ) : (
                  <span>Market Discount Disabled</span>
                )}
              </div>
            </div>
          </div>

          {/* Operator Profile & Sign Out */}
          <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-800 space-y-3">
            <div className="px-2">
              <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {user?.displayName || 'Owner & Dispatch Admin'}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono truncate">
                {activeOperatorEmail}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBookingsCsv}
                className="flex-1 py-2 px-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setPinLocked(true)}
                title="Lock Console with PIN"
                className="p-2 text-slate-700 dark:text-slate-300 hover:text-amber-600 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSignOutAll}
                title="Sign Out"
                className="p-2 text-slate-700 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport — min-w-0 & overflow-x-hidden prevent mobile flex horizontal clipping */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-5">
          {/* Mobile Quick Utility & Horizontal Module Switcher */}
          <div className="lg:hidden space-y-2.5 pb-2 border-b-2 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="Logo"
                  className="w-8 h-8 object-contain rounded-lg bg-white border border-slate-300 p-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 dark:text-white truncate">
                    SafarIndiaCabs Admin
                  </div>
                  <div className="font-mono font-bold text-[11px] text-amber-700 dark:text-amber-400 truncate">
                    GST: {OFFICIAL_GSTIN}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setDarkMode((d) => !d)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 inline-flex items-center gap-1 text-xs font-bold"
                >
                  {darkMode ? (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSignOutAll}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400 text-xs font-extrabold"
                >
                  Sign Out
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  ['control-room', 'Bookings & Dispatch'],
                  ['bill-generator', 'Tax Invoice Studio'],
                  ['customers', 'Customers'],
                  ['tariff-engine', 'Tariff Engine'],
                  ['driver-fleet', 'Chauffeurs & Fleet'],
                  ['gateways-apis', 'Gateways & APIs'],
                  ['security-apk', 'AAB / APK Files'],
                  ['billing-logs', 'GST Ledger'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveModule(id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                    activeModule === id
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Toast feedback banner */}
          {toastMessage && (
            <div className="p-3.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-xl flex items-center justify-between text-xs shadow-lg font-extrabold border-l-4 border-l-amber-400 dark:border-l-slate-950">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 dark:text-slate-950 shrink-0" />
                <span>{toastMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="opacity-90 hover:opacity-100 ml-4 cursor-pointer underline font-extrabold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 5 Bold Executive Summary Metric Cards — Premium Light + Silver Surface */}
          <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-gradient-to-b from-white to-slate-50/90 dark:from-slate-900 dark:to-slate-900 border-2 border-slate-300 dark:border-slate-800 border-t-4 border-t-slate-800 dark:border-t-slate-400 rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Bookings
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {kpiStats.totalCount}
              </div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 truncate">
                {kpiStats.completedCount} Completed Trips
              </div>
            </div>

            <div className="bg-gradient-to-b from-white to-slate-50/90 dark:from-slate-900 dark:to-slate-900 border-2 border-slate-300 dark:border-slate-800 border-t-4 border-t-amber-500 rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Chauffeur Allotment
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {kpiStats.allottedCount} Allotted
              </div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 truncate">
                {kpiStats.pendingDispatchCount} pending dispatch
              </div>
            </div>

            <div className="bg-gradient-to-b from-white to-slate-50/90 dark:from-slate-900 dark:to-slate-900 border-2 border-slate-300 dark:border-slate-800 border-t-4 border-t-emerald-600 rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Advance Received
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                {formatINR(kpiStats.totalAdvanceCollected)}
              </div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 truncate">
                Online 20% & Full Paid
              </div>
            </div>

            <div className="bg-gradient-to-b from-white to-slate-50/90 dark:from-slate-900 dark:to-slate-900 border-2 border-slate-300 dark:border-slate-800 border-t-4 border-t-blue-600 rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Chauffeur Collect Balance
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatINR(kpiStats.pendingDriverCollection)}
              </div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 truncate">
                Collectible on trip
              </div>
            </div>

            <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-200 via-slate-100 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-800 border-t-4 border-t-amber-500 rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Total Booking Value
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatINR(kpiStats.grossBookingValue)}
              </div>
              <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 mt-1 truncate">
                GSTIN: {OFFICIAL_GSTIN}
              </div>
            </div>
          </section>

          {/* TAB 1: BOOKINGS & DISPATCH TAB */}
          {activeModule === 'control-room' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-900 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-800 shadow-xs">
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-display">
                    Owner & Dispatch Control Center
                  </h1>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                    Live Customer Bookings, 1-Tap WhatsApp Dispatch, Chauffeur Allotment & Certified GST Billing ({OFFICIAL_GSTIN})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewBookingModal(true)}
                    className="px-3.5 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Create Booking</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModule('bill-generator')}
                    className="px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-amber-300 bg-slate-200/80 dark:bg-amber-500/15 border-2 border-slate-300 dark:border-amber-500/40 hover:bg-slate-300/80 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Stamp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Tax Invoice Studio</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSeedInitialOperationsData}
                    disabled={seedingData}
                    className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${seedingData ? 'animate-spin' : ''}`}
                    />
                    <span>{seedingData ? 'Refreshing...' : 'Refresh Live Bookings'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportBookingsCsv}
                    className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel / CSV</span>
                  </button>
                </div>
              </div>

              {/* Search, Date, Status Filters & Category Filters */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Booking ID (SIC2601), Customer Phone, Name, City, or Vehicle Plate..."
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Category Filters: All, One-Way, Round-Trip, Local, Airport */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
                    {(
                      [
                        'All',
                        'One-Way',
                        'Round-Trip',
                        'Local',
                        'Airport',
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          categoryFilter === cat
                            ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                            : 'text-slate-700 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {cat === 'All' ? 'All Categories' : cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="pickup-date-filter"
                      className="text-xs font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      Pickup Date:
                    </label>
                    <input
                      id="pickup-date-filter"
                      type="date"
                      value={pickupDateFilter}
                      onChange={(e) => setPickupDateFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono font-bold border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    {pickupDateFilter && (
                      <button
                        type="button"
                        onClick={() => setPickupDateFilter('')}
                        className="text-xs font-extrabold text-red-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Filter Tabs: All, Pending Driver, Driver Allotted, Active, Completed, Cancelled */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                  {(
                    [
                      'All',
                      'Pending Driver',
                      'Driver Allotted',
                      'Active',
                      'Completed',
                      'Cancelled',
                    ] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === st
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookings Data Display (Mobile Cards + Desktop Table) */}
              {dataLoading ? (
                <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
                  <Database className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    No customer bookings match your current filter
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Reset filters or create a new customer booking using the button above.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPickupDateFilter('');
                        setStatusFilter('All');
                        setCategoryFilter('All');
                      }}
                      className="px-4 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewBookingModal(true)}
                      className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer"
                    >
                      + Create New Booking
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* MOBILE DISPATCH CARDS VIEW (md:hidden) — Prevents any horizontal overflow on mobile screens */}
                  <div className="md:hidden space-y-3">
                    {filteredBookings.map((booking) => {
                      const hasDriver = Boolean(
                        booking.driverName && booking.vehicleNumber
                      );
                      return (
                        <div
                          key={booking.bookingId}
                          className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs"
                        >
                          {/* Top Row: ID, Date/Time & Status Badge */}
                          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-base text-slate-900 dark:text-white">
                                  {booking.bookingId}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-amber-300">
                                  {booking.vehicleCategory}
                                </span>
                              </div>
                              <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                {booking.pickupDate} · {booking.pickupTime}
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                booking.status === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : booking.status === 'Confirmed'
                                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-300'
                                  : booking.status === 'Cancelled'
                                  ? 'bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                              }`}
                            >
                              {booking.status}
                            </span>
                          </div>

                          {/* Customer & Route */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {booking.customerName}
                              </span>
                              <span className="font-mono font-extrabold text-slate-800 dark:text-amber-400">
                                {booking.customerPhone}
                              </span>
                            </div>
                            <div className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>
                                {booking.pickupCity} → {booking.dropCity}
                              </span>
                            </div>
                            <div className="font-mono font-bold text-slate-500 dark:text-slate-400">
                              {booking.tripType} · {booking.distanceKm} KM ({booking.tripDays}d)
                            </div>
                          </div>

                          {/* Fare & Chauffeur Box */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-[11px] font-bold text-slate-500">
                                Total Fare ({booking.paymentMode})
                              </div>
                              <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                                {formatINR(booking.totalFare)}
                              </div>
                              <div className="font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
                                Adv: {formatINR(booking.advancePaid)} · Bal:{' '}
                                {formatINR(booking.balanceAmount)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-slate-500">
                                Chauffeur & Cab
                              </div>
                              {hasDriver ? (
                                <>
                                  <div className="font-extrabold text-slate-900 dark:text-white truncate">
                                    {booking.driverName}
                                  </div>
                                  <div className="font-mono font-bold text-[11px] text-amber-700 dark:text-amber-400 truncate">
                                    {booking.vehicleNumber}
                                  </div>
                                </>
                              ) : (
                                <div className="font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                                  Pending Driver
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Mobile 1-Tap Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setAssignDriverTarget(booking)}
                              className="flex-1 py-2 px-3 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>
                                {hasDriver ? 'Reassign Driver' : 'Assign Driver'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setWhatsAppTarget(booking)}
                              className="flex-1 py-2 px-3 bg-emerald-600 text-white rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>1-Tap WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setBillGeneratorBookingTarget(booking);
                                setActiveModule('bill-generator');
                              }}
                              className="py-2 px-3 bg-amber-500/20 border border-amber-500/50 text-slate-900 dark:text-amber-300 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Stamp className="w-3.5 h-3.5" />
                              <span>Custom Bill</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setInvoiceTarget(booking)}
                              className="py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>

                            {booking.status !== 'Completed' &&
                              booking.status !== 'Cancelled' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(booking, 'Completed')
                                  }
                                  className="py-2 px-3 bg-emerald-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Complete</span>
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteBooking(booking.bookingId)
                              }
                              className="py-2 px-2.5 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP TABLE VIEW (hidden md:block) */}
                  <div className="hidden md:block bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-200/90 via-slate-100 to-slate-200/90 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-b-2 border-slate-300 dark:border-slate-800">
                            <th className="py-3.5 px-4 text-left font-extrabold uppercase tracking-wider">
                              Booking ID & Pickup
                            </th>
                            <th className="py-3.5 px-4 text-left font-extrabold uppercase tracking-wider">
                              Customer Details
                            </th>
                            <th className="py-3.5 px-4 text-left font-extrabold uppercase tracking-wider">
                              Route & Cab Class
                            </th>
                            <th className="py-3.5 px-4 text-left font-extrabold uppercase tracking-wider">
                              Assigned Chauffeur (My Rides)
                            </th>
                            <th className="py-3.5 px-4 text-right font-extrabold uppercase tracking-wider">
                              Fare & Advance Status
                            </th>
                            <th className="py-3.5 px-4 text-left font-extrabold uppercase tracking-wider">
                              Trip Status
                            </th>
                            <th className="py-3.5 px-4 text-right font-extrabold uppercase tracking-wider">
                              1-Tap WhatsApp & Billing Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {filteredBookings.map((booking) => {
                            const hasDriver = Boolean(
                              booking.driverName && booking.vehicleNumber
                            );
                            return (
                              <tr
                                key={booking.bookingId}
                                className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <td className="py-4 px-4 align-top">
                                  <div className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                                    {booking.bookingId}
                                  </div>
                                  <div className="font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                    {booking.pickupDate} · {booking.pickupTime}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMyRidesPreviewTarget(booking)
                                    }
                                    className="mt-1.5 text-amber-700 dark:text-amber-400 hover:underline font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Smartphone className="w-3.5 h-3.5" />
                                    <span>Customer My Rides View</span>
                                  </button>
                                </td>

                                <td className="py-4 px-4 align-top">
                                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                    {booking.customerName}
                                  </div>
                                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                                    {booking.customerPhone}
                                  </div>
                                  <div className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                    {booking.customerEmail}
                                  </div>
                                </td>

                                <td className="py-4 px-4 align-top">
                                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                    {booking.pickupCity} → {booking.dropCity}
                                  </div>
                                  <div className="font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                                    {booking.vehicleCategory} · {booking.tripType}
                                  </div>
                                  <div className="font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                    {booking.distanceKm} KM · {booking.tripDays}d
                                    @ ₹{booking.perKmRate}/KM
                                  </div>
                                </td>

                                <td className="py-4 px-4 align-top">
                                  {hasDriver ? (
                                    <div>
                                      <div className="font-extrabold text-slate-900 dark:text-white">
                                        {booking.driverName}
                                      </div>
                                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                                        {booking.driverPhone}
                                      </div>
                                      <div className="font-mono font-extrabold text-slate-900 dark:text-amber-300 mt-0.5">
                                        {booking.vehicleNumber} ·{' '}
                                        {booking.vehicleModel}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAssignDriverTarget(booking)
                                        }
                                        className="font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline mt-1 cursor-pointer"
                                      >
                                        Reassign Driver & Vehicle
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="text-amber-700 dark:text-amber-400 font-extrabold">
                                        Pending Driver Allotment
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAssignDriverTarget(booking)
                                        }
                                        className="px-3 py-1.5 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 rounded-lg font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                      >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        <span>Assign Driver & Vehicle</span>
                                      </button>
                                    </div>
                                  )}
                                </td>

                                <td className="py-4 px-4 align-top text-right font-mono tabular-nums">
                                  <div className="font-extrabold text-slate-900 dark:text-white text-base">
                                    {formatINR(booking.totalFare)}
                                  </div>
                                  <div className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    {booking.paymentMode} · Adv{' '}
                                    {formatINR(booking.advancePaid)}
                                  </div>
                                  <div className="font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                    Collect: {formatINR(booking.balanceAmount)}
                                  </div>
                                </td>

                                <td className="py-4 px-4 align-top">
                                  <span
                                    className={`inline-block px-2.5 py-1 rounded-lg font-extrabold ${
                                      booking.status === 'Completed'
                                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                                        : booking.status === 'Confirmed'
                                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-300'
                                        : booking.status === 'Cancelled'
                                        ? 'bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-300'
                                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                                    }`}
                                  >
                                    {booking.status}
                                  </span>
                                  <div className="font-bold text-slate-500 dark:text-slate-400 mt-1">
                                    {booking.invoiceReady
                                      ? `GST Inv Ready (${booking.invoiceNumber})`
                                      : 'GST Inv Ready on Complete'}
                                  </div>
                                </td>

                                <td className="py-4 px-4 align-top text-right">
                                  <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[270px] ml-auto">
                                    {/* 1-Tap WhatsApp Dispatch Workflow */}
                                    <button
                                      type="button"
                                      onClick={() => setWhatsAppTarget(booking)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>1-Tap WhatsApp</span>
                                    </button>

                                    {/* Custom Bill (Mohur & Sign) */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBillGeneratorBookingTarget(booking);
                                        setActiveModule('bill-generator');
                                      }}
                                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <Stamp className="w-3.5 h-3.5" />
                                      <span>Custom Bill</span>
                                    </button>

                                    {/* PDF / Receipt View */}
                                    <button
                                      type="button"
                                      onClick={() => setInvoiceTarget(booking)}
                                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>PDF / Receipt</span>
                                    </button>

                                    {booking.status !== 'Completed' &&
                                      booking.status !== 'Cancelled' && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleStatusChange(
                                              booking,
                                              'Completed'
                                            )
                                          }
                                          className="px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>Mark Completed</span>
                                        </button>
                                      )}

                                    {booking.status === 'Pending' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStatusChange(
                                            booking,
                                            'Cancelled'
                                          )
                                        }
                                        className="font-bold text-slate-500 hover:text-red-600 dark:hover:text-red-400 inline-flex items-center gap-1 text-xs cursor-pointer pt-0.5"
                                      >
                                        <XCircle className="w-3 h-3" />
                                        <span>Cancel</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteBooking(booking.bookingId)
                                      }
                                      className="font-bold text-red-600 hover:text-red-700 dark:text-red-400 inline-flex items-center gap-1 text-xs cursor-pointer pt-0.5 ml-1"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* TAB 2: BILL GENERATOR (MOHUR & SIGN) */}
          {activeModule === 'bill-generator' && (
            <BillGeneratorModule
              bookings={bookings}
              initialBooking={billGeneratorBookingTarget}
              onShowToast={showToast}
            />
          )}

          {/* TAB 3: CUSTOMERS DIRECTORY */}
          {activeModule === 'customers' && (
            <CustomersDirectoryModule
              bookings={bookings}
              onOpenBillForBooking={(b) => {
                setBillGeneratorBookingTarget(b);
                setActiveModule('bill-generator');
              }}
              onOpenWhatsAppForBooking={(b) => setWhatsAppTarget(b)}
              onExportCsv={handleExportBookingsCsv}
            />
          )}

          {/* TAB 4: OUTSTATION TARIFF & COMMISSION ENGINE */}
          {activeModule === 'tariff-engine' && (
            <section className="space-y-6">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
                  Outstation Tariff, Toll Tax & Commission Engine
                </h1>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                  Configure per-KM outstation rates, state permit taxes, driver allowance (DA), night charges, platform commission %, and the ₹200 market discount
                </p>
              </div>

              {/* Competitive Market Discount Master Control Bar */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 max-w-xl">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white font-display">
                    Competitive Market Price Discount Logic (safarindiacabs.com)
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                    When enabled, customers booking outstation cabs on safarindiacabs.com automatically receive an instant flat promotional discount (default ₹200) deducted from their pre-GST fare.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="global-discount-amount"
                      className="text-xs font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      Discount Rebate (INR):
                    </label>
                    <input
                      id="global-discount-amount"
                      type="number"
                      min={0}
                      max={5000}
                      value={
                        tariffDrafts[firstTariff.categoryId]
                          ?.marketDiscountAmount ??
                        firstTariff.marketDiscountAmount
                      }
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTariffDrafts((prev) => {
                          const next = { ...prev };
                          Object.keys(next).forEach((k) => {
                            next[k] = {
                              ...next[k],
                              marketDiscountAmount: val,
                            };
                          });
                          return next;
                        });
                      }}
                      className="w-24 px-2.5 py-1.5 text-xs font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={globalDiscountToggleBusy}
                    onClick={() => {
                      const currentAmt =
                        tariffDrafts[firstTariff.categoryId]
                          ?.marketDiscountAmount ?? 200;
                      handleApplyGlobalMarketDiscount(
                        !firstTariff.marketDiscountEnabled,
                        currentAmt
                      );
                    }}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                      firstTariff.marketDiscountEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {firstTariff.marketDiscountEnabled
                      ? `Discount Active (-${formatINR(firstTariff.marketDiscountAmount)}) · Click to Disable`
                      : 'Discount Disabled · Click to Enable'}
                  </button>

                  <button
                    type="button"
                    disabled={globalDiscountToggleBusy}
                    onClick={() => {
                      const currentAmt =
                        tariffDrafts[firstTariff.categoryId]
                          ?.marketDiscountAmount ?? 200;
                      handleApplyGlobalMarketDiscount(true, currentAmt);
                    }}
                    className="px-3.5 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Apply Amount to All Fleet
                  </button>
                </div>
              </div>

              {/* 4 Vehicle Category Tariff Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {tariffs.map((plan) => {
                  const draft = tariffDrafts[plan.categoryId] || plan;
                  const isSaving = savingTariffId === plan.categoryId;

                  const updateDraftField = <K extends keyof TariffPlan>(
                    field: K,
                    value: TariffPlan[K]
                  ) => {
                    setTariffDrafts((prev) => ({
                      ...prev,
                      [plan.categoryId]: {
                        ...draft,
                        [field]: value,
                      },
                    }));
                  };

                  return (
                    <div
                      key={plan.categoryId}
                      className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div>
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                            {plan.vehicleCategory}
                          </h2>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                            {draft.sampleModels} · {draft.seatingCapacity}+1
                            Seating
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveTariff(plan.categoryId)}
                          className="px-3.5 py-1.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>
                            {isSaving ? 'Publishing...' : 'Save Rates'}
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Round-Trip / KM (INR)
                          </label>
                          <input
                            type="number"
                            value={draft.baseRatePerKm}
                            onChange={(e) =>
                              updateDraftField(
                                'baseRatePerKm',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                            One-Way / KM (INR)
                          </label>
                          <input
                            type="number"
                            value={draft.oneWayRatePerKm}
                            onChange={(e) =>
                              updateDraftField(
                                'oneWayRatePerKm',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Min KM / Day
                          </label>
                          <input
                            type="number"
                            value={draft.minKmPerDay}
                            onChange={(e) =>
                              updateDraftField(
                                'minKmPerDay',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Driver Allowance (DA)
                          </label>
                          <input
                            type="number"
                            value={draft.driverAllowancePerDay}
                            onChange={(e) =>
                              updateDraftField(
                                'driverAllowancePerDay',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                            State Tax Default
                          </label>
                          <input
                            type="number"
                            value={draft.stateTaxDefault}
                            onChange={(e) =>
                              updateDraftField(
                                'stateTaxDefault',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Night Charge Default
                          </label>
                          <input
                            type="number"
                            value={draft.nightChargeDefault}
                            onChange={(e) =>
                              updateDraftField(
                                'nightChargeDefault',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Customer Quote & Commission Simulator */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-slate-700 dark:text-amber-400" />
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white font-display">
                    Live Outstation Fare & Driver Commission Calculator
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Cab Class
                      </label>
                      <select
                        value={simCategory}
                        onChange={(e) =>
                          setSimCategory(
                            e.target.value as TariffPlan['categoryId']
                          )
                        }
                        className="w-full px-2.5 py-2 font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      >
                        <option value="hatchback">Hatchback</option>
                        <option value="sedan">Sedan</option>
                        <option value="suv">SUV</option>
                        <option value="innova_crysta">Innova Crysta</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Trip Type
                      </label>
                      <select
                        value={simTripMode}
                        onChange={(e) =>
                          setSimTripMode(e.target.value as 'round' | 'oneway')
                        }
                        className="w-full px-2.5 py-2 font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      >
                        <option value="round">Round Trip</option>
                        <option value="oneway">One Way</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Est. KM
                      </label>
                      <input
                        type="number"
                        value={simDistanceKm}
                        onChange={(e) =>
                          setSimDistanceKm(Number(e.target.value))
                        }
                        className="w-full px-2.5 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={simDays}
                        onChange={(e) => setSimDays(Number(e.target.value))}
                        className="w-full px-2.5 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Platform Comm %
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={30}
                        value={simCommissionPct}
                        onChange={(e) =>
                          setSimCommissionPct(Number(e.target.value))
                        }
                        className="w-full px-2.5 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-5 p-4 rounded-xl bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-800 flex flex-col gap-3 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1 text-slate-700 dark:text-slate-300 font-bold">
                        <div>
                          Base ({simulatedQuote.billableKm} KM @ ₹
                          {simulatedQuote.rate}):{' '}
                          {formatINR(simulatedQuote.baseFare)}
                        </div>
                        <div>
                          Chauffeur Allowance + Toll:{' '}
                          {formatINR(simulatedQuote.da + simulatedQuote.tax)}
                        </div>
                        <div>
                          Safar Commission ({simCommissionPct}%):{' '}
                          <span className="text-amber-700 dark:text-amber-400 font-extrabold">
                            {formatINR(simulatedQuote.operatorCommission)}
                          </span>
                        </div>
                        <div>
                          Chauffeur Net Earning:{' '}
                          <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                            {formatINR(simulatedQuote.driverNetTakeHome)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-700 dark:text-amber-300 font-sans font-extrabold">
                          Customer Quote
                        </div>
                        <div className="text-xl font-extrabold text-slate-950 dark:text-white mt-0.5">
                          {formatINR(simulatedQuote.total)}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                          20% Adv: {formatINR(simulatedQuote.total * 0.2)}
                        </div>
                      </div>
                    </div>

                    {/* Instant WhatsApp Fare Proposal Dispatcher */}
                    <div className="pt-2.5 border-t border-slate-300 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 font-sans">
                      <input
                        type="text"
                        value={simQuoteRoute}
                        onChange={(e) => setSimQuoteRoute(e.target.value)}
                        placeholder="Route (e.g. Delhi → Jaipur)"
                        className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="tel"
                        value={simQuotePhone}
                        onChange={(e) => setSimQuotePhone(e.target.value)}
                        placeholder="Customer WhatsApp (+91...)"
                        className="px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                      <a
                        href={`https://wa.me/${simQuotePhone.replace(/\D/g, '') || '917710080992'}?text=${encodeURIComponent(
                          `*SAFAR INDIA CABS - OFFICIAL FARE PROPOSAL*\n*GSTIN:* ${OFFICIAL_GSTIN}\n--------------------------------\n*Route:* ${simQuoteRoute}\n*Cab Class:* ${simulatedQuote.plan.vehicleCategory} (${simulatedQuote.plan.sampleModels})\n*Trip Type:* ${simTripMode === 'round' ? 'Round-Trip Outstation' : 'One-Way Outstation'}\n*Billable Distance:* ${simulatedQuote.billableKm} KM (${simDays} Day(s))\n--------------------------------\n*All-Inclusive GST Fare:* ${formatINR(simulatedQuote.total)}\n*20% Advance to Confirm:* ${formatINR(Math.round(simulatedQuote.total * 0.2))}\n--------------------------------\nBook instantly with Aman Mishra (+91 7710080992) · SafarIndiaCabs`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send WhatsApp Quote</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: DRIVER & FLEET OPERATIONS */}
          {activeModule === 'driver-fleet' && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
                    Driver & Fleet Operations (KYC, Active Duty & Payout Ledger)
                  </h1>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                    Verify commercial DL, RC & Insurance documents, monitor live chauffeur availability, and settle pending commission payouts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(true)}
                  className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard Chauffeur & Vehicle</span>
                </button>
              </div>

              {/* Driver Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    placeholder="Search by Driver ID (DRV101), Chauffeur Name, Mobile, Vehicle Plate, or Hub City..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
                  {(['All', 'Available', 'On Trip', 'Off Duty'] as const).map(
                    (duty) => (
                      <button
                        key={duty}
                        type="button"
                        onClick={() => setDriverDutyFilter(duty)}
                        className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          driverDutyFilter === duty
                            ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {duty}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Fleet Drivers Table */}
              {filteredDrivers.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                  <Car className="w-9 h-9 text-slate-400 mx-auto" />
                  <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    No sample drivers — Chauffeur & Fleet Directory is ready for your real vehicles
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    All sample/demo drivers have been cleared. Click below to onboard your verified SafarIndiaCabs chauffeurs and commercial vehicles.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddDriverModal(true)}
                      className="px-4 py-2.5 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>+ Onboard Chauffeur & Vehicle</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-200/90 via-slate-100 to-slate-200/90 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-b-2 border-slate-300 dark:border-slate-800">
                          <th className="py-3.5 px-4 text-left font-extrabold">
                            Chauffeur ID & Profile
                          </th>
                          <th className="py-3.5 px-4 text-left font-extrabold">
                            Assigned Vehicle & Base Hub
                          </th>
                          <th className="py-3.5 px-4 text-left font-extrabold">
                            Document & KYC Verification
                          </th>
                          <th className="py-3.5 px-4 text-left font-extrabold">
                            Duty Status & Performance
                          </th>
                          <th className="py-3.5 px-4 text-right font-extrabold">
                            Earnings & Commission
                          </th>
                          <th className="py-3.5 px-4 text-right font-extrabold">
                            Pending Payout
                          </th>
                          <th className="py-3.5 px-4 text-right font-extrabold">
                            Fleet Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredDrivers.map((drv) => (
                          <tr
                            key={drv.driverId}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-3.5 px-4 align-top">
                              <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                                {drv.driverId}
                              </div>
                              <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                                {drv.driverName}
                              </div>
                              <div className="font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                {drv.driverPhone}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-mono font-extrabold text-slate-900 dark:text-amber-300">
                                {drv.vehicleNumber}
                              </div>
                              <div className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                                {drv.vehicleCategory} · {drv.vehicleModel}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                Hub: {drv.homeBaseCity}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div
                                className={`font-extrabold ${
                                  drv.kycStatus === 'Verified'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                KYC: {drv.kycStatus}
                              </div>
                              <div className="font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                DL: {drv.dlNumber}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                RC: {drv.rcVerified ? 'Verified' : 'Pending'} ·
                                Ins: {drv.insuranceVerified ? 'Active' : 'Review'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div
                                className={`font-extrabold ${
                                  drv.dutyStatus === 'Available'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : drv.dutyStatus === 'On Trip'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {drv.dutyStatus}
                              </div>
                              <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                                {drv.rating.toFixed(1)} ★ · {drv.completedTrips}{' '}
                                Trips
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCycleDriverDuty(drv)}
                                className="font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline mt-1 cursor-pointer"
                              >
                                Switch Duty Status
                              </button>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                Gross: {formatINR(drv.totalEarnings)}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                Safar Comm: {formatINR(drv.commissionDeducted)}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div
                                className={`font-extrabold text-sm ${
                                  drv.pendingPayout > 0
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {formatINR(drv.pendingPayout)}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                {drv.pendingPayout > 0 ? 'Unsettled' : 'Settled'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {drv.kycStatus !== 'Verified' && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveDriverKyc(drv)}
                                    className="px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Approve KYC</span>
                                  </button>
                                )}

                                {drv.pendingPayout > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSettleDriverPayout(drv)}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>Settle Payout</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteDriver(drv.driverId)
                                  }
                                  className="font-bold text-red-600 hover:text-red-700 dark:text-red-400 inline-flex items-center gap-1 text-xs cursor-pointer pt-0.5"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 6: GATEWAYS & APIS TAB */}
          {activeModule === 'gateways-apis' && (
            <GatewaysAndApisModule onShowToast={showToast} />
          )}

          {/* TAB 7: SECURITY & APP FILES (AAB / APK) TAB */}
          {activeModule === 'security-apk' && (
            <SecurityAndApkModule
              onShowToast={showToast}
              onTriggerPinLockNow={() => setPinLocked(true)}
            />
          )}

          {/* TAB 8: GST BILLING & CORPORATE ACCOUNTING LOGS */}
          {activeModule === 'billing-logs' && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
                    GST Billing, Corporate Accounting & Invoice Register ({OFFICIAL_GSTIN})
                  </h1>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                    Audit customer trip history, 20% Advance vs Full Paid settlement status, and download duplicate SAC 996412 GST invoices
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBookingsCsv}
                  className="px-4 py-2 text-xs font-extrabold text-white dark:text-slate-950 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Corporate Accounting CSV</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={billingCustomerSearch}
                    onChange={(e) => setBillingCustomerSearch(e.target.value)}
                    placeholder="Filter by Customer Name, Phone Number, Booking ID, Customer GSTIN, or Invoice Number..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {(['All', '20% Advance', 'Full Paid'] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setBillingPaymentFilter(mode)}
                        className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          billingPaymentFilter === mode
                            ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {mode}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Billing Ledger Table */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-200/90 via-slate-100 to-slate-200/90 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-b-2 border-slate-300 dark:border-slate-800">
                        <th className="py-3.5 px-4 text-left font-extrabold">
                          Invoice & Booking ID
                        </th>
                        <th className="py-3.5 px-4 text-left font-extrabold">
                          Customer & GSTIN
                        </th>
                        <th className="py-3.5 px-4 text-left font-extrabold">
                          Trip Route & Chauffeur
                        </th>
                        <th className="py-3.5 px-4 text-right font-extrabold">
                          Taxable + 5% GST
                        </th>
                        <th className="py-3.5 px-4 text-right font-extrabold">
                          Total Fare Paid
                        </th>
                        <th className="py-3.5 px-4 text-left font-extrabold">
                          Advance Payment Status
                        </th>
                        <th className="py-3.5 px-4 text-right font-extrabold">
                          Certified GST Invoice
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredBillingLogs.map((b) => {
                        const invoiceRef =
                          b.invoiceNumber ||
                          `INV-SIC-2026-${b.bookingId.replace('SIC', '')}`;
                        const taxable = Math.max(
                          0,
                          b.baseFare +
                            b.driverAllowance +
                            b.stateTax +
                            b.nightCharges -
                            b.marketDiscount
                        );
                        return (
                          <tr
                            key={b.bookingId}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-3.5 px-4 align-top font-mono">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {b.bookingId}
                              </div>
                              <div className="font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                {invoiceRef}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.pickupDate}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {b.customerName}
                              </div>
                              <div className="font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                                {b.customerPhone}
                              </div>
                              <div className="font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                GSTIN: {b.customerGstin || 'B2C Consumer'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {b.pickupCity} → {b.dropCity}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.vehicleCategory} · {b.distanceKm} KM (
                                {b.tripDays}d)
                              </div>
                              <div className="font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                                {b.driverName
                                  ? `${b.driverName} (${b.vehicleNumber})`
                                  : 'Driver Pending'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="font-bold text-slate-900 dark:text-white">
                                Taxable: {formatINR(taxable)}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                5% GST: +{formatINR(b.gstAmount)}
                              </div>
                              {b.marketDiscount > 0 && (
                                <div className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                  Disc: -{formatINR(b.marketDiscount)}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                {formatINR(b.totalFare)}
                              </div>
                              <div className="font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.status}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {b.paymentMode}
                              </div>
                              <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                Paid: {formatINR(b.advancePaid)}
                              </div>
                              <div className="font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                Balance: {formatINR(b.balanceAmount)}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setInvoiceTarget(b)}
                                  className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Certified GST Invoice</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBillGeneratorBookingTarget(b);
                                    setActiveModule('bill-generator');
                                  }}
                                  className="text-amber-700 dark:text-amber-400 hover:underline font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Stamp className="w-3 h-3" />
                                  <span>Open in Invoice Studio</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Official Footer with Correct GSTIN 07DQHPA3025F1ZD */}
          <footer className="pt-6 pb-4 border-t-2 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="SafarIndiaCabs Logo"
                className="w-7 h-7 object-contain rounded bg-white border border-slate-300 p-0.5 shrink-0"
              />
              <span>
                Safar India Cabs · A1 Cab Services • N. India (admin.safarindiacabs.com)
              </span>
            </div>
            <div className="font-mono font-extrabold text-slate-900 dark:text-amber-400 text-center sm:text-right">
              Proprietor: Aman Mishra · GSTIN: {OFFICIAL_GSTIN} · SAC: 996412 · Helpline: +91 7710080992 · H NO 143 STREET 4 JHARODA MAJRA NORTH DELHI BURARI 110084
            </div>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar — Light + Silver Surface */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-amber-500 grid grid-cols-5 py-2 px-1 text-xs shadow-lg">
        <button
          type="button"
          onClick={() => setActiveModule('control-room')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'control-room'
              ? 'text-amber-600 dark:text-amber-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-300 font-bold'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-[10px] whitespace-nowrap">Dispatch</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('bill-generator')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'bill-generator'
              ? 'text-amber-600 dark:text-amber-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-300 font-bold'
          }`}
        >
          <Stamp className="w-4 h-4" />
          <span className="text-[10px] whitespace-nowrap">Tax Invoice</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('customers')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'customers'
              ? 'text-amber-600 dark:text-amber-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-300 font-bold'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] whitespace-nowrap">Customers</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('gateways-apis')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'gateways-apis'
              ? 'text-amber-600 dark:text-amber-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-300 font-bold'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span className="text-[10px] whitespace-nowrap">Gateways</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('security-apk')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'security-apk'
              ? 'text-amber-600 dark:text-amber-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-300 font-bold'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="text-[10px] whitespace-nowrap">AAB/APK</span>
        </button>
      </nav>

      {/* Modals & Drawers */}
      {assignDriverTarget && (
        <AssignDriverModal
          booking={assignDriverTarget}
          fleetDrivers={drivers}
          onClose={() => setAssignDriverTarget(null)}
          onSave={handleAssignDriver}
        />
      )}

      {invoiceTarget && (
        <GstInvoiceModal
          booking={invoiceTarget}
          onClose={() => setInvoiceTarget(null)}
        />
      )}

      {whatsAppTarget && (
        <WhatsAppDispatchModal
          booking={whatsAppTarget}
          onClose={() => setWhatsAppTarget(null)}
          onOpenAssignDriver={(b) => setAssignDriverTarget(b)}
        />
      )}

      {myRidesPreviewTarget && (
        <CustomerMyRidesDrawer
          booking={myRidesPreviewTarget}
          onClose={() => setMyRidesPreviewTarget(null)}
          onOpenAssignDriver={(b) => {
            setAssignDriverTarget(b);
          }}
          onMarkCompleted={async (b) => {
            await handleStatusChange(b, 'Completed');
          }}
          onOpenInvoice={(b) => {
            setInvoiceTarget(b);
          }}
        />
      )}

      {showNewBookingModal && (
        <NewBookingModal
          tariffs={tariffs}
          fleetDrivers={drivers}
          existingBookingIds={bookings.map((b) => b.bookingId)}
          onClose={() => setShowNewBookingModal(false)}
          onCreateBooking={handleCreateBooking}
        />
      )}

      {showAddDriverModal && (
        <AddDriverModal
          existingDriverIds={drivers.map((d) => d.driverId)}
          onClose={() => setShowAddDriverModal(false)}
          onAddDriver={handleAddFleetDriver}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <FirestoreErrorBoundary>
      <AdminDashboard />
    </FirestoreErrorBoundary>
  );
}
