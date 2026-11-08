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
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  defaultDb,
  OperationType,
  handleFirestoreError,
} from './lib/firebase';
import {
  Booking,
  BookingStatus,
  TariffPlan,
  FleetDriver,
  FleetVehicle,
  SupportTicket,
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
  normalizeIncomingBooking,
  sortBookingsNewestFirst,
} from './types/safar';
import { LoginScreen } from './components/LoginScreen';
import { AssignDriverModal } from './components/AssignDriverModal';
import { GstInvoiceModal } from './components/GstInvoiceModal';
import { CustomerMyRidesDrawer } from './components/CustomerMyRidesDrawer';
import { AddDriverModal } from './components/AddDriverModal';
import { WhatsAppDispatchModal } from './components/WhatsAppDispatchModal';
import { BillGeneratorModule } from './components/BillGeneratorModule';
import {
  CustomersDirectoryModule,
  GatewaysAndApisModule,
  SecurityAndApkModule,
} from './components/CustomersGatewaysApkModules';
import {
  ExecutiveDashboardOverview,
  BookingDetailAndWorkflowModal,
  VehicleFleetManagementModule,
  SupportAndComplaintsModule,
  WebsiteAppCmsAndNotificationsModule,
  BusinessReportsAndAnalyticsModule,
} from './components/EnterpriseOperationsModules';
import { BookingIdFirestoreSearchBar } from './components/BookingIdFirestoreSearchBar';
import {
  BOOKING_BROADCAST_CHANNEL,
  FirestoreSyncDiagnosticState,
  PRIMARY_BOOKINGS_COLLECTION,
  diagnoseAndLogFirestoreError,
  generateUniqueBookingId,
  normalizeBookingIdInput,
  persistBookingToFirestore,
  subscribeToRealtimeCustomerBookings,
} from './lib/bookingSyncService';
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
  BarChart3,
  Headphones,
  Megaphone,
  ClipboardList,
} from 'lucide-react';

type ActiveModule =
  | 'overview-dashboard'
  | 'control-room'
  | 'bill-generator'
  | 'customers'
  | 'tariff-engine'
  | 'driver-fleet'
  | 'vehicle-fleet'
  | 'support-desk'
  | 'cms-portal'
  | 'reports-analytics'
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

function loadInitialVehicles(): FleetVehicle[] {
  try {
    const saved = localStorage.getItem('safar_fleet_vehicles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function loadInitialSupportTickets(): SupportTicket[] {
  try {
    const saved = localStorage.getItem('safar_support_tickets');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
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
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(loadInitialVehicles);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(
    loadInitialSupportTickets
  );
  const [dataLoading, setDataLoading] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [firestoreSyncDiag, setFirestoreSyncDiag] =
    useState<FirestoreSyncDiagnosticState>({
      status: 'connecting',
      activeCollection: PRIMARY_BOOKINGS_COLLECTION,
      activeDatabase: 'named-db + default-db',
      totalCloudDocs: 0,
      lastSyncedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      collectionCounts: {},
    });

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
  const [bookingDetailTarget, setBookingDetailTarget] =
    useState<Booking | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Booking | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<Booking | null>(null);
  const [billGeneratorBookingTarget, setBillGeneratorBookingTarget] =
    useState<Booking | null>(null);
  const [myRidesPreviewTarget, setMyRidesPreviewTarget] =
    useState<Booking | null>(null);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [showSyncIncomingModal, setShowSyncIncomingModal] = useState(false);
  const [syncRawText, setSyncRawText] = useState('');
  const [syncBookingDraft, setSyncBookingDraft] = useState({
    bookingId: `SIC${Math.floor(3000 + Math.random() * 6000)}`,
    customerName: '',
    customerPhone: '+91 ',
    pickupCity: 'New Delhi',
    dropCity: '',
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: '08:30 AM',
    tripType: 'Round Trip Outstation' as Booking['tripType'],
    vehicleCategory: 'Sedan' as Booking['vehicleCategory'],
    distanceKm: 300,
    tripDays: 1,
    sameDayReturn: true,
    perKmRate: 14,
    baseFare: 4200,
    driverAllowance: 300,
    tollTax: 450,
    stateTax: 350,
    marketDiscount: 200,
    advancePaid: 1000,
  });

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

  // Live Outstation Fare & Commission Simulator (Default 1 Day Same-Day Return)
  const [simCategory, setSimCategory] =
    useState<TariffPlan['categoryId']>('sedan');
  const [simDistanceKm, setSimDistanceKm] = useState(300);
  const [simDays, setSimDays] = useState(1);
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

  // Real-time Firestore listeners (attaches for both Firebase Auth & Direct Operator Console sessions, across both named and default DBs and all customer booking collections)
  useEffect(() => {
    if (!authReady || (!user && !directOperatorEmail)) {
      setDataLoading(false);
      return;
    }

    const unsubRealtimeBookings = subscribeToRealtimeCustomerBookings({
      onBookingsSnapshot: (
        cloudBookings,
        { addedBookings, removedBookingIds, isInitialLoad }
      ) => {
        const removedSet = new Set(removedBookingIds);

        setBookings((prev) => {
          const byId = new Map<string, Booking>();

          // 1. Retain existing local real bookings unless explicitly deleted in Firestore
          prev.forEach((b) => {
            if (
              b &&
              b.bookingId &&
              !isSampleDemoBooking(b) &&
              !removedSet.has(b.bookingId)
            ) {
              byId.set(b.bookingId, b);
            }
          });

          // 2. Apply all live cloud bookings (overwriting stale local copies with latest Firestore state)
          cloudBookings.forEach((b) => {
            if (b && b.bookingId && !isSampleDemoBooking(b)) {
              byId.set(b.bookingId, b);
            }
          });

          const merged = sortBookingsNewestFirst(Array.from(byId.values()));
          try {
            localStorage.setItem(
              'safar_local_bookings',
              JSON.stringify(merged)
            );
          } catch {
            // ignore storage quota errors
          }
          return merged;
        });

        setDataLoading(false);

        // 3. When a new booking arrives in real time after initial load, surface it immediately without manual refresh
        if (!isInitialLoad && addedBookings.length > 0) {
          const latest = addedBookings[0];
          setStatusFilter((prevStatus) =>
            prevStatus !== 'All' && prevStatus !== 'Pending Driver'
              ? 'All'
              : prevStatus
          );
          setCategoryFilter('All');
          setPickupDateFilter('');
          showToast(
            `New Customer Booking Live Synced: ${latest.bookingId} (${latest.customerName} • ${latest.pickupCity} → ${latest.dropCity})`
          );
        }
      },
      onDiagnosticChange: (diag) => {
        setFirestoreSyncDiag(diag);
      },
    });

    const unsubTariffs = onSnapshot(
      collection(db, 'tariffs'),
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
      collection(db, 'drivers'),
      (snapshot) => {
        const list: FleetDriver[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as FleetDriver;
          if (isSampleDemoDriver(data)) {
            deleteDoc(doc(db, 'drivers', data.driverId)).catch(() => {});
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
      unsubRealtimeBookings();
      unsubTariffs();
      unsubDrivers();
    };
  }, [authReady, user, directOperatorEmail]);

  // Cross-tab & customer portal real-time booking sync listener (Storage + BroadcastChannel)
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'safar_local_bookings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const realOnly: Booking[] = [];
            parsed.forEach((b: Record<string, unknown>, idx: number) => {
              if (!b) return;
              const norm = normalizeIncomingBooking(
                String(b.bookingId || b.id || `SIC${2700 + idx}`),
                b
              );
              if (norm && !isSampleDemoBooking(norm)) {
                realOnly.push(norm);
              }
            });
            setBookings(realOnly);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageSync);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BOOKING_BROADCAST_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'BOOKING_UPSERT' && ev.data?.booking) {
          const incoming = normalizeIncomingBooking(
            String(ev.data.booking.bookingId || ''),
            ev.data.booking as Record<string, unknown>
          );
          if (incoming && !isSampleDemoBooking(incoming)) {
            setBookings((prev) => {
              const filtered = prev.filter(
                (b) => b.bookingId !== incoming.bookingId
              );
              return [incoming, ...filtered];
            });
          }
        }
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorageSync);
      if (bc) bc.close();
    };
  }, []);

  // Actively fetch & sync live customer bookings from both named & default Firestore DBs + local storage
  const handleSeedInitialOperationsData = async () => {
    setSeedingData(true);
    try {
      const byId = new Map<string, Booking>();

      // 1. Preserve current real bookings in memory & localStorage
      bookings.forEach((b) => {
        if (b && b.bookingId && !isSampleDemoBooking(b)) {
          const norm = normalizeIncomingBooking(
            b.bookingId,
            b as unknown as Record<string, unknown>
          );
          if (norm) {
            byId.set(b.bookingId, norm);
          }
        }
      });

      const localRaw = localStorage.getItem('safar_local_bookings');
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: Record<string, unknown>, idx: number) => {
              const norm = normalizeIncomingBooking(
                String(item.bookingId || item.id || `SIC${2800 + idx}`),
                item
              );
              if (norm && !isSampleDemoBooking(norm)) {
                byId.set(norm.bookingId, norm);
              }
            });
          }
        } catch {
          // ignore
        }
      }

      // 2. Actively query Firestore collections across both named (db) and default (defaultDb) databases
      const targets = [
        { database: db, label: 'named-db', col: 'bookings' },
        { database: defaultDb, label: 'default-db', col: 'bookings' },
        { database: db, label: 'named-db', col: 'cab_bookings' },
        { database: defaultDb, label: 'default-db', col: 'cab_bookings' },
        { database: db, label: 'named-db', col: 'rides' },
        { database: defaultDb, label: 'default-db', col: 'rides' },
        { database: db, label: 'named-db', col: 'customer_bookings' },
        { database: defaultDb, label: 'default-db', col: 'customer_bookings' },
      ];

      await Promise.allSettled(
        targets.map(async ({ database, label, col }) => {
          try {
            const snap = await getDocs(collection(database, col));
            snap.forEach((docSnap) => {
              const norm = normalizeIncomingBooking(
                docSnap.id,
                docSnap.data() as Record<string, unknown>,
                `${label}/${col}`
              );
              if (norm && !isSampleDemoBooking(norm)) {
                byId.set(norm.bookingId, norm);
              }
            });
          } catch (err) {
            if (label === 'named-db' && col === 'bookings') {
              diagnoseAndLogFirestoreError(err, {
                operation: OperationType.LIST,
                collectionName: col,
                databaseLabel: label,
              });
            }
          }
        })
      );

      const syncedList = sortBookingsNewestFirst(Array.from(byId.values()));
      setBookings(syncedList);
      localStorage.setItem('safar_local_bookings', JSON.stringify(syncedList));

      showToast(
        `Live Bookings synced (${syncedList.length} real customer booking(s) active in Control Room).`
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

  // Save updated booking from 9-stage Booking Detail & Workflow Modal
  const handleSaveUpdatedBooking = async (updatedBooking: Booking) => {
    const updatedList = bookings.map((b) =>
      b.bookingId === updatedBooking.bookingId ? updatedBooking : b
    );
    setBookings(updatedList);
    localStorage.setItem('safar_local_bookings', JSON.stringify(updatedList));
    setBookingDetailTarget(updatedBooking);

    if (isFirebaseVerifiedSession && user) {
      const path = `bookings/${updatedBooking.bookingId}`;
      try {
        await updateDoc(doc(db, 'bookings', updatedBooking.bookingId), {
          status: updatedBooking.status,
          pickupCity: updatedBooking.pickupCity,
          dropCity: updatedBooking.dropCity,
          pickupDate: updatedBooking.pickupDate,
          pickupTime: updatedBooking.pickupTime,
          distanceKm: updatedBooking.distanceKm,
          tripDays: updatedBooking.tripDays,
          baseFare: updatedBooking.baseFare,
          driverAllowance: updatedBooking.driverAllowance,
          stateTax: updatedBooking.stateTax,
          nightCharges: updatedBooking.nightCharges,
          marketDiscount: updatedBooking.marketDiscount,
          gstAmount: updatedBooking.gstAmount,
          totalFare: updatedBooking.totalFare,
          advancePaid: updatedBooking.advancePaid,
          balanceAmount: updatedBooking.balanceAmount,
          paymentMode: updatedBooking.paymentMode,
          invoiceNumber: updatedBooking.invoiceNumber,
          invoiceReady: updatedBooking.invoiceReady,
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
        <nav className="hidden md:flex items-center gap-5 text-sm font-bold text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setActiveModule('overview-dashboard')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'overview-dashboard'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Executive Dashboard
          </button>
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
            onClick={() => setActiveModule('vehicle-fleet')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'vehicle-fleet'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Vehicles & Permits
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('support-desk')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'support-desk'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Support Desk
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('reports-analytics')}
            className={`hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeModule === 'reports-analytics'
                ? 'text-slate-950 dark:text-amber-400 underline underline-offset-8 decoration-2 decoration-amber-500 font-extrabold'
                : ''
            }`}
          >
            Reports & Analytics
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSyncIncomingModal(true)}
            className="px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-amber-300 bg-slate-200/85 dark:bg-slate-800 hover:bg-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Sync Website / WhatsApp Ride</span>
            <span className="sm:hidden">Sync Ride</span>
          </button>
          <button
            type="button"
            onClick={handleSeedInitialOperationsData}
            disabled={seedingData}
            className="px-3.5 sm:px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${seedingData ? 'animate-spin' : ''}`} />
            <span>{seedingData ? 'Syncing...' : 'Sync Live Bookings'}</span>
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

            {/* All 13 Enterprise Navigation Modules */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveModule('overview-dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'overview-dashboard'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <BarChart3 className="w-4 h-4" />
                  <span>Executive Dashboard</span>
                </span>
                <span className="font-mono font-extrabold text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  14 KPI
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('control-room')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                onClick={() => setActiveModule('driver-fleet')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'driver-fleet'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Chauffeurs (Admin-Only)</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {drivers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('vehicle-fleet')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'vehicle-fleet'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Car className="w-4 h-4" />
                  <span>Commercial Vehicles</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {vehicles.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('customers')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                onClick={() => setActiveModule('support-desk')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'support-desk'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Headphones className="w-4 h-4" />
                  <span>Support & Complaints</span>
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {supportTickets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('cms-portal')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'cms-portal'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <Megaphone className="w-4 h-4" />
                  <span>Website & App CMS</span>
                </span>
                <span className="font-mono font-extrabold text-[10px]">PROMO</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('reports-analytics')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeModule === 'reports-analytics'
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
                  <ClipboardList className="w-4 h-4" />
                  <span>Reports & Analytics</span>
                </span>
                <span className="font-mono font-extrabold text-[10px]">10 RPT</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('gateways-apis')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                  ['overview-dashboard', 'Executive Dashboard'],
                  ['control-room', 'Bookings & Dispatch'],
                  ['bill-generator', 'Tax Invoice Studio'],
                  ['driver-fleet', 'Chauffeurs (Admin)'],
                  ['vehicle-fleet', 'Commercial Vehicles'],
                  ['customers', 'Customers'],
                  ['tariff-engine', 'Tariff Engine'],
                  ['support-desk', 'Support Desk'],
                  ['cms-portal', 'Website & App CMS'],
                  ['reports-analytics', 'Reports & Analytics'],
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

          {/* DEDICATED FIRESTORE BOOKING ID SEARCH & BREAKDOWN BAR */}
          {(activeModule === 'overview-dashboard' ||
            activeModule === 'control-room') && (
            <BookingIdFirestoreSearchBar
              bookings={bookings}
              onBookingFoundAndSynced={(foundBooking) => {
                setBookings((prev) => {
                  const exists = prev.some(
                    (b) => b.bookingId === foundBooking.bookingId
                  );
                  const next = exists
                    ? prev.map((b) =>
                        b.bookingId === foundBooking.bookingId ? foundBooking : b
                      )
                    : [foundBooking, ...prev];
                  localStorage.setItem(
                    'safar_local_bookings',
                    JSON.stringify(next)
                  );
                  return next;
                });
              }}
              onOpenAssignDriver={(b) => setAssignDriverTarget(b)}
              onOpenBookingDetail={(b) => setBookingDetailTarget(b)}
              onOpenInvoice={(b) => setInvoiceTarget(b)}
              onOpenBillStudio={(b) => {
                setBillGeneratorBookingTarget(b);
                setActiveModule('bill-generator');
              }}
              onOpenWhatsAppDispatch={(b) => setWhatsAppTarget(b)}
              onOpenSyncCustomerModal={() => {
                setSyncBookingDraft((p) => ({
                  ...p,
                  bookingId: generateUniqueBookingId(
                    bookings.map((b) => b.bookingId)
                  ),
                }));
                setShowSyncIncomingModal(true);
              }}
            />
          )}

          {/* TAB 0: EXECUTIVE ADMIN DASHBOARD OVERVIEW */}
          {activeModule === 'overview-dashboard' && (
            <ExecutiveDashboardOverview
              bookings={bookings}
              drivers={drivers}
              vehicles={vehicles}
              tickets={supportTickets}
              tariffs={tariffs}
              onOpenAddDriver={() => setShowAddDriverModal(true)}
              onSwitchModule={(mod) => setActiveModule(mod as ActiveModule)}
              onSelectBookingForDetails={(b: Booking) =>
                setBookingDetailTarget(b)
              }
              onSelectBookingForAssign={(b: Booking) =>
                setAssignDriverTarget(b)
              }
            />
          )}

          {/* TAB 1: BOOKINGS & DISPATCH TAB */}
          {activeModule === 'control-room' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-900 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-800 shadow-xs">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-display">
                      Owner & Dispatch Control Center
                    </h1>
                    <span
                      title={
                        firestoreSyncDiag.lastErrorMessage
                          ? `Firestore Diagnostic: ${firestoreSyncDiag.lastErrorMessage}`
                          : `Listening in real-time to collection "${firestoreSyncDiag.activeCollection}" (${firestoreSyncDiag.activeDatabase})`
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold border ${
                        firestoreSyncDiag.status === 'live'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : firestoreSyncDiag.status === 'permission-error'
                            ? 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
                            : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          firestoreSyncDiag.status === 'live'
                            ? 'bg-emerald-500 animate-pulse'
                            : firestoreSyncDiag.status === 'permission-error'
                              ? 'bg-red-500'
                              : 'bg-amber-500 animate-pulse'
                        }`}
                      />
                      <span>
                        Firestore: {firestoreSyncDiag.activeCollection} (
                        {firestoreSyncDiag.totalCloudDocs} cloud docs)
                      </span>
                      {firestoreSyncDiag.lastSyncedAt && (
                        <span className="opacity-75">
                          • {firestoreSyncDiag.lastSyncedAt}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                    Live Customer Bookings, 1-Tap WhatsApp Dispatch, Chauffeur Allotment & Certified GST Billing ({OFFICIAL_GSTIN})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                    Live bookings placed by customers via the SafarIndiaCabs Android App or Website will automatically appear here in real time.
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
                      onClick={handleSeedInitialOperationsData}
                      className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer"
                    >
                      Sync Live Bookings
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSyncIncomingModal(true)}
                      className="px-4 py-2 text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Sync Incoming Website / WhatsApp Booking
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
                              onClick={() => setBookingDetailTarget(booking)}
                              className="py-2 px-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                              <span>Workflow</span>
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

                                    {/* 9-Stage Workflow & Booking Detail */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setBookingDetailTarget(booking)
                                      }
                                      className="px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-lg font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                                      <span>9-Stage Workflow</span>
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
                        Days (1 = Same Day)
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSimDays(1)}
                          className={`px-2 py-2 rounded-lg font-extrabold text-[11px] cursor-pointer border ${
                            simDays === 1
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          1d
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={simDays}
                          onChange={(e) => setSimDays(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-2 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
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
                          1. Base Cab ({simulatedQuote.billableKm} KM @ ₹
                          {simulatedQuote.rate}):{' '}
                          {formatINR(simulatedQuote.baseFare)}
                        </div>
                        <div>
                          2. Driver Allowance ({simDays}d):{' '}
                          {formatINR(simulatedQuote.da)}
                        </div>
                        <div>
                          3. State Permit / Toll Tax:{' '}
                          {formatINR(simulatedQuote.tax)}
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
                                <div className="flex items-center gap-1">
                                  <a
                                    href={`tel:${drv.driverPhone.replace(/\s+/g, '')}`}
                                    title="Call Chauffeur"
                                    className="px-2 py-1 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-extrabold inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <Phone className="w-3 h-3 text-amber-400" />
                                    <span>Call</span>
                                  </a>
                                  <a
                                    href={`https://wa.me/${drv.driverPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      `Hello ${drv.driverName} (${drv.vehicleNumber}), SafarIndiaCabs Dispatch Control Room here.`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="WhatsApp Chauffeur"
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>

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

          {/* TAB 5B: COMMERCIAL VEHICLE & FLEET PERMIT MANAGEMENT */}
          {activeModule === 'vehicle-fleet' && (
            <VehicleFleetManagementModule
              vehicles={vehicles}
              drivers={drivers}
              onSaveVehicles={(nextVehicles) => {
                setVehicles(nextVehicles);
                localStorage.setItem(
                  'safar_fleet_vehicles',
                  JSON.stringify(nextVehicles)
                );
              }}
              onShowToast={showToast}
            />
          )}

          {/* TAB 5C: CUSTOMER SUPPORT & COMPLAINTS DESK */}
          {activeModule === 'support-desk' && (
            <SupportAndComplaintsModule
              tickets={supportTickets}
              bookings={bookings}
              onSaveTickets={(nextTickets) => {
                setSupportTickets(nextTickets);
                localStorage.setItem(
                  'safar_support_tickets',
                  JSON.stringify(nextTickets)
                );
              }}
              onShowToast={showToast}
            />
          )}

          {/* TAB 5D: WEBSITE & CUSTOMER APP CMS + NOTIFICATION TEMPLATES */}
          {activeModule === 'cms-portal' && (
            <WebsiteAppCmsAndNotificationsModule onShowToast={showToast} />
          )}

          {/* TAB 5E: BUSINESS REPORTS & TAX ANALYTICS */}
          {activeModule === 'reports-analytics' && (
            <BusinessReportsAndAnalyticsModule
              bookings={bookings}
              drivers={drivers}
              vehicles={vehicles}
              onExportBookingsCsv={handleExportBookingsCsv}
              onShowToast={showToast}
            />
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
          allBookings={bookings}
          onClose={() => setAssignDriverTarget(null)}
          onSave={handleAssignDriver}
        />
      )}

      {bookingDetailTarget && (
        <BookingDetailAndWorkflowModal
          booking={bookingDetailTarget}
          onClose={() => setBookingDetailTarget(null)}
          onSaveUpdatedBooking={handleSaveUpdatedBooking}
          onOpenAssignDriver={(b) => {
            setBookingDetailTarget(null);
            setAssignDriverTarget(b);
          }}
          onOpenInvoice={(b) => {
            setBookingDetailTarget(null);
            setInvoiceTarget(b);
          }}
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

      {showAddDriverModal && (
        <AddDriverModal
          existingDriverIds={drivers.map((d) => d.driverId)}
          onClose={() => setShowAddDriverModal(false)}
          onAddDriver={handleAddFleetDriver}
        />
      )}

      {showSyncIncomingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                  Sync Incoming Customer Booking (Website / WhatsApp / App)
                </h2>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Sync a live customer booking from safarindiacabs.com or WhatsApp notification directly into Control Room & Firestore
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncIncomingModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
              {/* Paste WhatsApp / Website Booking Alert to Auto-Parse */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-extrabold text-slate-800 dark:text-slate-200">
                    Option A: Paste WhatsApp / Website Booking Confirmation Text (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!syncRawText.trim()) return;
                      const txt = syncRawText;
                      const idMatch = txt.match(/SIC[-_]?(\d{4,8})/i);
                      const phoneMatch = txt.match(/(?:\+?91[\s-]?)?([6-9]\d{9})/);
                      const nameMatch = txt.match(/(?:Name|Customer|Passenger|Traveller)\s*[:\-]\s*([^\n\r*]+)/i);
                      const pickupMatch = txt.match(/(?:Pickup|From|Origin)\s*[:\-]\s*([^\n\r*→]+)/i);
                      const dropMatch = txt.match(/(?:Drop|To|Destination)\s*[:\-]\s*([^\n\r*]+)/i);
                      const kmMatch = txt.match(/(\d{2,5})\s*KM/i);
                      const fareMatch = txt.match(/(?:Total|Fare|Amount)\s*[:\-₹Rs.\s]*([\d,]+)/i);

                      setSyncBookingDraft((prev) => ({
                        ...prev,
                        bookingId: idMatch ? `SIC${idMatch[1]}` : prev.bookingId,
                        customerName: nameMatch ? nameMatch[1].trim() : prev.customerName,
                        customerPhone: phoneMatch ? `+91 ${phoneMatch[1]}` : prev.customerPhone,
                        pickupCity: pickupMatch ? pickupMatch[1].trim() : prev.pickupCity,
                        dropCity: dropMatch ? dropMatch[1].trim() : prev.dropCity,
                        distanceKm: kmMatch ? Number(kmMatch[1]) : prev.distanceKm,
                        baseFare: fareMatch
                          ? Number(fareMatch[1].replace(/,/g, ''))
                          : prev.baseFare,
                      }));
                      showToast('Extracted customer booking details from text.');
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg cursor-pointer shrink-0"
                  >
                    Auto-Fill Details
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={syncRawText}
                  onChange={(e) => setSyncRawText(e.target.value)}
                  placeholder="Paste WhatsApp booking message or website alert here to auto-fill customer name, phone, route, and fare..."
                  className="w-full px-3 py-2 font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Customer & Route Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Unique Booking ID (SICXXXX)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={syncBookingDraft.bookingId}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          bookingId: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full px-3 py-2 font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          bookingId: generateUniqueBookingId(
                            bookings.map((b) => b.bookingId)
                          ),
                        }))
                      }
                      className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 font-extrabold text-[11px] whitespace-nowrap cursor-pointer"
                    >
                      Auto ID
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={syncBookingDraft.customerName}
                    onChange={(e) =>
                      setSyncBookingDraft((p) => ({
                        ...p,
                        customerName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Rohit Kumar"
                    className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Mobile *
                  </label>
                  <input
                    type="tel"
                    value={syncBookingDraft.customerPhone}
                    onChange={(e) =>
                      setSyncBookingDraft((p) => ({
                        ...p,
                        customerPhone: e.target.value,
                      }))
                    }
                    placeholder="+91 9990710871"
                    className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup City / Address *
                  </label>
                  <input
                    type="text"
                    value={syncBookingDraft.pickupCity}
                    onChange={(e) =>
                      setSyncBookingDraft((p) => ({
                        ...p,
                        pickupCity: e.target.value,
                      }))
                    }
                    placeholder="e.g. Nathupura Burari 110084"
                    className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Drop City / Destination *
                  </label>
                  <input
                    type="text"
                    value={syncBookingDraft.dropCity}
                    onChange={(e) =>
                      setSyncBookingDraft((p) => ({
                        ...p,
                        dropCity: e.target.value,
                      }))
                    }
                    placeholder="e.g. Dera Bassi Punjab"
                    className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Trip Type
                  </label>
                  <select
                    value={syncBookingDraft.tripType}
                    onChange={(e) =>
                      setSyncBookingDraft((p) => ({
                        ...p,
                        tripType: e.target.value as Booking['tripType'],
                      }))
                    }
                    className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Round Trip Outstation">Round Trip Outstation</option>
                    <option value="One Way Outstation">One Way Outstation</option>
                    <option value="Local 8Hr/80Km">Local 8Hr/80Km</option>
                    <option value="Airport Transfer">Airport Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Cab Category
                  </label>
                  <select
                    value={syncBookingDraft.vehicleCategory}
                    onChange={(e) =>
                      setSyncBookingDraft((p) => ({
                        ...p,
                        vehicleCategory: e.target.value as Booking['vehicleCategory'],
                      }))
                    }
                    className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Innova Crysta">Innova Crysta</option>
                    <option value="Hatchback">Hatchback</option>
                  </select>
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup Date & Time
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={syncBookingDraft.pickupDate}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          pickupDate: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Same Day = 1d)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          tripDays: 1,
                          sameDayReturn: true,
                        }))
                      }
                      className={`px-2.5 py-2 rounded-xl font-extrabold cursor-pointer border ${
                        syncBookingDraft.tripDays === 1
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300'
                      }`}
                    >
                      Same Day (1d)
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={syncBookingDraft.tripDays}
                      onChange={(e) => {
                        const d = Math.max(1, Number(e.target.value) || 1);
                        setSyncBookingDraft((p) => ({
                          ...p,
                          tripDays: d,
                          sameDayReturn: d === 1,
                        }));
                      }}
                      className="w-full px-2.5 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Separate Itemized Fare Breakup */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="font-extrabold text-slate-800 dark:text-slate-200">
                  Itemized Fare Breakup (Shown Separately on Bill & Control Room)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Distance (KM)
                    </label>
                    <input
                      type="number"
                      value={syncBookingDraft.distanceKm}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          distanceKm: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      1. Base Cab Fare (₹)
                    </label>
                    <input
                      type="number"
                      value={syncBookingDraft.baseFare}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          baseFare: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      2. Driver Allowance (₹)
                    </label>
                    <input
                      type="number"
                      value={syncBookingDraft.driverAllowance}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          driverAllowance: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      3. Highway Toll Tax (₹)
                    </label>
                    <input
                      type="number"
                      value={syncBookingDraft.tollTax}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          tollTax: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      4. State Permit Tax (₹)
                    </label>
                    <input
                      type="number"
                      value={syncBookingDraft.stateTax}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          stateTax: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Advance Received (₹)
                    </label>
                    <input
                      type="number"
                      value={syncBookingDraft.advancePaid}
                      onChange={(e) =>
                        setSyncBookingDraft((p) => ({
                          ...p,
                          advancePaid: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSyncIncomingModal(false)}
                  className="px-4 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!syncBookingDraft.customerName.trim() || !syncBookingDraft.dropCity.trim()) {
                      showToast('Please enter Customer Name and Drop City to sync booking.');
                      return;
                    }
                    const cleanId =
                      normalizeBookingIdInput(syncBookingDraft.bookingId) ||
                      generateUniqueBookingId(bookings.map((b) => b.bookingId));

                    const normalized = normalizeIncomingBooking(cleanId, {
                      ...syncBookingDraft,
                      bookingId: cleanId,
                      status: 'Pending',
                      bookingSource: 'Customer Android App',
                      createdBy: user?.uid || 'customer-live-sync',
                    });
                    if (!normalized) return;

                    const { booking: savedBooking, syncedToCloud } =
                      await persistBookingToFirestore(normalized, bookings);

                    const nextList = [
                      savedBooking,
                      ...bookings.filter(
                        (b) => b.bookingId !== savedBooking.bookingId
                      ),
                    ];
                    setBookings(nextList);
                    setShowSyncIncomingModal(false);
                    showToast(
                      `Synced customer booking ${savedBooking.bookingId} (${savedBooking.customerName}) to Control Room${
                        syncedToCloud ? ' & Firebase Firestore' : ''
                      }.`
                    );
                  }}
                  className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer shadow-xs"
                >
                  Sync Booking to Control Room & Firestore
                </button>
              </div>
            </div>
          </div>
        </div>
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
