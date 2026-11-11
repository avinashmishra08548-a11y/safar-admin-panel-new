import { Timestamp } from 'firebase/firestore';

export type VehicleCategory = 'Hatchback' | 'Sedan' | 'SUV' | 'Innova Crysta';
export type TariffCategoryId = 'hatchback' | 'sedan' | 'suv' | 'innova_crysta';
export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Active'
  | 'Completed'
  | 'Cancelled';
export type TripType =
  | 'Round Trip Outstation'
  | 'One Way Outstation'
  | 'Local 8Hr/80Km'
  | 'Airport Transfer';
export type PaymentMode = '20% Advance' | 'Full Paid';
export type DriverDutyStatus = 'Available' | 'On Trip' | 'Off Duty';
export type DriverKycStatus = 'Verified' | 'Pending Review' | 'Expiring Soon';

export type BookingSource =
  | 'Customer Android App'
  | 'Website'
  | 'Admin Created Booking'
  | 'Customer Support Created Booking'
  | 'Corporate Booking';

export type DetailedWorkflowStage =
  | 'Requested'
  | 'Under Review'
  | 'Fare Confirmed'
  | 'Confirmed'
  | 'Driver Assigned'
  | 'Driver Accepted'
  | 'Driver Reached Pickup'
  | 'Trip Started'
  | 'Trip Completed'
  | 'Customer Cancelled'
  | 'Admin Cancelled'
  | 'Driver Unavailable'
  | 'Payment Pending'
  | 'Refund Processing'
  | 'Refunded';

export interface BookingAuditEntry {
  timestamp: string;
  actor: string;
  stage: string;
  note: string;
}

export interface Booking {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  tripType: TripType;
  pickupCity: string;
  dropCity: string;
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string;
  returnDate?: string;
  returnTime?: string;
  sameDayReturn?: boolean;
  vehicleCategory: VehicleCategory;
  distanceKm: number;
  tripDays: number;
  perKmRate: number;
  baseFare: number;
  driverAllowance: number;
  tollTax?: number;
  stateTax: number;
  nightCharges: number;
  marketDiscount: number;
  gstAmount: number;
  totalFare: number;
  paymentMode: PaymentMode;
  advancePaid: number;
  balanceAmount: number;
  status: BookingStatus;
  workflowStage?: DetailedWorkflowStage;
  bookingSource?: BookingSource;
  specialInstructions?: string;
  internalNotes?: string;
  refundStatus?: 'None' | 'Refund Processing' | 'Refunded';
  refundAmount?: number;
  auditHistory?: BookingAuditEntry[];
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  vehicleModel: string;
  invoiceNumber: string;
  invoiceReady: boolean;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  firestoreDocId?: string;
  syncedCollection?: string;
  timestampMs?: number;
}

export interface TariffPlan {
  categoryId: TariffCategoryId;
  vehicleCategory: VehicleCategory;
  sampleModels: string;
  seatingCapacity: number;
  baseRatePerKm: number;
  oneWayRatePerKm: number;
  minKmPerDay: number;
  driverAllowancePerDay: number;
  nightChargeDefault: number;
  stateTaxDefault: number;
  gstPercentage: number;
  marketDiscountEnabled: boolean;
  marketDiscountAmount: number;
  createdBy: string;
  updatedAt?: Timestamp | null;
}

export interface FleetDriver {
  driverId: string;
  driverName: string;
  driverPhone: string;
  alternatePhone?: string;
  email?: string;
  currentAddress?: string;
  permanentAddress?: string;
  vehicleNumber: string;
  vehicleModel: string;
  vehicleCategory: VehicleCategory;
  homeBaseCity: string;
  dutyStatus: DriverDutyStatus;
  kycStatus: DriverKycStatus;
  dlNumber: string;
  dlExpiryDate?: string;
  aadhaarKycRef?: string;
  policeVerificationStatus?: 'Verified' | 'Pending' | 'In Progress';
  emergencyContact?: string;
  joiningDate?: string;
  employmentType?: 'Full-Time Fleet' | 'Commission Partner' | 'Vendor Attached';
  commissionPct?: number;
  bankUpiDetails?: string;
  internalRemarks?: string;
  rcVerified: boolean;
  insuranceVerified: boolean;
  rating: number;
  completedTrips: number;
  totalEarnings: number;
  commissionDeducted: number;
  pendingPayout: number;
  createdBy: string;
  updatedAt?: Timestamp | null;
}

export interface FleetVehicle {
  vehicleId: string;
  registrationNumber: string;
  makeAndModel: string;
  category:
    | 'Hatchback'
    | 'Sedan'
    | 'SUV'
    | 'Ertiga / 6 Seater'
    | 'Innova'
    | 'Innova Crysta'
    | 'Tempo Traveller'
    | 'Luxury Vehicles';
  seatingCapacity: number;
  acType: 'AC' | 'Non-AC';
  fuelType: 'CNG' | 'Diesel' | 'Petrol' | 'Electric';
  permitType: 'All-India Tourist Permit (AITP)' | 'State Commercial Permit';
  insuranceExpiry: string;
  fitnessExpiry: string;
  pucExpiry: string;
  assignedDriverName: string;
  assignedDriverPhone: string;
  ownerVendorName: string;
  availabilityStatus: 'Available' | 'On Trip' | 'Maintenance' | 'Inactive';
  lastMaintenanceDate: string;
}

export type SupportTicketCategory =
  | 'Booking Related'
  | 'Driver Related'
  | 'Payment Related'
  | 'Refund Related'
  | 'Lost and Found'
  | 'Trip Experience'
  | 'Cancellation'
  | 'Other Issues';

export interface SupportTicket {
  ticketId: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  category: SupportTicketCategory;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Escalated' | 'Resolved';
  assignedAgent: string;
  subject: string;
  internalNotes: string;
  refundRequestedAmount: number;
  createdAt: string;
  resolutionSummary?: string;
}

export interface CmsPortalConfig {
  heroHeadline: string;
  promoBannerText: string;
  promoCode: string;
  promoDiscountInr: number;
  minimumAndroidAppVersion: string;
  maintenanceMode: boolean;
  bookingAvailabilityOnline: boolean;
  serviceableCities: string;
  popularRoutesList: string;
  cancellationPolicySummary: string;
  termsAndConditionsSummary: string;
  whatsappBookingConfirmTemplate: string;
  whatsappDriverAssignedTemplate: string;
  smsOtpAndAlertTemplate: string;
}

export const BLUEPRINT_CONSTRAINTS = {
  BOOKING_ID_REGEX: /^SIC[0-9]{4,10}$/,
  DRIVER_ID_REGEX: /^DRV[0-9]{3,8}$/,
  PHONE_REGEX: /^[0-9+ -]{10,16}$/,
  DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  MAX_CUSTOMER_NAME: 80,
  MAX_PHONE: 16,
  MAX_EMAIL: 100,
  MAX_GSTIN: 20,
  MAX_CITY: 120,
  MAX_DRIVER_NAME: 80,
  MAX_VEHICLE_NUMBER: 20,
  MAX_VEHICLE_MODEL: 60,
  MAX_INVOICE_NUMBER: 32,
  MAX_SAMPLE_MODELS: 100,
  MAX_DL_NUMBER: 25,
} as const;

export function sanitizeString(val: string, maxLength: number): string {
  return val.trim().slice(0, maxLength);
}

export function clampNumber(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(Math.max(Math.round(val), min), max);
}

/* ============================================================================
 * OFFICIAL COMPANY GST, CONTACT, SIGNATURE & BRANDING CONSTANTS
 * ========================================================================== */
export const OFFICIAL_GSTIN = '07DQHPA3025F1ZD';
export const OFFICIAL_SAC_CODE = '996412';
export const OFFICIAL_LOGO_URL =
  '/assets/aistudio/file_0000000069908211adc71b630e4b7dee_2c93ef6f.png';
export const OFFICIAL_BANNER_URL =
  '/assets/aistudio/Screenshot_20261024_012510_Chrome_60fd6972.jpg';
export const OFFICIAL_SIGNATURE_URL =
  '/assets/aistudio/IMG-20260726-WA0012_a92b8f1b.jpg';
export const OFFICIAL_COMPANY_NAME = 'SAFARINDIACABS';
export const OFFICIAL_LEGAL_NAME = 'SAFARINDIACABS';
export const OFFICIAL_SUBTITLE =
  'A1 COMMERCIAL CAB & CORPORATE TRAVEL SERVICES • NORTH INDIA';
export const OFFICIAL_PROPRIETOR = 'Aman Mishra';
export const OFFICIAL_EMAIL = 'Safarindiacabs01@gmail.com';
export const OFFICIAL_HELPLINE = '+91 7710080992';
export const OFFICIAL_ADMIN_WHATSAPP = '917710080992';
export const OFFICIAL_REGISTERED_ADDRESS =
  'H NO 143 STREET 4 JHARODA MAJRA NORTH DELHI BURARI 110084';
export const OFFICIAL_ADMIN_PORTAL_URL = 'https://admin.safarindiacabs.com';
export const OFFICIAL_TAGLINE = 'Your Journey, Our Priority';
export const ANDROID_PACKAGE_NAME = 'com.safarindiacabs.app';

/* ============================================================================
 * OLA MAPS, RAZORPAY & META WHATSAPP CLOUD API CONFIG
 * ========================================================================== */
export const OLA_MAPS_CONFIG = {
  apiKey: 'TSHtH9B6FJ9B5U1NyR0Q1YZ7oZyxna55QwWZc3oR',
  clientId: '3d6c8822-79bd-4f31-accb-bc8229b1b391',
  clientSecret: 'e3ba8458aaab47778880e6f127ea8386',
  autocompleteEndpoint: 'https://api.olamaps.io/places/v1/autocomplete',
  detailsEndpoint: 'https://api.olamaps.io/places/v1/details',
  directionsEndpoint: 'https://api.olamaps.io/routing/v1/directions',
  distanceMatrixEndpoint: 'https://api.olamaps.io/routing/v1/distanceMatrix',
} as const;

export const WHATSAPP_CLOUD_CONFIG = {
  phoneNumberId: '902764639583293',
  wabaId: '837811205522579',
  accessToken:
    'EAAQJwftBnh4BSwB6NchrSSk726GnyhBhQ7KsRCdJjYD5ZBM9SzymkFEypXNws84BpndbNVe3VpY48pDjjXZBZAdKbPboZBXlf8nzHhemNmvWNlwStfkcGSFfMTpPTExnhZAalcnx36ZBqXRhJeZBJo1NoJtjXhdZBo1zTJjywIOp6XKyW8poIxwlc5syie5J2qvubAZDZD',
  endpoint: 'https://graph.facebook.com/v20.0/902764639583293/messages',
  adminWhatsappNumber: '917710080992',
} as const;

export const RAZORPAY_DEFAULT_CONFIG = {
  keyId: 'rzp_test_1DP5mmOlF5G5ag',
  createOrderEndpoint: '/api/create-order',
  verifyPaymentEndpoint: '/api/verify-payment',
} as const;

export interface CustomBillDraft {
  invoiceNumber: string;
  bookingId: string;
  invoiceDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  billingCompanyName: string;
  tripType: TripType;
  sameDayReturn?: boolean;
  pickupCity: string;
  dropCity: string;
  pickupDate: string;
  pickupTime: string;
  vehicleCategory: VehicleCategory;
  vehicleModel: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  distanceKm: number;
  tripDays: number;
  perKmRate: number;
  baseFare: number;
  driverAllowance: number;
  tollTax: number;
  stateTax: number;
  nightCharges: number;
  parkingTollExtra: number;
  marketDiscount: number;
  includeGst: boolean;
  gstPercentage: number;
  advancePaid: number;
  paymentMode: PaymentMode;
  includeMohurStamp: boolean;
  includeDigitalSign: boolean;
  authorizedSignatoryName: string;
  digitalSignatureTimestamp?: string;
  notes: string;
}

export interface GatewayConfig {
  razorpayEnabled: boolean;
  razorpayMode: 'Live' | 'Test';
  razorpayKeyId: string;
  razorpayWebhookSecret: string;
  autoSplitAdvance20Pct: boolean;
  upiIntentEnabled: boolean;
  merchantUpiId: string;
  olaMapsEnabled: boolean;
  olaMapsApiKey: string;
  olaMapsClientId: string;
  smsGatewayProvider: 'MSG91' | 'Fast2SMS';
  smsEnabled: boolean;
  smsSenderId: string;
  smsDltEntityId: string;
  smsBookingTemplateId: string;
  whatsappApiEnabled: boolean;
  whatsappBusinessPhone: string;
  whatsappPhoneNumberId: string;
  whatsappWabaId: string;
  whatsappAccessToken: string;
  autoWhatsappOnDriverAssign: boolean;
}

export interface AppReleaseInfo {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  minSdk: number;
  targetSdk: number;
  aabSizeMb: string;
  apkSizeMb: string;
  lastBuildDate: string;
  keystoreAlias: string;
  sha1Fingerprint: string;
  sha256Fingerprint: string;
  playStoreTrack: string;
  adminPinEnabled: boolean;
  adminSecurityPin: string;
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  razorpayEnabled: true,
  razorpayMode: 'Test',
  razorpayKeyId: RAZORPAY_DEFAULT_CONFIG.keyId,
  razorpayWebhookSecret: 'whsec_safarindiacabs_live_2026',
  autoSplitAdvance20Pct: true,
  upiIntentEnabled: true,
  merchantUpiId: 'safarindiacabs@icici',
  olaMapsEnabled: true,
  olaMapsApiKey: OLA_MAPS_CONFIG.apiKey,
  olaMapsClientId: OLA_MAPS_CONFIG.clientId,
  smsGatewayProvider: 'MSG91',
  smsEnabled: true,
  smsSenderId: 'SAFRCB',
  smsDltEntityId: '1201168492018472910',
  smsBookingTemplateId: '1207168940182940122',
  whatsappApiEnabled: true,
  whatsappBusinessPhone: OFFICIAL_HELPLINE,
  whatsappPhoneNumberId: WHATSAPP_CLOUD_CONFIG.phoneNumberId,
  whatsappWabaId: WHATSAPP_CLOUD_CONFIG.wabaId,
  whatsappAccessToken: WHATSAPP_CLOUD_CONFIG.accessToken,
  autoWhatsappOnDriverAssign: true,
};

export const DEFAULT_APP_RELEASE_INFO: AppReleaseInfo = {
  packageName: 'com.safarindiacabs.app',
  appName: 'Safar India Cabs - Outstation & Local Taxi',
  versionName: '2.6.0-prod',
  versionCode: 46,
  minSdk: 24,
  targetSdk: 35,
  aabSizeMb: '18.4 MB',
  apkSizeMb: '24.8 MB',
  lastBuildDate: '2026-11-02 11:50 IST',
  keystoreAlias: 'safarindiacabs-release-key',
  sha1Fingerprint: '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25',
  sha256Fingerprint:
    'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
  playStoreTrack: 'Production (Full Rollout)',
  adminPinEnabled: false,
  adminSecurityPin: '2026',
};

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatINRDecimal(amount: number): string {
  return `INR ${Math.round(amount).toLocaleString('en-IN')}.00`;
}

/**
 * Converts a numeric INR amount into formal Indian English words
 * e.g. 7860 -> "Rupees Seven Thousand Eight Hundred and Sixty Only"
 */
export function numberToIndianWords(amount: number): string {
  const num = Math.max(0, Math.round(amount));
  if (num === 0) return 'Rupees Zero Only';

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const convertBelowThousand = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += `${ones[Math.floor(n / 100)]} Hundred`;
      n %= 100;
      if (n > 0) str += ' and ';
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)];
      if (n % 10 > 0) str += ` ${ones[n % 10]}`;
    } else if (n > 0) {
      str += ones[n];
    }
    return str;
  };

  let remaining = num;
  const parts: string[] = [];

  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    parts.push(`${convertBelowThousand(crores)} Crore`);
    remaining %= 10000000;
  }
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    parts.push(`${convertBelowThousand(lakhs)} Lakh`);
    remaining %= 100000;
  }
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    parts.push(`${convertBelowThousand(thousands)} Thousand`);
    remaining %= 1000;
  }
  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  return `Rupees ${parts.join(' ')} Only`;
}

/**
 * Identifies legacy sample/demo bookings (SIC2601–SIC2606) so they are
 * automatically stripped from local storage and Firestore.
 */
const LEGACY_SAMPLE_CUSTOMERS = new Set([
  'rajeshwari sharma',
  'vikramaditya deshmukh',
  'ananya krishnamurthy',
  'siddharth malhotra',
  'prashant verma',
  'meenakshi sundaram',
]);

export function isSampleDemoBooking(b: Booking): boolean {
  if (!b) return false;
  const nameLower = (b.customerName || '').trim().toLowerCase();
  return LEGACY_SAMPLE_CUSTOMERS.has(nameLower);
}

export const DEFAULT_TARIFF_PLANS: Omit<TariffPlan, 'createdBy' | 'updatedAt'>[] = [
  {
    categoryId: 'hatchback',
    vehicleCategory: 'Hatchback',
    sampleModels: 'Maruti WagonR, Tata Tiago, Celerio CNG',
    seatingCapacity: 4,
    baseRatePerKm: 11,
    oneWayRatePerKm: 13,
    minKmPerDay: 250,
    driverAllowancePerDay: 300,
    nightChargeDefault: 250,
    stateTaxDefault: 450,
    gstPercentage: 5,
    marketDiscountEnabled: true,
    marketDiscountAmount: 200,
  },
  {
    categoryId: 'sedan',
    vehicleCategory: 'Sedan',
    sampleModels: 'Swift Dzire / Toyota Etios',
    seatingCapacity: 4,
    baseRatePerKm: 13,
    oneWayRatePerKm: 15,
    minKmPerDay: 250,
    driverAllowancePerDay: 350,
    nightChargeDefault: 300,
    stateTaxDefault: 550,
    gstPercentage: 5,
    marketDiscountEnabled: true,
    marketDiscountAmount: 200,
  },
  {
    categoryId: 'suv',
    vehicleCategory: 'SUV',
    sampleModels: 'Maruti Ertiga, Kia Carens, Mahindra Marazzo',
    seatingCapacity: 6,
    baseRatePerKm: 17,
    oneWayRatePerKm: 19,
    minKmPerDay: 300,
    driverAllowancePerDay: 400,
    nightChargeDefault: 350,
    stateTaxDefault: 750,
    gstPercentage: 5,
    marketDiscountEnabled: true,
    marketDiscountAmount: 200,
  },
  {
    categoryId: 'innova_crysta',
    vehicleCategory: 'Innova Crysta',
    sampleModels: 'Toyota Innova Crysta 6+1 & 7+1 Captain Seats',
    seatingCapacity: 7,
    baseRatePerKm: 21,
    oneWayRatePerKm: 24,
    minKmPerDay: 300,
    driverAllowancePerDay: 500,
    nightChargeDefault: 400,
    stateTaxDefault: 950,
    gstPercentage: 5,
    marketDiscountEnabled: true,
    marketDiscountAmount: 200,
  },
];

const LEGACY_SAMPLE_DRIVER_NAMES = new Set([
  'rajendra prasad verma',
  'mahendra singh rathore',
  'balwinder singh gill',
]);

export function isSampleDemoDriver(d: FleetDriver): boolean {
  if (!d) return false;
  const nameLower = (d.driverName || '').trim().toLowerCase();
  return LEGACY_SAMPLE_DRIVER_NAMES.has(nameLower);
}

export const INITIAL_SAMPLE_DRIVERS: Omit<FleetDriver, 'createdBy' | 'updatedAt'>[] = [
  {
    driverId: 'DRV201',
    driverName: 'Nitish Kumar',
    driverPhone: '+91 9818944089',
    vehicleNumber: 'HR55BE6324',
    vehicleModel: 'Sedan AC (Swift Dzire / Toyota Etios)',
    vehicleCategory: 'Sedan',
    homeBaseCity: 'North Delhi / Burari',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'DL-0720190048291',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 142,
    totalEarnings: 684000,
    commissionDeducted: 68400,
    pendingPayout: 0,
  },
  {
    driverId: 'DRV202',
    driverName: 'Surinder Singh',
    driverPhone: '+91 9810443210',
    vehicleNumber: 'DL01CAB8821',
    vehicleModel: 'Toyota Innova Crysta 6+1 Captain',
    vehicleCategory: 'Innova Crysta',
    homeBaseCity: 'IGI Airport / Mahipalpur',
    dutyStatus: 'On Trip',
    kycStatus: 'Verified',
    dlNumber: 'DL-0420170091823',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.8,
    completedTrips: 98,
    totalEarnings: 592000,
    commissionDeducted: 59200,
    pendingPayout: 4200,
  },
  {
    driverId: 'DRV203',
    driverName: 'Rajeev Tiwari',
    driverPhone: '+91 9910567123',
    vehicleNumber: 'UP16KT7742',
    vehicleModel: 'Maruti Ertiga Smart Hybrid AC',
    vehicleCategory: 'SUV',
    homeBaseCity: 'Noida Sector 62 / Ghaziabad',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'UP-1620200034912',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 84,
    totalEarnings: 412000,
    commissionDeducted: 41200,
    pendingPayout: 0,
  },
];

export const INITIAL_SAMPLE_BOOKINGS: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    bookingId: 'SIC2604',
    customerName: 'Amitabh Verma',
    customerPhone: '+91 9811458290',
    customerEmail: 'amitabh.verma@gmail.com',
    customerGstin: '',
    tripType: 'Round Trip Outstation',
    pickupCity: 'Connaught Place, New Delhi',
    dropCity: 'Chandigarh Sector 17',
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: '07:00 AM',
    sameDayReturn: true,
    vehicleCategory: 'Sedan',
    distanceKm: 260,
    tripDays: 1,
    perKmRate: 13,
    baseFare: 3380,
    driverAllowance: 350,
    tollTax: 420,
    stateTax: 350,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 215,
    totalFare: 4515,
    paymentMode: '20% Advance',
    advancePaid: 903,
    balanceAmount: 3612,
    status: 'Pending',
    workflowStage: 'Confirmed',
    bookingSource: 'Website',
    specialInstructions: 'Customer booked on safarindiacabs.com — requires fast highway Tag cab.',
    internalNotes: '20% Advance ₹903 verified via Razorpay.',
    driverName: '',
    driverPhone: '',
    vehicleNumber: '',
    vehicleModel: '',
    invoiceNumber: '',
    invoiceReady: false,
    timestampMs: Date.now() - 1000 * 60 * 15,
  },
  {
    bookingId: 'SIC2608',
    customerName: 'Gaurav Malhotra',
    customerPhone: '+91 9873219045',
    customerEmail: 'gaurav.malhotra@corpindia.in',
    customerGstin: '07AABCU9603R1ZM',
    tripType: 'Round Trip Outstation',
    pickupCity: 'IGI Airport T3, New Delhi',
    dropCity: 'Jaipur Pink City, Rajasthan',
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: '06:30 AM',
    sameDayReturn: false,
    vehicleCategory: 'Innova Crysta',
    distanceKm: 600,
    tripDays: 2,
    perKmRate: 21,
    baseFare: 12600,
    driverAllowance: 1000,
    tollTax: 650,
    stateTax: 750,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 740,
    totalFare: 15540,
    paymentMode: '20% Advance',
    advancePaid: 3108,
    balanceAmount: 12432,
    status: 'Active',
    workflowStage: 'Trip Started',
    bookingSource: 'Customer Android App',
    specialInstructions: 'Corporate executive pickup at Terminal 3 Pillar 14.',
    internalNotes: 'Chauffeur Surinder Singh on active duty.',
    driverName: 'Surinder Singh',
    driverPhone: '+91 9810443210',
    vehicleNumber: 'DL01CAB8821',
    vehicleModel: 'Toyota Innova Crysta 6+1 Captain',
    invoiceNumber: '',
    invoiceReady: false,
    timestampMs: Date.now() - 1000 * 60 * 45,
  },
  {
    bookingId: 'SIC2609',
    customerName: 'Priya Nair',
    customerPhone: '+91 9958112340',
    customerEmail: 'priya.nair@outlook.com',
    customerGstin: '',
    tripType: 'One Way Outstation',
    pickupCity: 'Noida Sector 62',
    dropCity: 'Dehradun Rajpur Road, Uttarakhand',
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: '08:30 AM',
    sameDayReturn: false,
    vehicleCategory: 'SUV',
    distanceKm: 310,
    tripDays: 1,
    perKmRate: 19,
    baseFare: 5890,
    driverAllowance: 400,
    tollTax: 380,
    stateTax: 450,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 346,
    totalFare: 7266,
    paymentMode: '20% Advance',
    advancePaid: 1453,
    balanceAmount: 5813,
    status: 'Pending',
    workflowStage: 'Requested',
    bookingSource: 'Website',
    specialInstructions: 'Family with 3 luggage bags, requested clean Ertiga SUV.',
    internalNotes: 'Awaiting chauffeur allotment.',
    driverName: '',
    driverPhone: '',
    vehicleNumber: '',
    vehicleModel: '',
    invoiceNumber: '',
    invoiceReady: false,
    timestampMs: Date.now() - 1000 * 60 * 90,
  },
  {
    bookingId: 'SIC5442',
    customerName: 'Rohit kumar',
    customerPhone: '+91 9990710871',
    customerEmail: 'Safarindiacabs01@gmail.com',
    customerGstin: '',
    tripType: 'Round Trip Outstation',
    pickupCity: 'Nathupura Burari 110084',
    dropCity: 'Dera Bassi Punjab',
    pickupDate: '2026-10-30',
    pickupTime: '08:30 AM',
    sameDayReturn: true,
    vehicleCategory: 'Sedan',
    distanceKm: 460,
    tripDays: 1,
    perKmRate: 14,
    baseFare: 6426,
    driverAllowance: 0,
    tollTax: 660,
    stateTax: 400,
    nightCharges: 0,
    marketDiscount: 0,
    gstAmount: 374,
    totalFare: 7860,
    paymentMode: 'Full Paid',
    advancePaid: 7860,
    balanceAmount: 0,
    status: 'Completed',
    workflowStage: 'Trip Completed',
    bookingSource: 'Website',
    specialInstructions: 'Official verified outstation round trip.',
    internalNotes: 'Settled in full — GST Invoice SIC-2026-5442 issued.',
    driverName: 'NITISH KUMAR',
    driverPhone: '+91 9818944089',
    vehicleNumber: 'HR55BE6324',
    vehicleModel: 'Sedan AC (Swift Dzire / Toyota Etios)',
    invoiceNumber: 'SIC-2026-5442',
    invoiceReady: true,
    timestampMs: Date.now() - 1000 * 60 * 180,
  },
];

export function extractTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val > 1e12 ? val : val * 1000;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === 'object' && val !== null) {
    if (
      'toMillis' in val &&
      typeof (val as { toMillis: () => number }).toMillis === 'function'
    ) {
      return (val as { toMillis: () => number }).toMillis();
    }
    if (
      'seconds' in val &&
      typeof (val as { seconds: number }).seconds === 'number'
    ) {
      return (val as { seconds: number }).seconds * 1000;
    }
  }
  return 0;
}

export function sortBookingsNewestFirst(list: Booking[]): Booking[] {
  return [...list].sort((a, b) => {
    const tA =
      a.timestampMs ||
      extractTimestampMs(a.createdAt) ||
      extractTimestampMs(a.updatedAt) ||
      0;
    const tB =
      b.timestampMs ||
      extractTimestampMs(b.createdAt) ||
      extractTimestampMs(b.updatedAt) ||
      0;
    if (tB !== tA) return tB - tA;
    return (b.bookingId || '').localeCompare(a.bookingId || '');
  });
}

/**
 * Normalizes any incoming booking document from Firestore (whether written by the
 * Customer Android App, Customer Website safarindiacabs.com, or Admin Panel) into
 * a complete, type-safe Booking record so no customer booking is ever missed.
 */
export function normalizeIncomingBooking(
  docId: string,
  raw: Record<string, unknown> | null | undefined,
  collectionName = 'bookings'
): Booking | null {
  if (!raw || typeof raw !== 'object') return null;

  const explicitId = String(
    raw.bookingId || raw.booking_id || raw.referenceId || raw.bookingRef || raw.id || ''
  ).trim();
  const explicitDigits = explicitId.replace(/\D/g, '');
  const docDigits = String(docId || '').replace(/\D/g, '');

  // Deterministic hash from docId so auto-generated Firestore IDs never collide
  const docHash = Math.abs(
    String(docId || '0')
      .split('')
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
  );

  const bookingId =
    explicitId.toUpperCase().startsWith('SIC') && explicitDigits.length >= 4
      ? `SIC${explicitDigits.slice(0, 8)}`
      : explicitDigits.length >= 4
      ? `SIC${explicitDigits.slice(-6)}`
      : String(docId || '').toUpperCase().startsWith('SIC') && docDigits.length >= 4
      ? `SIC${docDigits.slice(0, 8)}`
      : `SIC${2608 + (docHash % 7300)}`;

  const customerName = String(
    raw.customerName ||
      raw.customer_name ||
      raw.name ||
      raw.passengerName ||
      raw.userName ||
      'Safar Customer'
  ).trim();

  const rawPhone = String(
    raw.customerPhone ||
      raw.customer_phone ||
      raw.phone ||
      raw.mobile ||
      raw.contactNumber ||
      '+91 9999999999'
  ).trim();

  const customerEmail = String(
    raw.customerEmail || raw.customer_email || raw.email || OFFICIAL_EMAIL
  ).trim();

  const customerGstin = String(raw.customerGstin || raw.gstin || '').trim();

  const rawTrip = String(
    raw.tripType || raw.trip_type || raw.serviceType || raw.journeyType || 'Round Trip Outstation'
  ).toLowerCase();
  const tripType: TripType = rawTrip.includes('one')
    ? 'One Way Outstation'
    : rawTrip.includes('local') || rawTrip.includes('8hr') || rawTrip.includes('rental')
    ? 'Local 8Hr/80Km'
    : rawTrip.includes('airport')
    ? 'Airport Transfer'
    : 'Round Trip Outstation';

  const pickupCity = String(
    raw.pickupCity ||
      raw.pickup_city ||
      raw.pickupLocation ||
      raw.pickup ||
      raw.from ||
      raw.origin ||
      'New Delhi'
  ).trim();

  const dropCity = String(
    raw.dropCity ||
      raw.drop_city ||
      raw.dropLocation ||
      raw.drop ||
      raw.to ||
      raw.destination ||
      'Outstation Destination'
  ).trim();

  const todayStr = new Date().toISOString().slice(0, 10);
  const rawDate = String(
    raw.pickupDate || raw.pickup_date || raw.travelDate || raw.date || todayStr
  ).trim();
  const pickupDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : todayStr;

  const pickupTime = String(
    raw.pickupTime || raw.pickup_time || raw.travelTime || raw.time || '08:00 AM'
  ).trim();

  const rawCat = String(
    raw.vehicleCategory ||
      raw.vehicle_category ||
      raw.cabCategory ||
      raw.cabType ||
      raw.carType ||
      'Sedan'
  ).toLowerCase();
  const vehicleCategory: VehicleCategory = rawCat.includes('innova') || rawCat.includes('crysta')
    ? 'Innova Crysta'
    : rawCat.includes('suv') || rawCat.includes('ertiga') || rawCat.includes('carens')
    ? 'SUV'
    : rawCat.includes('hatch') || rawCat.includes('wagon') || rawCat.includes('tiago')
    ? 'Hatchback'
    : 'Sedan';

  const defaultRate =
    vehicleCategory === 'Innova Crysta'
      ? 21
      : vehicleCategory === 'SUV'
      ? 17
      : vehicleCategory === 'Hatchback'
      ? 11
      : 13;

  const distanceKm = Math.max(
    1,
    Number(raw.distanceKm || raw.distance_km || raw.distance || raw.km || 250)
  );
  // Default to 1 Day (Same Day) unless explicitly > 1
  const tripDays = Math.max(
    1,
    Number(raw.tripDays || raw.trip_days || raw.days || raw.durationDays || 1)
  );
  const sameDayReturn =
    raw.sameDayReturn !== undefined
      ? Boolean(raw.sameDayReturn)
      : tripType === 'Round Trip Outstation' && tripDays === 1;

  const perKmRate = Math.max(
    5,
    Number(raw.perKmRate || raw.per_km_rate || raw.ratePerKm || raw.rate || defaultRate)
  );

  const rawTotal = Number(
    raw.totalFare || raw.total_fare || raw.totalAmount || raw.fare || raw.amount || 0
  );
  const baseFare =
    Number(raw.baseFare || raw.base_fare || 0) > 0
      ? Number(raw.baseFare || raw.base_fare)
      : rawTotal > 0
      ? Math.round(rawTotal / 1.05)
      : Math.round(distanceKm * perKmRate);

  const driverAllowance = Math.max(
    0,
    Number(raw.driverAllowance ?? raw.driver_allowance ?? raw.driverBata ?? 0)
  );
  const tollTax = Math.max(
    0,
    Number(raw.tollTax ?? raw.toll_tax ?? raw.highwayToll ?? 0)
  );
  const stateTax = Math.max(
    0,
    Number(raw.stateTax ?? raw.state_tax ?? raw.permitCharges ?? 0)
  );
  const nightCharges = Math.max(
    0,
    Number(raw.nightCharges ?? raw.night_charges ?? 0)
  );
  const marketDiscount = Math.max(
    0,
    Number(raw.marketDiscount ?? raw.market_discount ?? raw.discount ?? 0)
  );

  const computedTaxable = Math.max(
    0,
    baseFare + driverAllowance + tollTax + stateTax + nightCharges - marketDiscount
  );
  const gstAmount =
    Number(raw.gstAmount ?? raw.gst_amount ?? -1) >= 0
      ? Number(raw.gstAmount ?? raw.gst_amount)
      : Math.round(computedTaxable * 0.05);

  const totalFare =
    rawTotal > 0 ? Math.round(rawTotal) : computedTaxable + gstAmount;

  const rawPaymentMode = String(raw.paymentMode || raw.payment_mode || '').toLowerCase();
  const paymentMode: PaymentMode =
    rawPaymentMode.includes('full') || rawPaymentMode.includes('100')
      ? 'Full Paid'
      : '20% Advance';

  const advancePaid =
    Number(raw.advancePaid ?? raw.advance_paid ?? raw.paidAmount ?? -1) >= 0
      ? Number(raw.advancePaid ?? raw.advance_paid ?? raw.paidAmount)
      : paymentMode === 'Full Paid'
      ? totalFare
      : Math.round(totalFare * 0.2);

  const balanceAmount =
    Number(raw.balanceAmount ?? raw.balance_amount ?? raw.dueAmount ?? -1) >= 0
      ? Number(raw.balanceAmount ?? raw.balance_amount ?? raw.dueAmount)
      : Math.max(0, totalFare - advancePaid);

  const rawStatus = String(raw.status || 'Pending').toLowerCase();
  const status: BookingStatus = rawStatus.includes('complete')
    ? 'Completed'
    : rawStatus.includes('cancel')
    ? 'Cancelled'
    : rawStatus.includes('active') ||
      rawStatus.includes('started') ||
      rawStatus.includes('ongoing') ||
      rawStatus.includes('trip')
    ? 'Active'
    : rawStatus.includes('confirm') || rawStatus.includes('assign')
    ? 'Confirmed'
    : 'Pending';

  const normalized: Booking = {
    bookingId,
    customerName,
    customerPhone: rawPhone,
    customerEmail,
    customerGstin,
    tripType,
    pickupCity,
    dropCity,
    pickupDate,
    pickupTime,
    sameDayReturn,
    vehicleCategory,
    distanceKm,
    tripDays,
    perKmRate,
    baseFare,
    driverAllowance,
    tollTax,
    stateTax,
    nightCharges,
    marketDiscount,
    gstAmount,
    totalFare,
    paymentMode,
    advancePaid,
    balanceAmount,
    status,
    workflowStage:
      (raw.workflowStage as DetailedWorkflowStage) ||
      (status === 'Completed'
        ? 'Trip Completed'
        : status === 'Active'
        ? 'Trip Started'
        : status === 'Confirmed'
        ? 'Driver Assigned'
        : 'Requested'),
    bookingSource:
      (raw.bookingSource as BookingSource) || 'Website',
    specialInstructions: String(raw.specialInstructions || raw.notes || ''),
    internalNotes: String(raw.internalNotes || ''),
    driverName: String(raw.driverName || raw.driver_name || ''),
    driverPhone: String(raw.driverPhone || raw.driver_phone || ''),
    vehicleNumber: String(raw.vehicleNumber || raw.vehicle_number || ''),
    vehicleModel: String(raw.vehicleModel || raw.vehicle_model || ''),
    invoiceNumber: String(raw.invoiceNumber || raw.invoice_number || ''),
    invoiceReady: Boolean(raw.invoiceReady ?? status === 'Completed'),
    createdBy: String(raw.createdBy || raw.userId || 'customer_portal'),
    createdAt: (raw.createdAt as Timestamp) || null,
    updatedAt: (raw.updatedAt as Timestamp) || null,
    firestoreDocId: docId || bookingId,
    syncedCollection: collectionName,
    timestampMs:
      extractTimestampMs(raw.createdAt) ||
      extractTimestampMs(raw.updatedAt) ||
      extractTimestampMs(raw.timestamp) ||
      extractTimestampMs(raw.bookedAt) ||
      Number(raw.timestampMs || 0),
  };

  if (isSampleDemoBooking(normalized)) {
    return null;
  }

  return normalized;
}

