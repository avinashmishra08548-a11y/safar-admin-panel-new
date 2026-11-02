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
  INITIAL_SAMPLE_BOOKINGS,
  INITIAL_SAMPLE_DRIVERS,
  BLUEPRINT_CONSTRAINTS,
  sanitizeString,
  clampNumber,
  formatINR,
} from './types/safar';
import { LoginScreen } from './components/LoginScreen';
import { AssignDriverModal } from './components/AssignDriverModal';
import { GstInvoiceModal } from './components/GstInvoiceModal';
import { CustomerMyRidesDrawer } from './components/CustomerMyRidesDrawer';
import { NewBookingModal } from './components/NewBookingModal';
import { AddDriverModal } from './components/AddDriverModal';
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
} from 'lucide-react';

type ActiveModule =
  | 'control-room'
  | 'tariff-engine'
  | 'driver-fleet'
  | 'billing-logs';

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
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Operations Database Notice</span>
            </div>
            <pre className="p-3 bg-slate-100 dark:bg-slate-950 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
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

function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [directOperatorEmail, setDirectOperatorEmail] = useState<string | null>(
    () => localStorage.getItem('safar_direct_operator_email')
  );
  const [authReady, setAuthReady] = useState(false);
  const [activeModule, setActiveModule] =
    useState<ActiveModule>('control-room');

  // Dual-Theme (Light / Dark Mode) State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('safar_admin_theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('safar_admin_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Real-Time Operational State (Firestore + Local Fallback)
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tariffs, setTariffs] = useState<TariffPlan[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [seedingData, setSeedingData] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Control Room Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [pickupDateFilter, setPickupDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | BookingStatus>('All');

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
  const [myRidesPreviewTarget, setMyRidesPreviewTarget] =
    useState<Booking | null>(null);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  // Tariff Editor Draft State
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, TariffPlan>>(
    {}
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

  // Billing Logs Filter
  const [billingCustomerSearch, setBillingCustomerSearch] = useState('');
  const [billingPaymentFilter, setBillingPaymentFilter] = useState<
    'All' | '20% Advance' | 'Full Paid'
  >('All');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
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

  // Load initial data in Direct Operator Console mode (when accessed on custom domain prior to Firebase Console setup)
  useEffect(() => {
    if (!authReady) return;
    if (!isFirebaseVerifiedSession && directOperatorEmail) {
      const savedBookings = localStorage.getItem('safar_local_bookings');
      const savedTariffs = localStorage.getItem('safar_local_tariffs');
      const savedDrivers = localStorage.getItem('safar_local_drivers');

      const initialBookings: Booking[] = savedBookings
        ? JSON.parse(savedBookings)
        : INITIAL_SAMPLE_BOOKINGS.map((b) => ({
            ...b,
            createdBy: 'direct_admin',
          }));

      const initialTariffs: TariffPlan[] = savedTariffs
        ? JSON.parse(savedTariffs)
        : DEFAULT_TARIFF_PLANS.map((t) => ({
            ...t,
            createdBy: 'direct_admin',
          }));

      const initialDrivers: FleetDriver[] = savedDrivers
        ? JSON.parse(savedDrivers)
        : INITIAL_SAMPLE_DRIVERS.map((d) => ({
            ...d,
            createdBy: 'direct_admin',
          }));

      setBookings(initialBookings);
      setTariffs(initialTariffs);
      setDrivers(initialDrivers);

      const drafts: Record<string, TariffPlan> = {};
      initialTariffs.forEach((t) => {
        drafts[t.categoryId] = { ...t };
      });
      setTariffDrafts(drafts);
      setDataLoading(false);
    }
  }, [authReady, isFirebaseVerifiedSession, directOperatorEmail]);

  // Real-time Firestore listeners once authenticated and verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      if (!directOperatorEmail) setDataLoading(false);
      return;
    }

    setDataLoading(true);
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
          list.push(docSnap.data() as Booking);
        });
        list.sort((a, b) => b.bookingId.localeCompare(a.bookingId));
        setBookings(list);
        setDataLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    const unsubTariffs = onSnapshot(
      tariffsRef,
      (snapshot) => {
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

        const drafts: Record<string, TariffPlan> = {};
        list.forEach((t) => {
          drafts[t.categoryId] = { ...t };
        });
        setTariffDrafts(drafts);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tariffs');
      }
    );

    const unsubDrivers = onSnapshot(
      driversRef,
      (snapshot) => {
        const list: FleetDriver[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as FleetDriver);
        });
        list.sort((a, b) => a.driverId.localeCompare(b.driverId));
        setDrivers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'drivers');
      }
    );

    return () => {
      unsubBookings();
      unsubTariffs();
      unsubDrivers();
    };
  }, [authReady, user, directOperatorEmail]);

  // Seed default SafarIndiaCabs Outstation Tariffs, Drivers & Sample Bookings
  const handleSeedInitialOperationsData = async () => {
    setSeedingData(true);
    try {
      if (!isFirebaseVerifiedSession) {
        const seededBookings: Booking[] = INITIAL_SAMPLE_BOOKINGS.map((b) => ({
          ...b,
          createdBy: 'direct_admin',
        }));
        const seededTariffs: TariffPlan[] = DEFAULT_TARIFF_PLANS.map((t) => ({
          ...t,
          createdBy: 'direct_admin',
        }));
        const seededDrivers: FleetDriver[] = INITIAL_SAMPLE_DRIVERS.map((d) => ({
          ...d,
          createdBy: 'direct_admin',
        }));
        setBookings(seededBookings);
        setTariffs(seededTariffs);
        setDrivers(seededDrivers);
        localStorage.setItem(
          'safar_local_bookings',
          JSON.stringify(seededBookings)
        );
        localStorage.setItem(
          'safar_local_tariffs',
          JSON.stringify(seededTariffs)
        );
        localStorage.setItem(
          'safar_local_drivers',
          JSON.stringify(seededDrivers)
        );
        const drafts: Record<string, TariffPlan> = {};
        seededTariffs.forEach((t) => {
          drafts[t.categoryId] = { ...t };
        });
        setTariffDrafts(drafts);
        showToast(
          'Restored SafarIndiaCabs sample bookings (SIC2601–SIC2606), fleet drivers (DRV101–DRV106), and tariffs.'
        );
        return;
      }

      if (!user) return;

      for (const plan of DEFAULT_TARIFF_PLANS) {
        const docPath = `tariffs/${plan.categoryId}`;
        try {
          await setDoc(doc(db, 'tariffs', plan.categoryId), {
            categoryId: plan.categoryId,
            vehicleCategory: plan.vehicleCategory,
            sampleModels: sanitizeString(
              plan.sampleModels,
              BLUEPRINT_CONSTRAINTS.MAX_SAMPLE_MODELS
            ),
            seatingCapacity: clampNumber(plan.seatingCapacity, 2, 20),
            baseRatePerKm: clampNumber(plan.baseRatePerKm, 5, 500),
            oneWayRatePerKm: clampNumber(plan.oneWayRatePerKm, 5, 500),
            minKmPerDay: clampNumber(plan.minKmPerDay, 50, 1000),
            driverAllowancePerDay: clampNumber(
              plan.driverAllowancePerDay,
              0,
              10000
            ),
            nightChargeDefault: clampNumber(plan.nightChargeDefault, 0, 10000),
            stateTaxDefault: clampNumber(plan.stateTaxDefault, 0, 50000),
            gstPercentage: clampNumber(plan.gstPercentage, 0, 28),
            marketDiscountEnabled: Boolean(plan.marketDiscountEnabled),
            marketDiscountAmount: clampNumber(
              plan.marketDiscountAmount,
              0,
              10000
            ),
            createdBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, docPath);
        }
      }

      for (const drv of INITIAL_SAMPLE_DRIVERS) {
        const docPath = `drivers/${drv.driverId}`;
        try {
          await setDoc(doc(db, 'drivers', drv.driverId), {
            ...drv,
            createdBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, docPath);
        }
      }

      for (const item of INITIAL_SAMPLE_BOOKINGS) {
        const docPath = `bookings/${item.bookingId}`;
        try {
          await setDoc(doc(db, 'bookings', item.bookingId), {
            ...item,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, docPath);
        }
      }

      showToast(
        'Synced SafarIndiaCabs bookings, fleet chauffeurs, and outstation tariffs with Cloud Firestore.'
      );
    } finally {
      setSeedingData(false);
    }
  };

  // Auto-seed when verified admin first logs into empty Firestore
  useEffect(() => {
    if (
      authReady &&
      isFirebaseVerifiedSession &&
      !dataLoading &&
      bookings.length === 0 &&
      tariffs.length === 0 &&
      drivers.length === 0 &&
      !seedingData
    ) {
      handleSeedInitialOperationsData();
    }
  }, [
    authReady,
    isFirebaseVerifiedSession,
    dataLoading,
    bookings.length,
    tariffs.length,
    drivers.length,
  ]);

  // Create new booking handler
  const handleCreateBooking = async (
    newBooking: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!isFirebaseVerifiedSession) {
      const created: Booking = {
        ...newBooking,
        createdBy: 'direct_admin',
      };
      const updated = [created, ...bookings];
      setBookings(updated);
      localStorage.setItem('safar_local_bookings', JSON.stringify(updated));
      showToast(
        `Created booking ${newBooking.bookingId} for ${newBooking.customerName}.`
      );
      return;
    }

    if (!user) return;
    const path = `bookings/${newBooking.bookingId}`;
    try {
      await setDoc(doc(db, 'bookings', newBooking.bookingId), {
        ...newBooking,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(
        `Created booking ${newBooking.bookingId} for ${newBooking.customerName}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  // Assign driver details handler
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

    if (!isFirebaseVerifiedSession) {
      const updated = bookings.map((b) =>
        b.bookingId === bookingId
          ? {
              ...b,
              driverName: driverDetails.driverName,
              driverPhone: driverDetails.driverPhone,
              vehicleNumber: driverDetails.vehicleNumber,
              vehicleModel: driverDetails.vehicleModel,
              status: nextStatus,
            }
          : b
      );
      setBookings(updated);
      localStorage.setItem('safar_local_bookings', JSON.stringify(updated));
      showToast(
        `Assigned chauffeur ${driverDetails.driverName} (${driverDetails.vehicleNumber}) to ${bookingId}.`
      );
      return;
    }

    const path = `bookings/${bookingId}`;
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        driverName: sanitizeString(
          driverDetails.driverName,
          BLUEPRINT_CONSTRAINTS.MAX_DRIVER_NAME
        ),
        driverPhone: sanitizeString(
          driverDetails.driverPhone,
          BLUEPRINT_CONSTRAINTS.MAX_PHONE
        ),
        vehicleNumber: sanitizeString(
          driverDetails.vehicleNumber,
          BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_NUMBER
        ),
        vehicleModel: sanitizeString(
          driverDetails.vehicleModel,
          BLUEPRINT_CONSTRAINTS.MAX_VEHICLE_MODEL
        ),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(
        `Assigned chauffeur ${driverDetails.driverName} (${driverDetails.vehicleNumber}) to ${bookingId}.`
      );
      if (myRidesPreviewTarget?.bookingId === bookingId) {
        setMyRidesPreviewTarget({
          ...target,
          driverName: driverDetails.driverName,
          driverPhone: driverDetails.driverPhone,
          vehicleNumber: driverDetails.vehicleNumber,
          vehicleModel: driverDetails.vehicleModel,
          status: nextStatus,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // One-click status changer (Pending / Confirmed / Completed / Cancelled)
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

    if (!isFirebaseVerifiedSession) {
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
      showToast(
        isCompleting
          ? `Marked ${booking.bookingId} Completed. Final GST Invoice (${generatedInvoiceNo}) is now unlocked.`
          : `Updated ${booking.bookingId} status to ${nextStatus}.`
      );
      return;
    }

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
      if (isCompleting) {
        showToast(
          `Marked ${booking.bookingId} Completed. Final GST Invoice (${generatedInvoiceNo}) is now unlocked for ${booking.customerName}.`
        );
      } else {
        showToast(`Updated ${booking.bookingId} status to ${nextStatus}.`);
      }

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
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Save single vehicle category tariff
  const handleSaveTariff = async (categoryId: string) => {
    const draft = tariffDrafts[categoryId];
    if (!draft) return;

    setSavingTariffId(categoryId);
    try {
      if (!isFirebaseVerifiedSession) {
        const updated = tariffs.map((t) =>
          t.categoryId === categoryId ? { ...draft } : t
        );
        setTariffs(updated);
        localStorage.setItem('safar_local_tariffs', JSON.stringify(updated));
        showToast(
          `Published updated ${draft.vehicleCategory} outstation tariff to safarindiacabs.com.`
        );
        return;
      }

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
          nightChargeDefault: clampNumber(draft.nightChargeDefault, 0, 10000),
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
        showToast(
          `Published updated ${draft.vehicleCategory} outstation tariff to safarindiacabs.com.`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
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
      if (!isFirebaseVerifiedSession) {
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
        return;
      }

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
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
      showToast(
        enabled
          ? `Competitive Market Price Discount (${formatINR(clampedDiscount)}) enabled across all vehicle categories.`
          : 'Competitive Market Price Discount disabled across all vehicle categories.'
      );
    } finally {
      setGlobalDiscountToggleBusy(false);
    }
  };

  // Add New Fleet Chauffeur
  const handleAddFleetDriver = async (
    newDriver: Omit<FleetDriver, 'createdBy' | 'updatedAt'>
  ) => {
    if (!isFirebaseVerifiedSession) {
      const created: FleetDriver = {
        ...newDriver,
        createdBy: 'direct_admin',
      };
      const updated = [...drivers, created];
      setDrivers(updated);
      localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
      showToast(
        `Onboarded chauffeur ${newDriver.driverName} (${newDriver.vehicleNumber}).`
      );
      return;
    }

    if (!user) return;
    const path = `drivers/${newDriver.driverId}`;
    try {
      await setDoc(doc(db, 'drivers', newDriver.driverId), {
        ...newDriver,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      showToast(
        `Onboarded chauffeur ${newDriver.driverName} (${newDriver.vehicleNumber}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  // Verify Driver Documents / KYC
  const handleApproveDriverKyc = async (drv: FleetDriver) => {
    if (!isFirebaseVerifiedSession) {
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
      return;
    }

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
      showToast(`Verified commercial DL, RC & Insurance for ${drv.driverName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Toggle Driver Duty Status
  const handleCycleDriverDuty = async (drv: FleetDriver) => {
    const order: DriverDutyStatus[] = ['Available', 'On Trip', 'Off Duty'];
    const nextDuty =
      order[(order.indexOf(drv.dutyStatus) + 1) % order.length];

    if (!isFirebaseVerifiedSession) {
      const updated = drivers.map((d) =>
        d.driverId === drv.driverId ? { ...d, dutyStatus: nextDuty } : d
      );
      setDrivers(updated);
      localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
      showToast(`${drv.driverName} duty status updated to ${nextDuty}.`);
      return;
    }

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
      showToast(`${drv.driverName} duty status updated to ${nextDuty}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Settle Driver Pending Payout
  const handleSettleDriverPayout = async (drv: FleetDriver) => {
    if (drv.pendingPayout <= 0) return;
    const settledAmount = drv.pendingPayout;

    if (!isFirebaseVerifiedSession) {
      const updated = drivers.map((d) =>
        d.driverId === drv.driverId ? { ...d, pendingPayout: 0 } : d
      );
      setDrivers(updated);
      localStorage.setItem('safar_local_drivers', JSON.stringify(updated));
      showToast(
        `Settled payout of ${formatINR(settledAmount)} to ${drv.driverName} via IMPS/UPI.`
      );
      return;
    }

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
      showToast(
        `Settled payout of ${formatINR(settledAmount)} to ${drv.driverName} via IMPS/UPI.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
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
      `safarindiacabs_bookings_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${bookings.length} booking records to Excel/CSV.`);
  };

  // Filtered bookings for Control Room
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
      const matchesStatus =
        statusFilter === 'All' || b.status === statusFilter;
      return matchesQuery && matchesDate && matchesStatus;
    });
  }, [bookings, searchQuery, pickupDateFilter, statusFilter]);

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

  // Operational KPI Metrics
  const kpiStats = useMemo(() => {
    const totalCount = bookings.length;
    const pendingDispatchCount = bookings.filter(
      (b) => b.status === 'Pending' || !b.driverName
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
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
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
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
            Verify Administrator Email
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Verify <span className="font-mono text-slate-900 dark:text-slate-100">{user.email}</span> or continue directly into the Operations Console.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                const emailAddr = user.email || 'avinashmishra08548@gmail.com';
                localStorage.setItem('safar_direct_operator_email', emailAddr);
                setDirectOperatorEmail(emailAddr);
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer"
            >
              Continue Directly to Operations Control Room
            </button>
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(user);
                showToast('Verification email sent.');
              }}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Resend Verification Link
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full py-2 px-4 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
            >
              Sign Out
            </button>
          </div>
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-16 lg:pb-0">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#control-room"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('control-room');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          SafarIndiaCabs
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveModule('control-room')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'control-room'
                ? 'text-slate-900 dark:text-slate-100 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            Dispatch Control
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('tariff-engine')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'tariff-engine'
                ? 'text-slate-900 dark:text-slate-100 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            Tariff & Commission
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('driver-fleet')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'driver-fleet'
                ? 'text-slate-900 dark:text-slate-100 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            Driver & Fleet Ops
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('billing-logs')}
            className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'billing-logs'
                ? 'text-slate-900 dark:text-slate-100 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            GST Billing Logs
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewBookingModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Booking</span>
          </button>
        </div>
      </header>

      {/* Workspace Canvas: Sidebar + Main Content Viewport */}
      <div className="flex-1 flex">
        {/* Left Sidebar Navigation (264px width) */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col justify-between p-4 shrink-0">
          <div className="space-y-6">
            <div className="px-2 pt-1 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  admin.safarindiacabs.com
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customer & Fleet Command
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                title="Toggle Dark / Light Mode"
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                {darkMode ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveModule('control-room')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'control-room'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Centralized Dispatch</span>
                </span>
                <span className="font-mono tabular-nums">{bookings.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('tariff-engine')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'tariff-engine'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Sliders className="w-4 h-4" />
                  <span>Tariff & Commission</span>
                </span>
                <span className="font-mono tabular-nums">{tariffs.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('driver-fleet')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'driver-fleet'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Users className="w-4 h-4" />
                  <span>Driver & Fleet Ops</span>
                </span>
                <span className="font-mono tabular-nums">{drivers.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('billing-logs')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'billing-logs'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Receipt className="w-4 h-4" />
                  <span>GST Billing & Logs</span>
                </span>
                <span className="font-mono tabular-nums">
                  {kpiStats.completedCount}
                </span>
              </button>
            </div>

            {/* Active Market Discount Summary Box */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Market Discount Engine
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {firstTariff.marketDiscountEnabled ? (
                  <span>
                    Active:{' '}
                    <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                      -{formatINR(firstTariff.marketDiscountAmount)}
                    </strong>{' '}
                    off on safarindiacabs.com quotes
                  </span>
                ) : (
                  <span>Disabled across outstation quotes</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('tariff-engine')}
                className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Configure Rates & Commission →
              </button>
            </div>
          </div>

          {/* Operator Profile & Sign Out */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="px-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.displayName || 'Super Admin Operator'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                {activeOperatorEmail}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBookingsCsv}
                className="flex-1 py-2 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleSignOutAll}
                title="Sign Out"
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* Mobile Quick Utility Strip */}
          <div className="flex lg:hidden items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-mono text-slate-500 dark:text-slate-400 truncate">
              {activeOperatorEmail}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 inline-flex items-center gap-1"
              >
                {darkMode ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
                <span>{darkMode ? 'Light' : 'Dark'}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOutAll}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Toast feedback banner */}
          {toastMessage && (
            <div className="p-3.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-lg flex items-center justify-between text-xs shadow-md font-medium">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 dark:text-slate-950 shrink-0" />
                <span>{toastMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="opacity-80 hover:opacity-100 ml-4 cursor-pointer underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 4-Column Operational KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Live Dispatch Queue · safarindiacabs.com
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {kpiStats.totalCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {kpiStats.pendingDispatchCount} awaiting driver ·{' '}
                {kpiStats.completedCount} completed
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Gross Booking Volume (Incl. 5% GST)
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatINR(kpiStats.grossBookingValue)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Advance Paid: {formatINR(kpiStats.totalAdvanceCollected)} · Due:{' '}
                {formatINR(kpiStats.pendingDriverCollection)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Active Fleet Chauffeurs & Payouts
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                {kpiStats.availableDriversCount} / {drivers.length} Available
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Unsettled Driver Payouts:{' '}
                <span className="font-mono">
                  {formatINR(kpiStats.totalPendingDriverPayout)}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Outstation Tariff & Market Discount
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {firstTariff.marketDiscountEnabled
                  ? `-${formatINR(firstTariff.marketDiscountAmount)}`
                  : 'OFF'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Sedan @ ₹
                {tariffs.find((t) => t.categoryId === 'sedan')?.baseRatePerKm ||
                  13}
                /KM · Crysta @ ₹
                {tariffs.find((t) => t.categoryId === 'innova_crysta')
                  ?.baseRatePerKm || 21}
                /KM
              </div>
            </div>
          </section>

          {/* MODULE 1: CENTRALIZED DISPATCH & BOOKING MANAGEMENT */}
          {activeModule === 'control-room' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                    Centralized Dispatch & Customer Booking Control Room
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assign verified fleet chauffeurs to customer &apos;My Rides&apos; and mark trips Completed to unlock final SAC 996412 GST invoices
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSeedInitialOperationsData}
                    disabled={seedingData}
                    className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${seedingData ? 'animate-spin' : ''}`}
                    />
                    <span>{seedingData ? 'Syncing...' : 'Reset Sample Data'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportBookingsCsv}
                    className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel / CSV</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Booking ID (SIC2601), Customer Phone, Name, City, or Vehicle Plate..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="pickup-date-filter"
                      className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      Pickup Date:
                    </label>
                    <input
                      id="pickup-date-filter"
                      type="date"
                      value={pickupDateFilter}
                      onChange={(e) => setPickupDateFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    {pickupDateFilter && (
                      <button
                        type="button"
                        onClick={() => setPickupDateFilter('')}
                        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Interactive Segmented Status Filter Controls */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
                  {(
                    [
                      'All',
                      'Pending',
                      'Confirmed',
                      'Completed',
                      'Cancelled',
                    ] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === st
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookings Data Grid */}
              {dataLoading ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
                  <Database className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    No customer bookings match your current filter
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Clear your search filters or load the default SafarIndiaCabs outstation bookings (SIC2601–SIC2606).
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPickupDateFilter('');
                        setStatusFilter('All');
                      }}
                      className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Reset Filters
                    </button>
                    <button
                      type="button"
                      onClick={handleSeedInitialOperationsData}
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer"
                    >
                      Load Sample Bookings
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                          <th className="py-3 px-4 text-left font-semibold">
                            Booking ID & Pickup
                          </th>
                          <th className="py-3 px-4 text-left font-semibold">
                            Customer Details
                          </th>
                          <th className="py-3 px-4 text-left font-semibold">
                            Route & Cab Class
                          </th>
                          <th className="py-3 px-4 text-left font-semibold">
                            Assigned Chauffeur (My Rides)
                          </th>
                          <th className="py-3 px-4 text-right font-semibold">
                            Fare & Advance Status
                          </th>
                          <th className="py-3 px-4 text-left font-semibold">
                            Trip Status
                          </th>
                          <th className="py-3 px-4 text-right font-semibold">
                            Dispatch Actions
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
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3.5 px-4 align-top">
                                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {booking.bookingId}
                                </div>
                                <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                  {booking.pickupDate} · {booking.pickupTime}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMyRidesPreviewTarget(booking)
                                  }
                                  className="mt-1.5 text-amber-700 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  <span>Customer My Rides View</span>
                                </button>
                              </td>

                              <td className="py-3.5 px-4 align-top">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {booking.customerName}
                                </div>
                                <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                  {booking.customerPhone}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                  {booking.customerEmail}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 align-top">
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {booking.pickupCity} → {booking.dropCity}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  {booking.vehicleCategory} · {booking.tripType}
                                </div>
                                <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                  {booking.distanceKm} KM · {booking.tripDays}d @ ₹
                                  {booking.perKmRate}/KM
                                </div>
                              </td>

                              <td className="py-3.5 px-4 align-top">
                                {hasDriver ? (
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                                      {booking.driverName}
                                    </div>
                                    <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                      {booking.driverPhone}
                                    </div>
                                    <div className="font-mono text-slate-700 dark:text-amber-300 font-medium mt-0.5">
                                      {booking.vehicleNumber} ·{' '}
                                      {booking.vehicleModel}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAssignDriverTarget(booking)
                                      }
                                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline mt-1 cursor-pointer"
                                    >
                                      Reassign Chauffeur
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="text-amber-700 dark:text-amber-400 font-medium">
                                      Unassigned · Awaiting Chauffeur
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAssignDriverTarget(booking)
                                      }
                                      className="px-2.5 py-1.5 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 rounded-md font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      <span>Assign Driver</span>
                                    </button>
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {formatINR(booking.totalFare)}
                                </div>
                                <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                                  {booking.paymentMode} · Paid{' '}
                                  {formatINR(booking.advancePaid)}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Due: {formatINR(booking.balanceAmount)}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 align-top">
                                <div
                                  className={`font-semibold ${
                                    booking.status === 'Completed'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : booking.status === 'Confirmed'
                                      ? 'text-slate-900 dark:text-slate-100'
                                      : booking.status === 'Cancelled'
                                      ? 'text-red-700 dark:text-red-400'
                                      : 'text-amber-700 dark:text-amber-400'
                                  }`}
                                >
                                  {booking.status}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  {booking.invoiceReady
                                    ? `GST Inv Ready (${booking.invoiceNumber})`
                                    : 'GST Inv Locked'}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 align-top text-right">
                                <div className="flex flex-col items-end gap-1.5">
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
                                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Mark Completed & Unlock GST</span>
                                      </button>
                                    )}

                                  {booking.status === 'Completed' && (
                                    <button
                                      type="button"
                                      onClick={() => setInvoiceTarget(booking)}
                                      className="px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-md font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>GST Tax Invoice</span>
                                    </button>
                                  )}

                                  {booking.status === 'Pending' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStatusChange(booking, 'Cancelled')
                                      }
                                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 inline-flex items-center gap-1 text-xs cursor-pointer"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>Cancel Booking</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* MODULE 2: OUTSTATION TARIFF & COMMISSION ENGINE */}
          {activeModule === 'tariff-engine' && (
            <section className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                  Outstation Tariff, Toll Tax & Commission Engine
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure per-KM outstation rates, state permit taxes, driver allowance (DA), night charges, platform commission %, and the ₹200 market discount
                </p>
              </div>

              {/* Competitive Market Discount Master Control Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 max-w-xl">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">
                    Competitive Market Price Discount Logic (safarindiacabs.com)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    When enabled, customers booking outstation cabs on safarindiacabs.com automatically receive an instant flat promotional discount (default ₹200) deducted from their pre-GST fare.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="global-discount-amount"
                      className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
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
                      className="w-24 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
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
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
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
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
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
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
                            {plan.vehicleCategory}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {draft.sampleModels} · {draft.seatingCapacity} Seats +
                            Chauffeur
                          </p>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-bold text-slate-900 dark:text-amber-400">
                            ₹{draft.baseRatePerKm}/KM
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            One-Way: ₹{draft.oneWayRatePerKm}/KM
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                        <div className="space-y-1">
                          <label className="block text-slate-600 dark:text-slate-400 font-medium">
                            Round-Trip Rate (₹/KM)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            value={draft.baseRatePerKm}
                            onChange={(e) =>
                              updateDraftField(
                                'baseRatePerKm',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 dark:text-slate-400 font-medium">
                            One-Way Rate (₹/KM)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            value={draft.oneWayRatePerKm}
                            onChange={(e) =>
                              updateDraftField(
                                'oneWayRatePerKm',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 dark:text-slate-400 font-medium">
                            Min KM / Day
                          </label>
                          <input
                            type="number"
                            min={50}
                            max={1000}
                            value={draft.minKmPerDay}
                            onChange={(e) =>
                              updateDraftField(
                                'minKmPerDay',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 dark:text-slate-400 font-medium">
                            Driver Allowance (DA/Day)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            value={draft.driverAllowancePerDay}
                            onChange={(e) =>
                              updateDraftField(
                                'driverAllowancePerDay',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 dark:text-slate-400 font-medium">
                            State Permit Tax (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50000}
                            value={draft.stateTaxDefault}
                            onChange={(e) =>
                              updateDraftField(
                                'stateTaxDefault',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 dark:text-slate-400 font-medium">
                            Night Charges (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            value={draft.nightChargeDefault}
                            onChange={(e) =>
                              updateDraftField(
                                'nightChargeDefault',
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.marketDiscountEnabled}
                            onChange={(e) =>
                              updateDraftField(
                                'marketDiscountEnabled',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300"
                          />
                          <span>
                            Enable ₹{draft.marketDiscountAmount} Market Discount
                            for {plan.vehicleCategory}
                          </span>
                        </label>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveTariff(plan.categoryId)}
                          className="px-4 py-2 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 disabled:opacity-50 text-white dark:text-slate-950 font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>
                            {isSaving
                              ? 'Publishing...'
                              : `Save ${plan.vehicleCategory} Tariff`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Outstation Fare & Commission Calculator */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-900 dark:text-amber-400" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">
                      Dynamic Outstation Fare & Driver Commission Simulator
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    SAC 996412 · 5% GST
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      Vehicle Category
                    </label>
                    <select
                      value={simCategory}
                      onChange={(e) =>
                        setSimCategory(
                          e.target.value as TariffPlan['categoryId']
                        )
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      <option value="hatchback">Hatchback</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="innova_crysta">Innova Crysta</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      Trip Mode
                    </label>
                    <select
                      value={simTripMode}
                      onChange={(e) =>
                        setSimTripMode(e.target.value as 'round' | 'oneway')
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      <option value="round">Round Trip Outstation</option>
                      <option value="oneway">One-Way Drop</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      Distance (KM)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={10000}
                      value={simDistanceKm}
                      onChange={(e) => setSimDistanceKm(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      Duration (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={simDays}
                      onChange={(e) => setSimDays(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      Safar Commission (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={simCommissionPct}
                      onChange={(e) =>
                        setSimCommissionPct(Number(e.target.value))
                      }
                      className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs font-mono">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 font-sans">
                      Base ({simulatedQuote.billableKm} KM @ ₹
                      {simulatedQuote.rate})
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatINR(simulatedQuote.baseFare)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 font-sans">
                      DA + State Tax
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatINR(simulatedQuote.da + simulatedQuote.tax)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 font-sans">
                      Market Discount & GST
                    </div>
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      -{formatINR(simulatedQuote.discount)} / +
                      {formatINR(simulatedQuote.gst)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 font-sans">
                      Customer Total
                    </div>
                    <div className="font-bold text-slate-900 dark:text-amber-400 text-sm mt-0.5">
                      {formatINR(simulatedQuote.total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 font-sans">
                      Safar Commission ({simCommissionPct}%)
                    </div>
                    <div className="font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                      {formatINR(simulatedQuote.operatorCommission)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 font-sans">
                      Net Driver Payout
                    </div>
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {formatINR(simulatedQuote.driverNetTakeHome)}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* MODULE 3: DRIVER & FLEET OPERATIONS */}
          {activeModule === 'driver-fleet' && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                    Driver & Fleet Operations · KYC, Active Duty & Payouts
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Verify commercial DL, RC & Insurance compliance, track live duty availability, and settle driver commission payouts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Onboard Fleet Chauffeur</span>
                </button>
              </div>

              {/* Fleet Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    placeholder="Search by Driver ID (DRV101), Chauffeur Name, Mobile, Vehicle Plate, or Hub City..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(['All', 'Available', 'On Trip', 'Off Duty'] as const).map(
                    (duty) => (
                      <button
                        key={duty}
                        type="button"
                        onClick={() => setDriverDutyFilter(duty)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          driverDutyFilter === duty
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {duty}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Fleet Chauffeurs Data Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <th className="py-3 px-4 text-left font-semibold">
                          Driver ID & Name
                        </th>
                        <th className="py-3 px-4 text-left font-semibold">
                          Vehicle & Hub City
                        </th>
                        <th className="py-3 px-4 text-left font-semibold">
                          Commercial KYC & Permits
                        </th>
                        <th className="py-3 px-4 text-left font-semibold">
                          Duty Status & Rating
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Earnings & Commission
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Pending Payout
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
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
                            <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {drv.driverId}
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                              {drv.driverName}
                            </div>
                            <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              {drv.driverPhone}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <div className="font-mono font-semibold text-slate-900 dark:text-amber-300">
                              {drv.vehicleNumber}
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                              {drv.vehicleCategory} · {drv.vehicleModel}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              Hub: {drv.homeBaseCity}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <div
                              className={`font-semibold ${
                                drv.kycStatus === 'Verified'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              KYC: {drv.kycStatus}
                            </div>
                            <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              DL: {drv.dlNumber}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              RC: {drv.rcVerified ? 'Verified' : 'Pending'} ·
                              Ins: {drv.insuranceVerified ? 'Active' : 'Review'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <div
                              className={`font-semibold ${
                                drv.dutyStatus === 'Available'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : drv.dutyStatus === 'On Trip'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {drv.dutyStatus}
                            </div>
                            <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                              {drv.rating.toFixed(1)} ★ · {drv.completedTrips}{' '}
                              Trips
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCycleDriverDuty(drv)}
                              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline mt-1 cursor-pointer"
                            >
                              Switch Duty Status
                            </button>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              Gross: {formatINR(drv.totalEarnings)}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              Safar Comm: {formatINR(drv.commissionDeducted)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                            <div
                              className={`font-bold text-sm ${
                                drv.pendingPayout > 0
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {formatINR(drv.pendingPayout)}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              {drv.pendingPayout > 0 ? 'Unsettled' : 'Settled'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              {drv.kycStatus !== 'Verified' && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveDriverKyc(drv)}
                                  className="px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white rounded-md font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Approve KYC</span>
                                </button>
                              )}

                              {drv.pendingPayout > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleSettleDriverPayout(drv)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  <span>Settle Payout</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* MODULE 4: CUSTOMER & BILLING LOGS */}
          {activeModule === 'billing-logs' && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">
                    GST Billing, Corporate Accounting & Invoice Register
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Audit customer trip history, 20% Advance vs Full Paid settlement status, and download duplicate SAC 996412 GST invoices
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBookingsCsv}
                  className="px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Corporate Accounting CSV</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={billingCustomerSearch}
                    onChange={(e) => setBillingCustomerSearch(e.target.value)}
                    placeholder="Filter by Customer Name, Phone Number, Booking ID, Customer GSTIN, or Invoice Number..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(['All', '20% Advance', 'Full Paid'] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setBillingPaymentFilter(mode)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          billingPaymentFilter === mode
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {mode}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Billing Ledger Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <th className="py-3 px-4 text-left font-semibold">
                          Invoice & Booking ID
                        </th>
                        <th className="py-3 px-4 text-left font-semibold">
                          Customer & GSTIN
                        </th>
                        <th className="py-3 px-4 text-left font-semibold">
                          Trip Route & Chauffeur
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Taxable + 5% GST
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Total Fare Paid
                        </th>
                        <th className="py-3 px-4 text-left font-semibold">
                          Advance Payment Status
                        </th>
                        <th className="py-3 px-4 text-right font-semibold">
                          Duplicate GST Invoice
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
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {b.bookingId}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                {invoiceRef}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.pickupDate}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {b.customerName}
                              </div>
                              <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                {b.customerPhone}
                              </div>
                              <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                GSTIN: {b.customerGstin || 'B2C Consumer'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {b.pickupCity} → {b.dropCity}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.vehicleCategory} · {b.distanceKm} KM (
                                {b.tripDays}d)
                              </div>
                              <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                {b.driverName
                                  ? `${b.driverName} (${b.vehicleNumber})`
                                  : 'Driver Pending'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="text-slate-900 dark:text-slate-100">
                                Taxable: {formatINR(taxable)}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                5% GST: +{formatINR(b.gstAmount)}
                              </div>
                              {b.marketDiscount > 0 && (
                                <div className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                                  Disc: -{formatINR(b.marketDiscount)}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                {formatINR(b.totalFare)}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.status}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {b.paymentMode}
                              </div>
                              <div className="font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                                Paid: {formatINR(b.advancePaid)}
                              </div>
                              <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                Balance: {formatINR(b.balanceAmount)}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right">
                              <button
                                type="button"
                                onClick={() => setInvoiceTarget(b)}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Duplicate GST Invoice</span>
                              </button>
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
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (<= 10% viewport height) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 py-2 px-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveModule('control-room')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'control-room'
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-[11px] whitespace-nowrap">Dispatch</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('tariff-engine')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'tariff-engine'
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span className="text-[11px] whitespace-nowrap">Tariffs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('driver-fleet')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'driver-fleet'
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[11px] whitespace-nowrap">Fleet Ops</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveModule('billing-logs')}
          className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
            activeModule === 'billing-logs'
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span className="text-[11px] whitespace-nowrap">GST Billing</span>
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
