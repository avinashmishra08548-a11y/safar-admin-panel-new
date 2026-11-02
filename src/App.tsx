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
  DEFAULT_TARIFF_PLANS,
  INITIAL_SAMPLE_BOOKINGS,
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
} from 'lucide-react';

type ActiveModule = 'control-room' | 'tariff-engine' | 'billing-logs';

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Firestore Operation Error</span>
            </div>
            <pre className="p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-800 overflow-x-auto whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
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
  const [authReady, setAuthReady] = useState(false);
  const [activeModule, setActiveModule] = useState<ActiveModule>('control-room');

  // Firestore Real-Time State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tariffs, setTariffs] = useState<TariffPlan[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [seedingData, setSeedingData] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Control Room Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [pickupDateFilter, setPickupDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | BookingStatus>('All');

  // Modals & Drawers
  const [assignDriverTarget, setAssignDriverTarget] = useState<Booking | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Booking | null>(null);
  const [myRidesPreviewTarget, setMyRidesPreviewTarget] = useState<Booking | null>(null);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);

  // Tariff Editor Draft State
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, TariffPlan>>({});
  const [savingTariffId, setSavingTariffId] = useState<string | null>(null);
  const [globalDiscountToggleBusy, setGlobalDiscountToggleBusy] = useState(false);

  // Live Outstation Fare Simulator inside Tariff Engine
  const [simCategory, setSimCategory] = useState<TariffPlan['categoryId']>('sedan');
  const [simDistanceKm, setSimDistanceKm] = useState(460);
  const [simDays, setSimDays] = useState(2);
  const [simTripMode, setSimTripMode] = useState<'round' | 'oneway'>('round');

  // Billing Logs Customer Filter
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

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners once authenticated and verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setDataLoading(false);
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
        list.sort((a, b) => (order[a.categoryId] || 9) - (order[b.categoryId] || 9));
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

    return () => {
      unsubBookings();
      unsubTariffs();
    };
  }, [authReady, user]);

  // Seed default SafarIndiaCabs Outstation Tariffs & Sample Bookings
  const handleSeedInitialOperationsData = async () => {
    if (!user || !user.emailVerified) return;
    setSeedingData(true);
    try {
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
            driverAllowancePerDay: clampNumber(plan.driverAllowancePerDay, 0, 10000),
            nightChargeDefault: clampNumber(plan.nightChargeDefault, 0, 10000),
            stateTaxDefault: clampNumber(plan.stateTaxDefault, 0, 50000),
            gstPercentage: clampNumber(plan.gstPercentage, 0, 28),
            marketDiscountEnabled: Boolean(plan.marketDiscountEnabled),
            marketDiscountAmount: clampNumber(plan.marketDiscountAmount, 0, 10000),
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

      showToast('Loaded SafarIndiaCabs live bookings (SIC2601–SIC2606) and Outstation Tariffs.');
    } finally {
      setSeedingData(false);
    }
  };

  // Auto-seed tariffs if empty when verified admin first arrives
  useEffect(() => {
    if (
      authReady &&
      user &&
      user.emailVerified &&
      !dataLoading &&
      bookings.length === 0 &&
      tariffs.length === 0 &&
      !seedingData
    ) {
      handleSeedInitialOperationsData();
    }
  }, [authReady, user, dataLoading, bookings.length, tariffs.length]);

  // Create new booking handler
  const handleCreateBooking = async (
    newBooking: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const path = `bookings/${newBooking.bookingId}`;
    try {
      await setDoc(doc(db, 'bookings', newBooking.bookingId), {
        ...newBooking,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(`Created booking ${newBooking.bookingId} for ${newBooking.customerName}.`);
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
  const handleStatusChange = async (booking: Booking, nextStatus: BookingStatus) => {
    const path = `bookings/${booking.bookingId}`;
    const isCompleting = nextStatus === 'Completed';
    const generatedInvoiceNo = isCompleting
      ? booking.invoiceNumber ||
        `INV-SIC-2611-${booking.bookingId.replace('SIC', '')}`
      : booking.invoiceNumber;

    // When marking Completed, balance is settled so customer gets final paid GST invoice
    const updatedAdvancePaid = isCompleting ? booking.totalFare : booking.advancePaid;
    const updatedBalance = isCompleting ? 0 : booking.balanceAmount;

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
        driverAllowancePerDay: clampNumber(draft.driverAllowancePerDay, 0, 10000),
        nightChargeDefault: clampNumber(draft.nightChargeDefault, 0, 10000),
        stateTaxDefault: clampNumber(draft.stateTaxDefault, 0, 50000),
        gstPercentage: clampNumber(draft.gstPercentage, 0, 28),
        marketDiscountEnabled: Boolean(draft.marketDiscountEnabled),
        marketDiscountAmount: clampNumber(draft.marketDiscountAmount, 0, 10000),
        updatedAt: serverTimestamp(),
      });
      showToast(`Published updated ${draft.vehicleCategory} outstation tariff to safarindiacabs.com.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setSavingTariffId(null);
    }
  };

  // Global Market Discount Toggle & Amount Updater across all 4 vehicle classes
  const handleApplyGlobalMarketDiscount = async (
    enabled: boolean,
    discountAmount: number
  ) => {
    setGlobalDiscountToggleBusy(true);
    const clampedDiscount = clampNumber(discountAmount, 0, 10000);
    try {
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
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
      return matchesQuery && matchesDate && matchesStatus;
    });
  }, [bookings, searchQuery, pickupDateFilter, statusFilter]);

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
    const completedCount = bookings.filter((b) => b.status === 'Completed').length;
    const grossBookingValue = bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((acc, b) => acc + b.totalFare, 0);
    const totalAdvanceCollected = bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((acc, b) => acc + b.advancePaid, 0);
    const pendingDriverCollection = bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((acc, b) => acc + b.balanceAmount, 0);

    return {
      totalCount,
      pendingDispatchCount,
      completedCount,
      grossBookingValue,
      totalAdvanceCollected,
      pendingDriverCollection,
    };
  }, [bookings]);

  // Live Fare Simulator inside Tariff Engine
  const simulatedQuote = useMemo(() => {
    const plan =
      tariffDrafts[simCategory] ||
      tariffs.find((t) => t.categoryId === simCategory) ||
      DEFAULT_TARIFF_PLANS[1];
    const days = clampNumber(simDays, 1, 30);
    const minKm = simTripMode === 'round' ? plan.minKmPerDay * days : plan.minKmPerDay;
    const billableKm = Math.max(clampNumber(simDistanceKm, 50, 10000), minKm);
    const rate = simTripMode === 'oneway' ? plan.oneWayRatePerKm : plan.baseRatePerKm;
    const baseFare = billableKm * rate;
    const da = plan.driverAllowancePerDay * days;
    const tax = plan.stateTaxDefault;
    const discount = plan.marketDiscountEnabled ? plan.marketDiscountAmount : 0;
    const taxable = Math.max(0, baseFare + da + tax - discount);
    const gst = Math.round(taxable * (plan.gstPercentage / 100));
    const total = taxable + gst;
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
    };
  }, [tariffDrafts, tariffs, simCategory, simDistanceKm, simDays, simTripMode]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Initializing SafarIndiaCabs Operations Session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Handle unverified Email/Password user gracefully
  if (!user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-slate-900 font-display">
            Verify Administrator Email
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zero-trust Firestore security rules require a verified administrator email address (<span className="font-mono text-slate-900">{user.email}</span>) before accessing customer PII or mutating outstation tariffs.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(user);
                showToast('Verification email sent. Check your inbox and click Refresh.');
              }}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Resend Verification Link
            </button>
            <button
              type="button"
              onClick={async () => {
                await user.reload();
                window.location.reload();
              }}
              className="w-full py-2 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              I Have Verified — Refresh Session
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full py-2 px-4 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer"
            >
              Sign Out & Use Verified Google Admin SSO
            </button>
          </div>
        </div>
      </div>
    );
  }

  const firstTariff = tariffs[0] || DEFAULT_TARIFF_PLANS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#control-room"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('control-room');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          SafarIndiaCabs
        </a>

        {/* Zone 2: 3–4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveModule('control-room')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'control-room'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            Live Control Room
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('tariff-engine')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'tariff-engine'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            Tariff & Pricing Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('billing-logs')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'billing-logs'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-amber-500 font-semibold'
                : ''
            }`}
          >
            Customer & Billing Logs
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewBookingModal(true)}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Customer Booking</span>
          </button>
        </div>
      </header>

      {/* Workspace Canvas: Sidebar + Main Content Viewport */}
      <div className="flex-1 flex">
        {/* Left Sidebar Navigation (256px width) */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col justify-between p-4 shrink-0">
          <div className="space-y-6">
            <div className="px-2 pt-1">
              <div className="text-xs font-mono text-slate-500">
                admin.safarindiacabs.com
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Customer App & Website Ops
              </div>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveModule('control-room')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'control-room'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Booking Control Room</span>
                </span>
                <span className="font-mono tabular-nums">{bookings.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('tariff-engine')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'tariff-engine'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Sliders className="w-4 h-4" />
                  <span>Tariff & Pricing Engine</span>
                </span>
                <span className="font-mono tabular-nums">{tariffs.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('billing-logs')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeModule === 'billing-logs'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Receipt className="w-4 h-4" />
                  <span>Customer & Billing Logs</span>
                </span>
                <span className="font-mono tabular-nums">{kpiStats.completedCount}</span>
              </button>
            </div>

            {/* Active Market Discount Summary Box */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-900">
                Market Discount Status
              </div>
              <div className="text-xs text-slate-600">
                {firstTariff.marketDiscountEnabled ? (
                  <span>
                    Active: <strong className="font-mono text-emerald-700">-{formatINR(firstTariff.marketDiscountAmount)}</strong> off on safarindiacabs.com quotes
                  </span>
                ) : (
                  <span>Disabled across outstation quotes</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('tariff-engine')}
                className="text-xs font-medium text-amber-700 hover:text-amber-800 underline cursor-pointer"
              >
                Configure in Tariff Engine →
              </button>
            </div>
          </div>

          {/* Operator Profile & Sign Out */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="px-2">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || 'Operations Admin'}
              </div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {user.email}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBookingsCsv}
                className="flex-1 py-2 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => signOut(auth)}
                title="Sign Out"
                className="p-2 text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* Toast feedback banner */}
          {toastMessage && (
            <div className="p-3.5 bg-slate-900 text-white rounded-lg flex items-center justify-between text-xs shadow-md">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{toastMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">
                Total Customer Bookings · Live Queue
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {kpiStats.totalCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {kpiStats.pendingDispatchCount} awaiting driver · {kpiStats.completedCount} completed
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">
                Gross Outstation & Local Fare Volume
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatINR(kpiStats.grossBookingValue)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Inclusive of 5% SAC 996412 GST
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">
                Online Advance Collected (20% & Full)
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatINR(kpiStats.totalAdvanceCollected)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Balance collectible on trip: <span className="font-mono">{formatINR(kpiStats.pendingDriverCollection)}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">
                Market Price Discount Engine
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {firstTariff.marketDiscountEnabled
                  ? `-${formatINR(firstTariff.marketDiscountAmount)}`
                  : 'OFF'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Sedan @ ₹{tariffs.find((t) => t.categoryId === 'sedan')?.baseRatePerKm || 13}/KM · Crysta @ ₹{tariffs.find((t) => t.categoryId === 'innova_crysta')?.baseRatePerKm || 21}/KM
              </div>
            </div>
          </section>

          {/* MODULE 1: CUSTOMER BOOKING MANAGEMENT (LIVE CONTROL ROOM) */}
          {activeModule === 'control-room' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 font-display">
                    Customer Booking Management · Live Control Room
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign verified chauffeur details to customer &apos;My Rides&apos; and mark trips Completed to unlock final GST invoices
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSeedInitialOperationsData}
                    disabled={seedingData}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${seedingData ? 'animate-spin' : ''}`} />
                    <span>{seedingData ? 'Syncing...' : 'Reset Sample Bookings'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportBookingsCsv}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel / CSV</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Booking ID (e.g. SIC2601), Customer Phone, Name, City, or Vehicle Plate..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  {/* Pickup Date Filter */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="pickup-date-filter" className="text-xs text-slate-500 whitespace-nowrap">
                      Pickup Date:
                    </label>
                    <input
                      id="pickup-date-filter"
                      type="date"
                      value={pickupDateFilter}
                      onChange={(e) => setPickupDateFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                    {pickupDateFilter && (
                      <button
                        type="button"
                        onClick={() => setPickupDateFilter('')}
                        className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Interactive Segmented Status Filter Controls */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {(['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          statusFilter === st
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Bookings Data Grid */}
              {dataLoading ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-12 bg-slate-100 animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
                  <Database className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-900">
                    No customer bookings match your current filter
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Clear your search filters or load the default SafarIndiaCabs outstation bookings (SIC2601–SIC2606) to manage dispatch and GST invoices.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPickupDateFilter('');
                        setStatusFilter('All');
                      }}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Reset Filters
                    </button>
                    <button
                      type="button"
                      onClick={handleSeedInitialOperationsData}
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer"
                    >
                      Load Sample SafarIndiaCabs Bookings
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <th className="py-3 px-4 text-left font-semibold">Booking ID & Pickup</th>
                          <th className="py-3 px-4 text-left font-semibold">Customer Details</th>
                          <th className="py-3 px-4 text-left font-semibold">Route & Cab Class</th>
                          <th className="py-3 px-4 text-left font-semibold">
                            Assigned Chauffeur (My Rides)
                          </th>
                          <th className="py-3 px-4 text-right font-semibold">
                            Fare & Advance Status
                          </th>
                          <th className="py-3 px-4 text-left font-semibold">Trip Status</th>
                          <th className="py-3 px-4 text-right font-semibold">
                            Operations Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredBookings.map((booking) => {
                          const hasDriver = Boolean(
                            booking.driverName && booking.vehicleNumber
                          );
                          return (
                            <tr
                              key={booking.bookingId}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              {/* Booking ID & Date */}
                              <td className="py-3.5 px-4 align-top">
                                <div className="font-mono font-bold text-slate-900 text-sm">
                                  {booking.bookingId}
                                </div>
                                <div className="font-mono text-slate-500 mt-0.5">
                                  {booking.pickupDate} · {booking.pickupTime}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMyRidesPreviewTarget(booking)}
                                  className="mt-1.5 text-amber-700 hover:text-amber-900 font-medium inline-flex items-center gap-1 underline cursor-pointer"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  <span>Customer My Rides View</span>
                                </button>
                              </td>

                              {/* Customer */}
                              <td className="py-3.5 px-4 align-top">
                                <div className="font-semibold text-slate-900">
                                  {booking.customerName}
                                </div>
                                <div className="font-mono text-slate-600 mt-0.5">
                                  {booking.customerPhone}
                                </div>
                                <div className="text-slate-500 truncate max-w-[180px]">
                                  {booking.customerEmail}
                                </div>
                              </td>

                              {/* Route & Vehicle Class */}
                              <td className="py-3.5 px-4 align-top">
                                <div className="font-medium text-slate-900">
                                  {booking.pickupCity} → {booking.dropCity}
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  {booking.vehicleCategory} · {booking.tripType}
                                </div>
                                <div className="font-mono text-slate-500 mt-0.5">
                                  {booking.distanceKm} KM · {booking.tripDays} Day(s) @ ₹{booking.perKmRate}/KM
                                </div>
                              </td>

                              {/* Assigned Driver */}
                              <td className="py-3.5 px-4 align-top">
                                {hasDriver ? (
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {booking.driverName}
                                    </div>
                                    <div className="font-mono text-slate-600 mt-0.5">
                                      {booking.driverPhone}
                                    </div>
                                    <div className="font-mono text-slate-700 font-medium mt-0.5">
                                      {booking.vehicleNumber} · {booking.vehicleModel}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setAssignDriverTarget(booking)}
                                      className="text-slate-500 hover:text-slate-900 underline mt-1 cursor-pointer"
                                    >
                                      Reassign Chauffeur
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="text-amber-700 font-medium">
                                      Unassigned · Pending Dispatch
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setAssignDriverTarget(booking)}
                                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      <span>Assign Driver</span>
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Fare & Advance */}
                              <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                                <div className="font-bold text-slate-900 text-sm">
                                  {formatINR(booking.totalFare)}
                                </div>
                                <div className="text-slate-600 mt-0.5">
                                  {booking.paymentMode} · Paid {formatINR(booking.advancePaid)}
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  Due: {formatINR(booking.balanceAmount)}
                                </div>
                              </td>

                              {/* Unboxed Status Metadata */}
                              <td className="py-3.5 px-4 align-top">
                                <div
                                  className={`font-semibold ${
                                    booking.status === 'Completed'
                                      ? 'text-emerald-700'
                                      : booking.status === 'Confirmed'
                                      ? 'text-slate-900'
                                      : booking.status === 'Cancelled'
                                      ? 'text-red-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {booking.status}
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  {booking.invoiceReady
                                    ? `GST Inv Ready (${booking.invoiceNumber})`
                                    : 'GST Inv Locked'}
                                </div>
                              </td>

                              {/* One-Click Operations Actions */}
                              <td className="py-3.5 px-4 align-top text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                  {booking.status !== 'Completed' &&
                                    booking.status !== 'Cancelled' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStatusChange(booking, 'Completed')
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
                                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
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
                                      className="text-slate-400 hover:text-red-600 inline-flex items-center gap-1 text-xs cursor-pointer"
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

          {/* MODULE 2: TARIFF & PRICING ENGINE CONTROL */}
          {activeModule === 'tariff-engine' && (
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 font-display">
                    Tariff & Pricing Engine Control
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure per-KM outstation base rates, state permit taxes, driver allowance (DA), night charges, and the ₹200 competitive market discount
                  </p>
                </div>
              </div>

              {/* Competitive Market Discount Master Control Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 max-w-xl">
                  <div className="text-sm font-bold text-slate-900 font-display">
                    Competitive Market Price Discount Logic (safarindiacabs.com)
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    When active, customers booking outstation cabs on safarindiacabs.com automatically receive an instant flat promotional discount (default ₹200) deducted from their pre-GST base fare.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="global-discount-amount"
                      className="text-xs font-medium text-slate-700 whitespace-nowrap"
                    >
                      Discount Rebate (INR):
                    </label>
                    <input
                      id="global-discount-amount"
                      type="number"
                      min={0}
                      max={5000}
                      value={
                        tariffDrafts[firstTariff.categoryId]?.marketDiscountAmount ??
                        firstTariff.marketDiscountAmount
                      }
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTariffDrafts((prev) => {
                          const next = { ...prev };
                          Object.keys(next).forEach((k) => {
                            next[k] = { ...next[k], marketDiscountAmount: val };
                          });
                          return next;
                        });
                      }}
                      className="w-24 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={globalDiscountToggleBusy}
                    onClick={() => {
                      const currentAmt =
                        tariffDrafts[firstTariff.categoryId]?.marketDiscountAmount ??
                        200;
                      handleApplyGlobalMarketDiscount(
                        !firstTariff.marketDiscountEnabled,
                        currentAmt
                      );
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      firstTariff.marketDiscountEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
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
                        tariffDrafts[firstTariff.categoryId]?.marketDiscountAmount ??
                        200;
                      handleApplyGlobalMarketDiscount(true, currentAmt);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
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
                      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
                        <div>
                          <h2 className="text-base font-bold text-slate-900 font-display">
                            {plan.vehicleCategory}
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {draft.sampleModels} · {draft.seatingCapacity} Seats + Chauffeur
                          </p>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-bold text-slate-900">
                            ₹{draft.baseRatePerKm}/KM
                          </div>
                          <div className="text-xs text-slate-500">
                            One-Way: ₹{draft.oneWayRatePerKm}/KM
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                        <div className="space-y-1">
                          <label className="block text-slate-600 font-medium">
                            Round-Trip Rate (₹/KM)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            value={draft.baseRatePerKm}
                            onChange={(e) =>
                              updateDraftField('baseRatePerKm', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 font-medium">
                            One-Way Rate (₹/KM)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            value={draft.oneWayRatePerKm}
                            onChange={(e) =>
                              updateDraftField('oneWayRatePerKm', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 font-medium">
                            Min KM / Day
                          </label>
                          <input
                            type="number"
                            min={50}
                            max={1000}
                            value={draft.minKmPerDay}
                            onChange={(e) =>
                              updateDraftField('minKmPerDay', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 font-medium">
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
                            className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 font-medium">
                            State Permit Tax (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50000}
                            value={draft.stateTaxDefault}
                            onChange={(e) =>
                              updateDraftField('stateTaxDefault', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-600 font-medium">
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
                            className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
                        <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
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
                            Enable ₹{draft.marketDiscountAmount} Market Discount for{' '}
                            {plan.vehicleCategory}
                          </span>
                        </label>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveTariff(plan.categoryId)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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

              {/* Interactive Outstation Fare Calculator */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-900" />
                    <h2 className="text-sm font-bold text-slate-900 font-display">
                      Live Website Fare Calculator Testbench (safarindiacabs.com)
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    SAC 996412 · 5% GST
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700">
                      Vehicle Category
                    </label>
                    <select
                      value={simCategory}
                      onChange={(e) =>
                        setSimCategory(e.target.value as TariffPlan['categoryId'])
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="hatchback">Hatchback</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="innova_crysta">Innova Crysta</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700">
                      Trip Mode
                    </label>
                    <select
                      value={simTripMode}
                      onChange={(e) =>
                        setSimTripMode(e.target.value as 'round' | 'oneway')
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="round">Round Trip Outstation</option>
                      <option value="oneway">One-Way Drop</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700">
                      Distance (KM)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={10000}
                      value={simDistanceKm}
                      onChange={(e) => setSimDistanceKm(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-slate-700">
                      Duration (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={simDays}
                      onChange={(e) => setSimDays(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs font-mono">
                  <div>
                    <div className="text-slate-500 font-sans">
                      Base ({simulatedQuote.billableKm} KM @ ₹{simulatedQuote.rate})
                    </div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {formatINR(simulatedQuote.baseFare)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">Driver Allowance</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {formatINR(simulatedQuote.da)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">State Tax Est.</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {formatINR(simulatedQuote.tax)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">Market Discount</div>
                    <div className="font-semibold text-emerald-700 mt-0.5">
                      -{formatINR(simulatedQuote.discount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">5% GST</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      +{formatINR(simulatedQuote.gst)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">Final Customer Quote</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {formatINR(simulatedQuote.total)}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* MODULE 3: CUSTOMER & BILLING LOGS */}
          {activeModule === 'billing-logs' && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 font-display">
                    Customer & Billing Logs · GST Invoice Register
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Audit customer trip history, 20% Advance vs Full Paid settlement status, and download duplicate SAC 996412 GST invoices
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBookingsCsv}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export All Billing Logs (Excel / CSV)</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={billingCustomerSearch}
                    onChange={(e) => setBillingCustomerSearch(e.target.value)}
                    placeholder="Filter by Customer Name, Phone Number, Booking ID, or GST Invoice Number..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['All', '20% Advance', 'Full Paid'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBillingPaymentFilter(mode)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        billingPaymentFilter === mode
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Billing Ledger Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
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
                    <tbody className="divide-y divide-slate-200">
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
                          <tr key={b.bookingId} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-4 align-top font-mono">
                              <div className="font-bold text-slate-900">{b.bookingId}</div>
                              <div className="text-slate-500 mt-0.5">{invoiceRef}</div>
                              <div className="text-slate-500 mt-0.5">{b.pickupDate}</div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-semibold text-slate-900">
                                {b.customerName}
                              </div>
                              <div className="font-mono text-slate-600 mt-0.5">
                                {b.customerPhone}
                              </div>
                              <div className="font-mono text-slate-500 mt-0.5">
                                GSTIN: {b.customerGstin || 'B2C Consumer'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-medium text-slate-900">
                                {b.pickupCity} → {b.dropCity}
                              </div>
                              <div className="text-slate-500 mt-0.5">
                                {b.vehicleCategory} · {b.distanceKm} KM ({b.tripDays}d)
                              </div>
                              <div className="font-mono text-slate-600 mt-0.5">
                                {b.driverName
                                  ? `${b.driverName} (${b.vehicleNumber})`
                                  : 'Driver Pending'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="text-slate-900">
                                Taxable: {formatINR(taxable)}
                              </div>
                              <div className="text-slate-500 mt-0.5">
                                5% GST: +{formatINR(b.gstAmount)}
                              </div>
                              {b.marketDiscount > 0 && (
                                <div className="text-emerald-700 mt-0.5">
                                  Disc: -{formatINR(b.marketDiscount)}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                              <div className="font-bold text-slate-900 text-sm">
                                {formatINR(b.totalFare)}
                              </div>
                              <div className="text-slate-500 mt-0.5">{b.status}</div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-semibold text-slate-900">
                                {b.paymentMode}
                              </div>
                              <div className="font-mono text-emerald-700 mt-0.5">
                                Paid: {formatINR(b.advancePaid)}
                              </div>
                              <div className="font-mono text-slate-500 mt-0.5">
                                Balance: {formatINR(b.balanceAmount)}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right">
                              <button
                                type="button"
                                onClick={() => setInvoiceTarget(b)}
                                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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

      {/* Modals & Drawers */}
      {assignDriverTarget && (
        <AssignDriverModal
          booking={assignDriverTarget}
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
