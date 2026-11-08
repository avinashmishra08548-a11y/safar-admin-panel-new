import React, { useState, useMemo } from 'react';
import {
  Booking,
  BookingStatus,
  BookingSource,
  DetailedWorkflowStage,
  BookingAuditEntry,
  FleetDriver,
  FleetVehicle,
  SupportTicket,
  SupportTicketCategory,
  CmsPortalConfig,
  TariffPlan,
  formatINR,
  OFFICIAL_GSTIN,
  OFFICIAL_COMPANY_NAME,
  OFFICIAL_HELPLINE,
} from '../types/safar';
import {
  Plus,
  UserPlus,
  Car,
  Users,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  MapPin,
  Phone,
  MessageSquare,
  FileText,
  Download,
  Printer,
  ShieldCheck,
  X,
  Save,
  Headphones,
  Globe,
  Bell,
  BarChart3,
  RefreshCw,
  Calendar,
  Wallet,
  XCircle,
} from 'lucide-react';

/* ============================================================================
 * 1. EXECUTIVE DASHBOARD & LIVE OPERATIONS MONITOR
 * ========================================================================== */
interface ExecutiveDashboardProps {
  bookings: Booking[];
  drivers: FleetDriver[];
  vehicles: FleetVehicle[];
  tickets: SupportTicket[];
  tariffs: TariffPlan[];
  onOpenAddDriver: () => void;
  onSwitchModule: (module: string) => void;
  onSelectBookingForAssign: (booking: Booking) => void;
  onSelectBookingForDetails: (booking: Booking) => void;
}

export const ExecutiveDashboardOverview: React.FC<ExecutiveDashboardProps> = ({
  bookings,
  drivers,
  vehicles,
  tickets,
  onOpenAddDriver,
  onSwitchModule,
  onSelectBookingForAssign,
  onSelectBookingForDetails,
}) => {
  const [chartTimeframe, setChartTimeframe] = useState<
    'daily' | 'weekly' | 'monthly'
  >('weekly');

  const todayIso = new Date().toISOString().slice(0, 10);

  // All 14 Real-time Database Statistics
  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const todaysBookings = bookings.filter(
      (b) => b.pickupDate === todayIso
    ).length;
    const upcomingBookings = bookings.filter(
      (b) =>
        b.pickupDate >= todayIso &&
        b.status !== 'Completed' &&
        b.status !== 'Cancelled'
    ).length;
    const completedTrips = bookings.filter(
      (b) => b.status === 'Completed'
    ).length;
    const pendingRequests = bookings.filter(
      (b) => b.status === 'Pending'
    ).length;
    const cancelledBookings = bookings.filter(
      (b) => b.status === 'Cancelled'
    ).length;

    const activeDrivers = drivers.filter(
      (d) => d.dutyStatus !== 'Off Duty'
    ).length;
    const availableDrivers = drivers.filter(
      (d) => d.dutyStatus === 'Available'
    ).length;
    const driversOnTrip = drivers.filter(
      (d) => d.dutyStatus === 'On Trip'
    ).length;

    const uniqueCustomerPhones = new Set(
      bookings.map(
        (b) => b.customerPhone.replace(/\D/g, '').slice(-10) || b.bookingId
      )
    );
    const totalCustomers = uniqueCustomerPhones.size;

    const activeNonCancelled = bookings.filter((b) => b.status !== 'Cancelled');
    const totalRevenue = activeNonCancelled.reduce(
      (sum, b) => sum + b.totalFare,
      0
    );
    const todaysRevenue = activeNonCancelled
      .filter((b) => b.pickupDate === todayIso)
      .reduce((sum, b) => sum + b.totalFare, 0);
    const pendingPayments = activeNonCancelled.reduce(
      (sum, b) => sum + b.balanceAmount,
      0
    );
    const outstandingDriverPayouts = drivers.reduce(
      (sum, d) => sum + d.pendingPayout,
      0
    );

    return {
      totalBookings,
      todaysBookings,
      upcomingBookings,
      completedTrips,
      pendingRequests,
      cancelledBookings,
      activeDrivers,
      availableDrivers,
      driversOnTrip,
      totalCustomers,
      totalRevenue,
      todaysRevenue,
      pendingPayments,
      outstandingDriverPayouts,
    };
  }, [bookings, drivers, todayIso]);

  // Popular Routes & Vehicle Category Analytics from real bookings
  const analytics = useMemo(() => {
    const routeCounts = new Map<string, { count: number; revenue: number }>();
    const categoryCounts = new Map<string, number>();

    bookings.forEach((b) => {
      if (b.status !== 'Cancelled') {
        const routeKey = `${b.pickupCity} → ${b.dropCity}`;
        const prev = routeCounts.get(routeKey) || { count: 0, revenue: 0 };
        routeCounts.set(routeKey, {
          count: prev.count + 1,
          revenue: prev.revenue + b.totalFare,
        });
      }
      categoryCounts.set(
        b.vehicleCategory,
        (categoryCounts.get(b.vehicleCategory) || 0) + 1
      );
    });

    const topRoutes = Array.from(routeCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const categories = ['Hatchback', 'Sedan', 'SUV', 'Innova Crysta'].map(
      (cat) => ({
        name: cat,
        count: categoryCounts.get(cat) || 0,
        pct:
          bookings.length > 0
            ? Math.round(((categoryCounts.get(cat) || 0) / bookings.length) * 100)
            : 0,
      })
    );

    return { topRoutes, categories };
  }, [bookings]);

  // Live Operations Queues
  const unassignedBookings = bookings.filter(
    (b) =>
      b.status !== 'Cancelled' &&
      b.status !== 'Completed' &&
      (!b.driverName || !b.vehicleNumber)
  );
  const upcomingPickupsList = bookings
    .filter((b) => b.status !== 'Cancelled' && b.status !== 'Completed')
    .slice(0, 5);
  const activePaymentAlerts = bookings
    .filter((b) => b.status !== 'Cancelled' && b.balanceAmount > 0)
    .slice(0, 5);
  const openSupportTickets = tickets.filter((t) => t.status !== 'Resolved');

  return (
    <section className="space-y-5">
      {/* Header Banner — Explicitly confirming Admin-Managed Driver Network */}
      <div className="bg-gradient-to-r from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-display">
              SafarIndiaCabs Executive Operations & Live Dispatch Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
              100% Admin-Controlled Driver Network
            </span>
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
            Centralized command center for Customer App & Website bookings, manual/automated chauffeur assignment, fleet KYC, GST billing ({OFFICIAL_GSTIN}), and customer support.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (unassignedBookings[0]) {
                onSelectBookingForAssign(unassignedBookings[0]);
              } else if (bookings[0]) {
                onSelectBookingForAssign(bookings[0]);
              } else {
                onSwitchModule('control-room');
              }
            }}
            className="px-3.5 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Assign Driver</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddDriver}
            className="px-3 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Driver</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchModule('vehicle-fleet')}
            className="px-3 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Car className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Vehicle</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchModule('customers')}
            className="px-3 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customers</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchModule('tariff-engine')}
            className="px-3 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Fare Rules</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchModule('control-room')}
            className="px-3 py-2 text-xs font-extrabold text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({stats.pendingRequests})</span>
          </button>
        </div>
      </div>

      {/* 14 Real-Time Database Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: 'Total Bookings',
            val: stats.totalBookings,
            sub: `${stats.todaysBookings} Today`,
            accent: 'border-t-slate-900',
          },
          {
            label: 'Upcoming Trips',
            val: stats.upcomingBookings,
            sub: `${stats.pendingRequests} Pending Req`,
            accent: 'border-t-blue-600',
          },
          {
            label: 'Completed Trips',
            val: stats.completedTrips,
            sub: `${stats.cancelledBookings} Cancelled`,
            accent: 'border-t-emerald-600',
          },
          {
            label: 'Available Drivers',
            val: stats.availableDrivers,
            sub: `${stats.driversOnTrip} On Trip / ${stats.activeDrivers} Active`,
            accent: 'border-t-amber-500',
          },
          {
            label: 'Registered Customers',
            val: stats.totalCustomers,
            sub: `${vehicles.length} Fleet Vehicles`,
            accent: 'border-t-indigo-600',
          },
          {
            label: 'Total Revenue',
            val: formatINR(stats.totalRevenue),
            sub: `Today: ${formatINR(stats.todaysRevenue)}`,
            accent: 'border-t-emerald-700',
          },
          {
            label: 'Pending Payments',
            val: formatINR(stats.pendingPayments),
            sub: `Driver Due: ${formatINR(stats.outstandingDriverPayouts)}`,
            accent: 'border-t-red-600',
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 border-t-4 ${item.accent} rounded-xl p-3.5 shadow-xs`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {item.label}
            </div>
            <div className="text-lg sm:text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {item.val}
            </div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5 truncate">
              {item.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Analytics & Visual Distribution Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Booking Status & Revenue Distribution */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span>Booking Volume, Revenue Growth & Status Distribution</span>
              </h2>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Real-time breakdown connected directly to live SafarIndiaCabs database records
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
              {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChartTimeframe(t)}
                  className={`px-2.5 py-1 rounded-md font-extrabold capitalize cursor-pointer ${
                    chartTimeframe === t
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Status Bars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              {
                label: 'Pending Dispatch',
                count: stats.pendingRequests,
                color: 'bg-amber-500',
              },
              {
                label: 'Confirmed / Active',
                count: bookings.filter((b) => b.status === 'Confirmed').length,
                color: 'bg-blue-600',
              },
              {
                label: 'Completed Trips',
                count: stats.completedTrips,
                color: 'bg-emerald-600',
              },
              {
                label: 'Cancelled',
                count: stats.cancelledBookings,
                color: 'bg-red-500',
              },
            ].map((bar) => {
              const pct =
                stats.totalBookings > 0
                  ? Math.round((bar.count / stats.totalBookings) * 100)
                  : 0;
              return (
                <div
                  key={bar.label}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between font-extrabold text-slate-800 dark:text-slate-200">
                    <span>{bar.label}</span>
                    <span className="font-mono">{bar.count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bar.color}`}
                      style={{ width: `${Math.max(pct, bar.count > 0 ? 12 : 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono font-bold text-slate-500">
                    {pct}% of total bookings ({chartTimeframe})
                  </div>
                </div>
              );
            })}
          </div>

          {/* Popular Routes from Live Database */}
          <div className="pt-2 space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Top Outstation & Local Corridors
            </div>
            {analytics.topRoutes.length === 0 ? (
              <div className="text-xs font-bold text-slate-500 py-2">
                No completed routes recorded yet. Create a booking to see live corridor analytics.
              </div>
            ) : (
              <div className="space-y-1.5">
                {analytics.topRoutes.map(([route, info]) => (
                  <div
                    key={route}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      {route}
                    </span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {info.count} Trip(s) ·{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {formatINR(info.revenue)}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Popular Vehicle Categories & Fleet Utilization */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white font-display">
              Vehicle Category Demand & Fleet Utilization
            </h2>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Category share across Hatchback, Sedan, SUV & Innova Crysta
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {analytics.categories.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between font-extrabold text-slate-800 dark:text-slate-200">
                  <span>{c.name}</span>
                  <span className="font-mono">
                    {c.count} Bookings ({c.pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 dark:bg-amber-500 rounded-full"
                    style={{ width: `${Math.max(c.pct, c.count > 0 ? 10 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[11px] font-bold text-slate-500">
                Unassigned Bookings
              </div>
              <div className="text-lg font-mono font-extrabold text-amber-600 dark:text-amber-400">
                {unassignedBookings.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">
                Open Support Tickets
              </div>
              <div className="text-lg font-mono font-extrabold text-slate-900 dark:text-white">
                {openSupportTickets.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Operations Panel (Upcoming Pickups, Unassigned Confirmed Bookings, Active Drivers, Payment & Support Alerts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Panel 1: Upcoming Pickups & Unassigned Bookings */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Upcoming Pickups & Unassigned Queue</span>
            </h3>
            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
              {upcomingPickupsList.length}
            </span>
          </div>

          {upcomingPickupsList.length === 0 ? (
            <p className="text-xs font-bold text-slate-500 py-4 text-center">
              All scheduled pickups are clear.
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingPickupsList.map((b) => (
                <div
                  key={b.bookingId}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 dark:text-white truncate">
                      {b.bookingId} · {b.customerName}
                    </div>
                    <div className="font-bold text-slate-600 dark:text-slate-400 truncate">
                      {b.pickupCity} → {b.dropCity} ({b.pickupDate})
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectBookingForAssign(b)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-extrabold text-[11px] cursor-pointer"
                    >
                      {b.driverName ? 'Reassign' : 'Assign'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectBookingForDetails(b)}
                      className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 2: Chauffeurs Currently On Trip / Available */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Car className="w-4 h-4 text-emerald-600" />
              <span>Active Chauffeurs & Duty Dispatch</span>
            </h3>
            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
              {drivers.length}
            </span>
          </div>

          {drivers.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs font-bold text-slate-500">
                No chauffeurs onboarded yet.
              </p>
              <button
                type="button"
                onClick={onOpenAddDriver}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-extrabold cursor-pointer"
              >
                + Appoint Chauffeur
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {drivers.slice(0, 5).map((d) => (
                <div
                  key={d.driverId}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      {d.driverName} ({d.vehicleNumber})
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {d.vehicleCategory} · {d.homeBaseCity} · {d.dutyStatus}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${d.driverPhone.replace(/\D/g, '')}`}
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      title="Call Chauffeur"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${d.driverPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-600 text-white"
                      title="WhatsApp Chauffeur"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 3: Payment Collections & Support Escalations */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Payment & Support Alerts</span>
            </h3>
            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-red-100 text-red-900">
              {activePaymentAlerts.length + openSupportTickets.length}
            </span>
          </div>

          {activePaymentAlerts.length === 0 && openSupportTickets.length === 0 ? (
            <p className="text-xs font-bold text-slate-500 py-4 text-center">
              Zero pending payment alerts or escalations.
            </p>
          ) : (
            <div className="space-y-2">
              {activePaymentAlerts.map((b) => (
                <div
                  key={b.bookingId}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      {b.bookingId} · Collect {formatINR(b.balanceAmount)}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">
                      Customer: {b.customerName} ({b.customerPhone})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectBookingForDetails(b)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px] cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

/* ============================================================================
 * 2. BOOKING DETAILS, 9-STAGE WORKFLOW, FARE MODIFY, RESCHEDULE & AUDIT MODAL
 * ========================================================================== */
interface BookingDetailModalProps {
  booking: Booking;
  onClose: () => void;
  onSaveUpdatedBooking: (updated: Booking) => Promise<void>;
  onOpenAssignDriver: (booking: Booking) => void;
  onOpenInvoice: (booking: Booking) => void;
}

const WORKFLOW_STAGES: DetailedWorkflowStage[] = [
  'Requested',
  'Under Review',
  'Fare Confirmed',
  'Confirmed',
  'Driver Assigned',
  'Driver Accepted',
  'Driver Reached Pickup',
  'Trip Started',
  'Trip Completed',
  'Customer Cancelled',
  'Admin Cancelled',
  'Driver Unavailable',
  'Payment Pending',
  'Refund Processing',
  'Refunded',
];

export const BookingDetailAndWorkflowModal: React.FC<BookingDetailModalProps> = ({
  booking,
  onClose,
  onSaveUpdatedBooking,
  onOpenAssignDriver,
  onOpenInvoice,
}) => {
  const [workflowStage, setWorkflowStage] = useState<DetailedWorkflowStage>(
    booking.workflowStage ||
      (booking.status === 'Completed'
        ? 'Trip Completed'
        : booking.status === 'Cancelled'
        ? 'Admin Cancelled'
        : booking.driverName
        ? 'Driver Assigned'
        : 'Confirmed')
  );
  const [bookingSource, setBookingSource] = useState<BookingSource>(
    booking.bookingSource || 'Admin Created Booking'
  );
  const [pickupDate, setPickupDate] = useState(booking.pickupDate);
  const [pickupTime, setPickupTime] = useState(booking.pickupTime);
  const [tripDays, setTripDays] = useState(booking.tripDays || 1);
  const [sameDayReturn, setSameDayReturn] = useState(
    booking.sameDayReturn !== undefined
      ? booking.sameDayReturn
      : (booking.tripDays || 1) === 1
  );
  const [baseFare, setBaseFare] = useState(booking.baseFare);
  const [driverAllowance, setDriverAllowance] = useState(booking.driverAllowance);
  const [tollTax, setTollTax] = useState(booking.tollTax || 0);
  const [stateTax, setStateTax] = useState(booking.stateTax);
  const [marketDiscount, setMarketDiscount] = useState(booking.marketDiscount);
  const [advancePaid, setAdvancePaid] = useState(booking.advancePaid);
  const [specialInstructions, setSpecialInstructions] = useState(
    booking.specialInstructions || ''
  );
  const [internalNotes, setInternalNotes] = useState(
    booking.internalNotes || ''
  );
  const [refundStatus, setRefundStatus] = useState<
    'None' | 'Refund Processing' | 'Refunded'
  >(booking.refundStatus || 'None');
  const [refundAmount, setRefundAmount] = useState(booking.refundAmount || 0);
  const [saving, setSaving] = useState(false);

  const taxable = Math.max(
    0,
    baseFare +
      driverAllowance +
      tollTax +
      stateTax +
      booking.nightCharges -
      marketDiscount
  );
  const gstAmount = Math.round(taxable * 0.05);
  const totalFare = taxable + gstAmount;
  const balanceAmount = Math.max(0, totalFare - advancePaid);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let coreStatus: BookingStatus = booking.status;
      if (workflowStage === 'Trip Completed') {
        coreStatus = 'Completed';
      } else if (
        workflowStage === 'Customer Cancelled' ||
        workflowStage === 'Admin Cancelled'
      ) {
        coreStatus = 'Cancelled';
      } else if (
        workflowStage === 'Requested' ||
        workflowStage === 'Under Review' ||
        workflowStage === 'Payment Pending'
      ) {
        coreStatus = 'Pending';
      } else {
        coreStatus = 'Confirmed';
      }

      const newEntry: BookingAuditEntry = {
        timestamp: new Date().toLocaleString('en-IN'),
        actor: 'Owner / Dispatch Admin',
        stage: workflowStage,
        note: `Updated stage to ${workflowStage} · Total Fare ${formatINR(totalFare)} · Pickup ${pickupDate} ${pickupTime} · ${tripDays} Day(s)`,
      };

      const updated: Booking = {
        ...booking,
        pickupDate,
        pickupTime,
        tripDays,
        sameDayReturn,
        baseFare,
        driverAllowance,
        tollTax,
        stateTax,
        marketDiscount,
        gstAmount,
        totalFare,
        advancePaid,
        balanceAmount,
        status: coreStatus,
        workflowStage,
        bookingSource,
        specialInstructions,
        internalNotes,
        refundStatus,
        refundAmount,
        invoiceReady: coreStatus === 'Completed' ? true : booking.invoiceReady,
        auditHistory: [newEntry, ...(booking.auditHistory || [])].slice(0, 15),
      };

      await onSaveUpdatedBooking(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-6">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-display">
              Booking Command & Lifecycle Audit · {booking.bookingId}
            </h2>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Modify Itemized Fare Breakup, Reschedule Pickup, Set Same-Day / Multi-Day Duration & Track Dispatch Workflow
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs"
        >
          {/* Workflow Stepper & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800">
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Detailed Dispatch Workflow Stage
              </label>
              <select
                value={workflowStage}
                onChange={(e) =>
                  setWorkflowStage(e.target.value as DetailedWorkflowStage)
                }
                className="w-full px-3 py-2 font-extrabold bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl text-slate-900 dark:text-white"
              >
                {WORKFLOW_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Booking Source Channel
              </label>
              <select
                value={bookingSource}
                onChange={(e) =>
                  setBookingSource(e.target.value as BookingSource)
                }
                className="w-full px-3 py-2 font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="Customer Android App">Customer Android App</option>
                <option value="Website">Website (safarindiacabs.com)</option>
                <option value="Admin Created Booking">Admin Created Booking</option>
                <option value="Customer Support Created Booking">
                  Customer Support Created Booking
                </option>
                <option value="Corporate Booking">Corporate B2B Booking</option>
              </select>
            </div>

            <div className="flex flex-col justify-end gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAssignDriver(booking)}
                  className="flex-1 py-2 px-3 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-xl font-extrabold cursor-pointer"
                >
                  {booking.driverName ? 'Change Chauffeur' : 'Assign Chauffeur'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInvoice(booking)}
                  className="py-2 px-3 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-extrabold cursor-pointer"
                >
                  GST Invoice
                </button>
              </div>
            </div>
          </div>

          {/* Reschedule & Itemized Fare Breakup Modification */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Reschedule Pickup Date
              </label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Reschedule Pickup Time
              </label>
              <input
                type="text"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Trip Days (Same Day = 1)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTripDays(1);
                    setSameDayReturn(true);
                  }}
                  className={`px-2.5 py-2 rounded-xl font-extrabold cursor-pointer border ${
                    tripDays === 1 && sameDayReturn
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Same Day (1d)
                </button>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={tripDays}
                  onChange={(e) => {
                    const d = Math.max(1, Number(e.target.value) || 1);
                    setTripDays(d);
                    setSameDayReturn(d === 1);
                  }}
                  className="w-full px-2.5 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                1. Base Cab Fare (INR)
              </label>
              <input
                type="number"
                value={baseFare}
                onChange={(e) => setBaseFare(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                2. Driver Allowance / Bata (INR)
              </label>
              <input
                type="number"
                value={driverAllowance}
                onChange={(e) => setDriverAllowance(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                3. Highway Toll Tax (INR)
              </label>
              <input
                type="number"
                value={tollTax}
                onChange={(e) => setTollTax(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                4. State Permit Tax (INR)
              </label>
              <input
                type="number"
                value={stateTax}
                onChange={(e) => setStateTax(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                5. Discount Rebate (INR)
              </label>
              <input
                type="number"
                value={marketDiscount}
                onChange={(e) => setMarketDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Advance Received (INR)
              </label>
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="sm:col-span-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Itemized Breakup: Base {formatINR(baseFare)} + Driver Bata {formatINR(driverAllowance)} + Highway Toll {formatINR(tollTax)} + State Tax {formatINR(stateTax)} − Disc {formatINR(marketDiscount)} + 5% GST ({formatINR(gstAmount)})
              </div>
              <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                Total: {formatINR(totalFare)} (Bal: {formatINR(balanceAmount)})
              </div>
            </div>
          </div>

          {/* Notes & Refund Management */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Special Customer Instructions (Luggage / Carrier / Pet / Child Seat)
              </label>
              <input
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Roof carrier required, terminal 3 gate 4 pickup"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Internal Admin Dispatch Notes
              </label>
              <input
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="e.g. Verified corporate booking by Aman Mishra"
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Refund Initiation & Status
              </label>
              <select
                value={refundStatus}
                onChange={(e) =>
                  setRefundStatus(
                    e.target.value as 'None' | 'Refund Processing' | 'Refunded'
                  )
                }
                className="w-full px-3 py-1.5 font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="None">No Refund Requested</option>
                <option value="Refund Processing">Refund Processing</option>
                <option value="Refunded">Refund Completed</option>
              </select>
            </div>
            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                Refund Amount (INR)
              </label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="w-full px-3 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {/* Audit History Log */}
          {booking.auditHistory && booking.auditHistory.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-extrabold text-slate-700 dark:text-slate-300">
                Booking Audit Trail
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 max-h-32 overflow-y-auto">
                {booking.auditHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] font-mono"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      [{item.stage}] {item.note}
                    </span>
                    <span className="text-slate-500">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Booking Updates'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. CENTRALIZED VEHICLE & FLEET MANAGEMENT MODULE
 * ========================================================================== */
interface VehicleFleetModuleProps {
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  onSaveVehicles: (next: FleetVehicle[]) => void;
  onShowToast: (msg: string) => void;
}

export const VehicleFleetManagementModule: React.FC<VehicleFleetModuleProps> = ({
  vehicles,
  drivers,
  onSaveVehicles,
  onShowToast,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [makeModel, setMakeModel] = useState('Toyota Innova Crysta 2.4 GX');
  const [category, setCategory] =
    useState<FleetVehicle['category']>('Innova Crysta');
  const [seating, setSeating] = useState(7);
  const [acType, setAcType] = useState<'AC' | 'Non-AC'>('AC');
  const [fuelType, setFuelType] =
    useState<FleetVehicle['fuelType']>('Diesel');
  const [permitType, setPermitType] = useState<FleetVehicle['permitType']>(
    'All-India Tourist Permit (AITP)'
  );
  const [insuranceExpiry, setInsuranceExpiry] = useState('2027-06-30');
  const [fitnessExpiry, setFitnessExpiry] = useState('2027-12-31');
  const [pucExpiry, setPucExpiry] = useState('2027-03-31');
  const [assignedDriverName, setAssignedDriverName] = useState('');
  const [assignedDriverPhone, setAssignedDriverPhone] = useState('');
  const [ownerVendorName, setOwnerVendorName] = useState('SafarIndiaCabs Own Fleet');

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) return;
    const newVeh: FleetVehicle = {
      vehicleId: `VEH${101 + vehicles.length}`,
      registrationNumber: regNo.trim().toUpperCase(),
      makeAndModel: makeModel.trim(),
      category,
      seatingCapacity: seating,
      acType,
      fuelType,
      permitType,
      insuranceExpiry,
      fitnessExpiry,
      pucExpiry,
      assignedDriverName: assignedDriverName.trim() || 'Unassigned',
      assignedDriverPhone: assignedDriverPhone.trim() || '—',
      ownerVendorName: ownerVendorName.trim() || 'SafarIndiaCabs Own Fleet',
      availabilityStatus: 'Available',
      lastMaintenanceDate: new Date().toISOString().slice(0, 10),
    };
    onSaveVehicles([newVeh, ...vehicles]);
    setRegNo('');
    setShowAddModal(false);
    onShowToast(
      `Added commercial vehicle ${newVeh.registrationNumber} (${newVeh.category}) to Fleet Registry.`
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
            Centralized Vehicle & Commercial Fleet Management
          </h1>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
            Track commercial registration, All-India Tourist Permits, Insurance/Fitness/PUC expiry alerts, and chauffeur/vendor assignments
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Add Commercial Vehicle</span>
        </button>
      </div>

      {showAddModal && (
        <form
          onSubmit={handleAddVehicle}
          className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl p-5 space-y-4 text-xs shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
              Register Commercial Vehicle into SafarIndiaCabs Fleet
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="block font-extrabold mb-1">
                Registration Plate *
              </label>
              <input
                type="text"
                required
                value={regNo}
                onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                placeholder="DL 01 CAB 4401"
                className="w-full px-3 py-2 font-mono font-extrabold uppercase bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Vehicle Category
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as FleetVehicle['category'])
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Ertiga / 6 Seater">Ertiga / 6 Seater</option>
                <option value="Innova">Innova</option>
                <option value="Innova Crysta">Innova Crysta</option>
                <option value="Tempo Traveller">Tempo Traveller</option>
                <option value="Luxury Vehicles">Luxury Vehicles</option>
              </select>
            </div>
            <div>
              <label className="block font-extrabold mb-1">Make & Model *</label>
              <input
                type="text"
                required
                value={makeModel}
                onChange={(e) => setMakeModel(e.target.value)}
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Fuel & AC Config
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={fuelType}
                  onChange={(e) =>
                    setFuelType(e.target.value as FleetVehicle['fuelType'])
                  }
                  className="px-2 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="CNG">CNG</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Electric">Electric</option>
                </select>
                <select
                  value={acType}
                  onChange={(e) =>
                    setAcType(e.target.value as 'AC' | 'Non-AC')
                  }
                  className="px-2 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Insurance Expiry
              </label>
              <input
                type="date"
                value={insuranceExpiry}
                onChange={(e) => setInsuranceExpiry(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Fitness Cert Expiry
              </label>
              <input
                type="date"
                value={fitnessExpiry}
                onChange={(e) => setFitnessExpiry(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">PUC Expiry</label>
              <input
                type="date"
                value={pucExpiry}
                onChange={(e) => setPucExpiry(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Owner / Vendor Name
              </label>
              <input
                type="text"
                value={ownerVendorName}
                onChange={(e) => setOwnerVendorName(e.target.value)}
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl cursor-pointer"
            >
              Save Commercial Vehicle
            </button>
          </div>
        </form>
      )}

      {vehicles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <Car className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            No sample vehicles — Commercial Fleet Registry is ready for your real vehicles
          </div>
          <p className="text-xs font-medium text-slate-500 max-w-md mx-auto">
            Add your Hatchback, Sedan, SUV, Ertiga, Innova Crysta, or Tempo Traveller vehicles to monitor permits, insurance, fitness, and PUC dates.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl cursor-pointer"
          >
            + Add First Commercial Vehicle
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-slate-200/90 via-slate-100 to-slate-200/90 dark:from-slate-900 dark:to-slate-900 text-slate-900 dark:text-white border-b-2 border-slate-300 dark:border-slate-800">
                  <th className="py-3.5 px-4 text-left font-extrabold">
                    Reg. Plate & Model
                  </th>
                  <th className="py-3.5 px-4 text-left font-extrabold">
                    Category, Fuel & Permit
                  </th>
                  <th className="py-3.5 px-4 text-left font-extrabold">
                    Insurance, Fitness & PUC
                  </th>
                  <th className="py-3.5 px-4 text-left font-extrabold">
                    Owner / Vendor
                  </th>
                  <th className="py-3.5 px-4 text-right font-extrabold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {vehicles.map((v) => (
                  <tr key={v.vehicleId}>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                        {v.registrationNumber}
                      </div>
                      <div className="font-bold text-slate-600 dark:text-slate-400">
                        {v.makeAndModel} ({v.seatingCapacity}+1 {v.acType})
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-amber-700 dark:text-amber-400">
                        {v.category} · {v.fuelType}
                      </div>
                      <div className="font-bold text-slate-500">
                        {v.permitType}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div>Ins: {v.insuranceExpiry}</div>
                      <div>
                        Fit: {v.fitnessExpiry} · PUC: {v.pucExpiry}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      {v.ownerVendorName}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onSaveVehicles(
                            vehicles.filter((x) => x.vehicleId !== v.vehicleId)
                          )
                        }
                        className="text-red-600 font-extrabold hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

/* ============================================================================
 * 4. CUSTOMER SUPPORT, COMPLAINTS & REFUND DESK
 * ========================================================================== */
interface SupportDeskProps {
  tickets: SupportTicket[];
  bookings: Booking[];
  onSaveTickets: (next: SupportTicket[]) => void;
  onShowToast: (msg: string) => void;
}

export const SupportAndComplaintsModule: React.FC<SupportDeskProps> = ({
  tickets,
  bookings,
  onSaveTickets,
  onShowToast,
}) => {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [bookingId, setBookingId] = useState(bookings[0]?.bookingId || 'SIC2607');
  const [customerName, setCustomerName] = useState(
    bookings[0]?.customerName || ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    bookings[0]?.customerPhone || '+91 '
  );
  const [category, setCategory] =
    useState<SupportTicketCategory>('Booking Related');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [subject, setSubject] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [refundRequestedAmount, setRefundRequestedAmount] = useState(0);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const created: SupportTicket = {
      ticketId: `TKT-${1001 + tickets.length}`,
      bookingId: bookingId.trim() || 'GENERAL',
      customerName: customerName.trim() || 'Traveller',
      customerPhone: customerPhone.trim() || '+91 7710080992',
      category,
      priority,
      status: 'Open',
      assignedAgent: 'Aman Mishra (Escalation Desk)',
      subject: subject.trim() || 'Customer Support Inquiry',
      internalNotes: internalNotes.trim(),
      refundRequestedAmount,
      createdAt: new Date().toLocaleString('en-IN'),
    };
    onSaveTickets([created, ...tickets]);
    setSubject('');
    setShowNewTicket(false);
    onShowToast(`Created Support Ticket ${created.ticketId}.`);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
            Customer Support, Complaints & Refund Escalation Desk
          </h1>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
            Manage Booking, Driver, Payment, Lost & Found, and Refund tickets with direct WhatsApp & Call resolution
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewTicket(true)}
          className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Create Support Ticket</span>
        </button>
      </div>

      {showNewTicket && (
        <form
          onSubmit={handleCreateTicket}
          className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl p-5 space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="block font-extrabold mb-1">Booking ID</label>
              <input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">Customer Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Customer Mobile
              </label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as SupportTicketCategory)
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="Booking Related">Booking Related</option>
                <option value="Driver Related">Driver Related</option>
                <option value="Payment Related">Payment Related</option>
                <option value="Refund Related">Refund Related</option>
                <option value="Lost and Found">Lost and Found</option>
                <option value="Trip Experience">Trip Experience</option>
                <option value="Cancellation">Cancellation</option>
                <option value="Other Issues">Other Issues</option>
              </select>
            </div>
            <div>
              <label className="block font-extrabold mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'High' | 'Medium' | 'Low')
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-extrabold mb-1">
                Issue Summary *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Describe customer support issue or refund request..."
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">
                Refund Claim (INR)
              </label>
              <input
                type="number"
                value={refundRequestedAmount}
                onChange={(e) =>
                  setRefundRequestedAmount(Number(e.target.value))
                }
                className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewTicket(false)}
              className="px-4 py-2 bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl cursor-pointer"
            >
              Save Support Ticket
            </button>
          </div>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
          <Headphones className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            No Open Customer Complaints or Support Tickets
          </div>
          <p className="text-xs text-slate-500">
            Log any customer call, refund request, or lost-and-found report using the button above.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-200/90 via-slate-100 to-slate-200/90 dark:from-slate-900 dark:to-slate-900 border-b-2 border-slate-300 dark:border-slate-800">
                <th className="py-3.5 px-4 text-left font-extrabold">
                  Ticket & Booking
                </th>
                <th className="py-3.5 px-4 text-left font-extrabold">
                  Customer
                </th>
                <th className="py-3.5 px-4 text-left font-extrabold">
                  Category & Subject
                </th>
                <th className="py-3.5 px-4 text-left font-extrabold">
                  Status & Priority
                </th>
                <th className="py-3.5 px-4 text-right font-extrabold">
                  Resolution Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {tickets.map((t) => (
                <tr key={t.ticketId}>
                  <td className="py-3.5 px-4 font-mono">
                    <div className="font-extrabold">{t.ticketId}</div>
                    <div className="text-slate-500">Ref: {t.bookingId}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold">{t.customerName}</div>
                    <div className="font-mono text-slate-500">
                      {t.customerPhone}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-amber-700">
                      {t.category}
                    </div>
                    <div className="font-bold">{t.subject}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold">
                      {t.status} · {t.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {t.status !== 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveTickets(
                            tickets.map((x) =>
                              x.ticketId === t.ticketId
                                ? { ...x, status: 'Resolved' }
                                : x
                            )
                          );
                          onShowToast(`Resolved ticket ${t.ticketId}.`);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-extrabold cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    )}
                    <a
                      href={`https://wa.me/${t.customerPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-900 text-white rounded-lg font-extrabold inline-block"
                    >
                      WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ============================================================================
 * 5. WEBSITE & CUSTOMER APP CMS + NOTIFICATION TEMPLATES
 * ========================================================================== */
const DEFAULT_CMS_CONFIG: CmsPortalConfig = {
  heroHeadline:
    'SafarIndiaCabs — Reliable Outstation, One-Way, Round-Trip & Airport Taxis Across North India',
  promoBannerText:
    'Flat ₹200 Instant Market Discount on Outstation Sedan, SUV & Innova Crysta Bookings!',
  promoCode: 'SAFAR200',
  promoDiscountInr: 200,
  minimumAndroidAppVersion: '2.6.0',
  maintenanceMode: false,
  bookingAvailabilityOnline: true,
  serviceableCities:
    'New Delhi, NCR, Gurgaon, Noida, Ghaziabad, Faridabad, Chandigarh, Jaipur, Agra, Dehradun, Haridwar, Rishikesh, Shimla, Manali, Amritsar, Ludhiana, Ambala, Mathura, Vrindavan, Udaipur, Lucknow',
  popularRoutesList:
    'Delhi to Agra | Delhi to Jaipur | Delhi to Chandigarh | Delhi to Dehradun & Rishikesh | Delhi to Shimla & Manali | Delhi to Haridwar | Delhi IGI Airport T3 Transfers',
  cancellationPolicySummary:
    'Free cancellation up to 6 hours before scheduled pickup time. 20% advance is refundable for cancelled unallotted rides.',
  termsAndConditionsSummary:
    'All outstation duties are billed as per minimum KM/day rules, actual highway Fastag toll, and state commercial entry permits under GSTIN 07DQHPA3025F1ZD.',
  whatsappBookingConfirmTemplate:
    'Namaste {{customer_name}}, your SafarIndiaCabs booking {{booking_id}} ({{pickup_city}} to {{drop_city}} on {{pickup_date}}) is CONFIRMED. Total Fare: {{total_fare}}.',
  whatsappDriverAssignedTemplate:
    'Chauffeur Assigned for {{booking_id}}: {{driver_name}} ({{driver_phone}}), Cab: {{vehicle_number}} ({{vehicle_model}}). Helpline: +91 7710080992.',
  smsOtpAndAlertTemplate:
    'SafarIndiaCabs Alert: Booking {{booking_id}} confirmed for {{pickup_date}}. Chauffeur {{driver_name}} ({{vehicle_number}}) allotted. Call +917710080992.',
};

export const WebsiteAppCmsAndNotificationsModule: React.FC<{
  onShowToast: (msg: string) => void;
}> = ({ onShowToast }) => {
  const [cms, setCms] = useState<CmsPortalConfig>(() => {
    try {
      const saved = localStorage.getItem('safar_cms_portal_config');
      if (saved) return { ...DEFAULT_CMS_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_CMS_CONFIG;
  });

  const handleSaveCms = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('safar_cms_portal_config', JSON.stringify(cms));
    onShowToast(
      'Published Website, Customer Android App CMS & Notification Templates.'
    );
  };

  return (
    <section className="space-y-5">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
            Website, Customer Android App CMS & Notification Templates
          </h1>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
            Control Homepage Banners, Promotional Offers, Serviceable Cities, App Maintenance Mode & Automated WhatsApp/SMS/Push Templates
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveCms}
          className="px-4 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Publish CMS & App Config</span>
        </button>
      </div>

      <form
        onSubmit={handleSaveCms}
        className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs"
      >
        {/* Left: Website & Android App CMS */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-500" />
            <span>Customer Website & Android App Content</span>
          </h2>

          <div>
            <label className="block font-extrabold mb-1">
              Homepage Hero Headline
            </label>
            <input
              type="text"
              value={cms.heroHeadline}
              onChange={(e) =>
                setCms({ ...cms, heroHeadline: e.target.value })
              }
              className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-extrabold mb-1">
                Promotional Offer Banner
              </label>
              <input
                type="text"
                value={cms.promoBannerText}
                onChange={(e) =>
                  setCms({ ...cms, promoBannerText: e.target.value })
                }
                className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-extrabold mb-1">Promo Code</label>
              <input
                type="text"
                value={cms.promoCode}
                onChange={(e) =>
                  setCms({ ...cms, promoCode: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 font-mono font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-extrabold mb-1">
              Serviceable Cities & Outstation Hubs
            </label>
            <textarea
              rows={2}
              value={cms.serviceableCities}
              onChange={(e) =>
                setCms({ ...cms, serviceableCities: e.target.value })
              }
              className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-extrabold mb-1">
              Popular Featured Routes
            </label>
            <textarea
              rows={2}
              value={cms.popularRoutesList}
              onChange={(e) =>
                setCms({ ...cms, popularRoutesList: e.target.value })
              }
              className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block font-extrabold mb-1">
                Min Android App Version
              </label>
              <input
                type="text"
                value={cms.minimumAndroidAppVersion}
                onChange={(e) =>
                  setCms({ ...cms, minimumAndroidAppVersion: e.target.value })
                }
                className="w-full px-3 py-1.5 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 font-extrabold pt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={cms.bookingAvailabilityOnline}
                onChange={(e) =>
                  setCms({
                    ...cms,
                    bookingAvailabilityOnline: e.target.checked,
                  })
                }
                className="rounded accent-emerald-600"
              />
              <span>Online Booking Open</span>
            </label>
            <label className="flex items-center gap-2 font-extrabold pt-4 text-red-600 cursor-pointer">
              <input
                type="checkbox"
                checked={cms.maintenanceMode}
                onChange={(e) =>
                  setCms({ ...cms, maintenanceMode: e.target.checked })
                }
                className="rounded accent-red-600"
              />
              <span>Maintenance Mode</span>
            </label>
          </div>
        </div>

        {/* Right: Notification Templates & Policies */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Notification Templates (WhatsApp / SMS / Push / Email) & Policies</span>
          </h2>

          <div>
            <label className="block font-extrabold mb-1">
              WhatsApp Booking Confirmation Template
            </label>
            <textarea
              rows={2}
              value={cms.whatsappBookingConfirmTemplate}
              onChange={(e) =>
                setCms({
                  ...cms,
                  whatsappBookingConfirmTemplate: e.target.value,
                })
              }
              className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-extrabold mb-1">
              WhatsApp Chauffeur & Vehicle Assigned Template
            </label>
            <textarea
              rows={2}
              value={cms.whatsappDriverAssignedTemplate}
              onChange={(e) =>
                setCms({
                  ...cms,
                  whatsappDriverAssignedTemplate: e.target.value,
                })
              }
              className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-extrabold mb-1">
              SMS DLT Alert Template
            </label>
            <textarea
              rows={2}
              value={cms.smsOtpAndAlertTemplate}
              onChange={(e) =>
                setCms({ ...cms, smsOtpAndAlertTemplate: e.target.value })
              }
              className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-extrabold mb-1">
              Cancellation & Refund Policy
            </label>
            <textarea
              rows={2}
              value={cms.cancellationPolicySummary}
              onChange={(e) =>
                setCms({ ...cms, cancellationPolicySummary: e.target.value })
              }
              className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>
      </form>
    </section>
  );
};

/* ============================================================================
 * 6. DOWNLOADABLE BUSINESS REPORTS & ANALYTICS CENTER
 * ========================================================================== */
export const BusinessReportsAndAnalyticsModule: React.FC<{
  bookings: Booking[];
  drivers: FleetDriver[];
  vehicles: FleetVehicle[];
  onExportBookingsCsv: () => void;
  onShowToast: (msg: string) => void;
}> = ({ bookings, drivers, vehicles, onExportBookingsCsv, onShowToast }) => {
  const [reportType, setReportType] = useState<string>('Booking Report');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const afterStart = !startDate || b.pickupDate >= startDate;
      const beforeEnd = !endDate || b.pickupDate <= endDate;
      const matchSt = statusFilter === 'All' || b.status === statusFilter;
      return afterStart && beforeEnd && matchSt;
    });
  }, [bookings, startDate, endDate, statusFilter]);

  const summary = useMemo(() => {
    const gross = filteredBookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.totalFare, 0);
    const gst = filteredBookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.gstAmount, 0);
    const advance = filteredBookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.advancePaid, 0);
    const balance = filteredBookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.balanceAmount, 0);
    return { gross, gst, advance, balance };
  }, [filteredBookings]);

  return (
    <section className="space-y-5">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
            Business Reports, Finance & GST Tax Analytics Center
          </h1>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
            Generate Booking, Revenue, Chauffeur Performance, Vehicle Utilization, Cancellation, and SAC 996412 GST Tax Reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportBookingsCsv}
            className="px-3.5 py-2 text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV / Excel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              window.print();
              onShowToast(`Prepared ${reportType} for PDF printing.`);
            }}
            className="px-3.5 py-2 text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF Report</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector & Filters */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3.5 text-xs">
        <div>
          <label className="block font-extrabold mb-1">Report Category</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full px-3 py-2 font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
          >
            <option value="Booking Report">Booking Report</option>
            <option value="Revenue Report">Revenue & P&L Report</option>
            <option value="Driver Performance Report">
              Driver Performance Report
            </option>
            <option value="Vehicle Utilization Report">
              Vehicle Utilization Report
            </option>
            <option value="Customer Report">Customer CRM Report</option>
            <option value="Cancellation Report">Cancellation Report</option>
            <option value="Payment Report">Payment Reconciliation Report</option>
            <option value="Route Performance Report">
              Route Performance Report
            </option>
            <option value="Tax Report">GST Tax Register ({OFFICIAL_GSTIN})</option>
          </select>
        </div>
        <div>
          <label className="block font-extrabold mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
          />
        </div>
        <div>
          <label className="block font-extrabold mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
          />
        </div>
        <div>
          <label className="block font-extrabold mb-1">Booking Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4">
          <div className="font-bold text-slate-500">Filtered Gross Revenue</div>
          <div className="text-xl font-mono font-extrabold mt-1">
            {formatINR(summary.gross)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4">
          <div className="font-bold text-slate-500">5% GST Collected</div>
          <div className="text-xl font-mono font-extrabold text-amber-600 mt-1">
            {formatINR(summary.gst)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4">
          <div className="font-bold text-slate-500">Advance Settled</div>
          <div className="text-xl font-mono font-extrabold text-emerald-700 mt-1">
            {formatINR(summary.advance)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4">
          <div className="font-bold text-slate-500">Collectible Balance</div>
          <div className="text-xl font-mono font-extrabold text-blue-700 mt-1">
            {formatINR(summary.balance)}
          </div>
        </div>
      </div>
    </section>
  );
};
