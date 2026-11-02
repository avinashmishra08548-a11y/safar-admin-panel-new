import { Timestamp } from 'firebase/firestore';

export type VehicleCategory = 'Hatchback' | 'Sedan' | 'SUV' | 'Innova Crysta';
export type TariffCategoryId = 'hatchback' | 'sedan' | 'suv' | 'innova_crysta';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
export type TripType =
  | 'Round Trip Outstation'
  | 'One Way Outstation'
  | 'Local 8Hr/80Km'
  | 'Airport Transfer';
export type PaymentMode = '20% Advance' | 'Full Paid';
export type DriverDutyStatus = 'Available' | 'On Trip' | 'Off Duty';
export type DriverKycStatus = 'Verified' | 'Pending Review' | 'Expiring Soon';

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
  vehicleCategory: VehicleCategory;
  distanceKm: number;
  tripDays: number;
  perKmRate: number;
  baseFare: number;
  driverAllowance: number;
  stateTax: number;
  nightCharges: number;
  marketDiscount: number;
  gstAmount: number;
  totalFare: number;
  paymentMode: PaymentMode;
  advancePaid: number;
  balanceAmount: number;
  status: BookingStatus;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  vehicleModel: string;
  invoiceNumber: string;
  invoiceReady: boolean;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
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
  vehicleNumber: string;
  vehicleModel: string;
  vehicleCategory: VehicleCategory;
  homeBaseCity: string;
  dutyStatus: DriverDutyStatus;
  kycStatus: DriverKycStatus;
  dlNumber: string;
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

const LEGACY_SAMPLE_IDS = new Set([
  'SIC2601',
  'SIC2602',
  'SIC2603',
  'SIC2604',
  'SIC2605',
  'SIC2606',
]);

export function isSampleDemoBooking(b: Booking): boolean {
  if (!b) return false;
  const nameLower = (b.customerName || '').trim().toLowerCase();
  if (LEGACY_SAMPLE_CUSTOMERS.has(nameLower)) return true;
  if (LEGACY_SAMPLE_IDS.has(b.bookingId) && LEGACY_SAMPLE_CUSTOMERS.has(nameLower)) {
    return true;
  }
  return false;
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

export const INITIAL_SAMPLE_DRIVERS: Omit<FleetDriver, 'createdBy' | 'updatedAt'>[] = [
  {
    driverId: 'DRV101',
    driverName: 'NITISH KUMAR',
    driverPhone: '+91 98189 44089',
    vehicleNumber: 'HR55BE6324',
    vehicleModel: 'Swift Dzire / Toyota Etios',
    vehicleCategory: 'Sedan',
    homeBaseCity: 'North Delhi / Burari',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'HR0620140098412',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 342,
    totalEarnings: 845000,
    commissionDeducted: 101400,
    pendingPayout: 0,
  },
  {
    driverId: 'DRV102',
    driverName: 'Rajendra Prasad Verma',
    driverPhone: '+91 98182 74105',
    vehicleNumber: 'DL 01 CAB 6812',
    vehicleModel: 'Maruti Swift Dzire Tour S',
    vehicleCategory: 'Sedan',
    homeBaseCity: 'New Delhi',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'DL0420160184720',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.8,
    completedTrips: 289,
    totalEarnings: 512000,
    commissionDeducted: 61440,
    pendingPayout: 0,
  },
  {
    driverId: 'DRV103',
    driverName: 'Mahendra Singh Rathore',
    driverPhone: '+91 94140 88211',
    vehicleNumber: 'HR 55 AN 3319',
    vehicleModel: 'Toyota Innova Crysta ZX',
    vehicleCategory: 'Innova Crysta',
    homeBaseCity: 'Delhi NCR / Gurugram',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'MH1220150073190',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 410,
    totalEarnings: 980000,
    commissionDeducted: 117600,
    pendingPayout: 0,
  },
  {
    driverId: 'DRV104',
    driverName: 'Balwinder Singh Gill',
    driverPhone: '+91 98721 44901',
    vehicleNumber: 'PB 01 D 7732',
    vehicleModel: 'Maruti Suzuki Ertiga ZXi',
    vehicleCategory: 'SUV',
    homeBaseCity: 'Chandigarh / Punjab',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'PB6520170042911',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.8,
    completedTrips: 198,
    totalEarnings: 428000,
    commissionDeducted: 51360,
    pendingPayout: 0,
  },
];

// All sample/example bookings removed as requested by owner — only real bookings are shown
export const INITIAL_SAMPLE_BOOKINGS: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>[] = [];
