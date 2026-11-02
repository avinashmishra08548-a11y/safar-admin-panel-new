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
 * OFFICIAL COMPANY GST, CONTACT & BRANDING CONSTANTS
 * ========================================================================== */
export const OFFICIAL_GSTIN = '07DQHPA3025F1ZD';
export const OFFICIAL_SAC_CODE = '996412';
export const OFFICIAL_LOGO_URL =
  '/assets/aistudio/file_0000000069908211adc71b630e4b7dee_2c93ef6f.png';
export const OFFICIAL_BANNER_URL =
  '/assets/aistudio/Screenshot_20261024_012510_Chrome_60fd6972.jpg';
export const OFFICIAL_COMPANY_NAME = 'SafarIndiaCabs';
export const OFFICIAL_LEGAL_NAME = 'SAFAR INDIA CABS (INDIA)';
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
  lastBuildDate: '2026-11-02 09:50 IST',
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
    sampleModels: 'Maruti Swift Dzire, Toyota Etios, Hyundai Aura',
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
    driverName: 'Mahendra Singh Rathore',
    driverPhone: '+91 94140 88211',
    vehicleNumber: 'HR 55 AN 3319',
    vehicleModel: 'Toyota Innova Crysta ZX',
    vehicleCategory: 'Innova Crysta',
    homeBaseCity: 'Delhi NCR / Gurugram',
    dutyStatus: 'On Trip',
    kycStatus: 'Verified',
    dlNumber: 'HR0620140098412',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 342,
    totalEarnings: 845000,
    commissionDeducted: 101400,
    pendingPayout: 14200,
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
    pendingPayout: 6850,
  },
  {
    driverId: 'DRV103',
    driverName: 'Suresh Kumar Yadav',
    driverPhone: '+91 97654 11209',
    vehicleNumber: 'MH 12 QN 8492',
    vehicleModel: 'Toyota Innova Crysta 2.4 GX',
    vehicleCategory: 'Innova Crysta',
    homeBaseCity: 'Mumbai / Pune',
    dutyStatus: 'On Trip',
    kycStatus: 'Verified',
    dlNumber: 'MH1220150073190',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 410,
    totalEarnings: 980000,
    commissionDeducted: 117600,
    pendingPayout: 9400,
  },
  {
    driverId: 'DRV104',
    driverName: 'Balwinder Singh Gill',
    driverPhone: '+91 98721 44901',
    vehicleNumber: 'PB 01 D 7732',
    vehicleModel: 'Maruti Suzuki Ertiga ZXi',
    vehicleCategory: 'SUV',
    homeBaseCity: 'Chandigarh / Shimla',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'PB6520170042911',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.7,
    completedTrips: 198,
    totalEarnings: 428000,
    commissionDeducted: 51360,
    pendingPayout: 4200,
  },
  {
    driverId: 'DRV105',
    driverName: 'Deepak Kumar Sharma',
    driverPhone: '+91 98104 55210',
    vehicleNumber: 'DL 1Z A 4921',
    vehicleModel: 'Maruti WagonR Tour H3 CNG',
    vehicleCategory: 'Hatchback',
    homeBaseCity: 'Noida / Delhi NCR',
    dutyStatus: 'Available',
    kycStatus: 'Pending Review',
    dlNumber: 'UP1620190051823',
    rcVerified: true,
    insuranceVerified: false,
    rating: 4.6,
    completedTrips: 94,
    totalEarnings: 164000,
    commissionDeducted: 19680,
    pendingPayout: 3150,
  },
  {
    driverId: 'DRV106',
    driverName: 'Ramesh Gowda H',
    driverPhone: '+91 94481 73920',
    vehicleNumber: 'KA 03 MP 5104',
    vehicleModel: 'Maruti Suzuki Ertiga ZXi+',
    vehicleCategory: 'SUV',
    homeBaseCity: 'Bengaluru / Mysuru',
    dutyStatus: 'Available',
    kycStatus: 'Verified',
    dlNumber: 'KA0320160081204',
    rcVerified: true,
    insuranceVerified: true,
    rating: 4.9,
    completedTrips: 315,
    totalEarnings: 690000,
    commissionDeducted: 82800,
    pendingPayout: 0,
  },
];

export const INITIAL_SAMPLE_BOOKINGS: Omit<Booking, 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    bookingId: 'SIC2601',
    customerName: 'Rajeshwari Sharma',
    customerPhone: '+91 98114 27650',
    customerEmail: 'rajeshwari.sharma@indiacorp.in',
    customerGstin: '07AABCI9281K1Z2',
    tripType: 'Round Trip Outstation',
    pickupCity: 'Connaught Place, New Delhi',
    dropCity: 'Tajganj, Agra (UP)',
    pickupDate: '2026-11-02',
    pickupTime: '06:00 AM',
    vehicleCategory: 'Sedan',
    distanceKm: 460,
    tripDays: 2,
    perKmRate: 13,
    baseFare: 6500,
    driverAllowance: 700,
    stateTax: 550,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 378,
    totalFare: 7928,
    paymentMode: '20% Advance',
    advancePaid: 1586,
    balanceAmount: 6342,
    status: 'Pending',
    driverName: '',
    driverPhone: '',
    vehicleNumber: '',
    vehicleModel: '',
    invoiceNumber: '',
    invoiceReady: false,
  },
  {
    bookingId: 'SIC2602',
    customerName: 'Vikramaditya Deshmukh',
    customerPhone: '+91 98201 64319',
    customerEmail: 'vikram.deshmukh@finserve.co.in',
    customerGstin: '27AAFCV3910D1Z8',
    tripType: 'One Way Outstation',
    pickupCity: 'Andheri West, Mumbai',
    dropCity: 'Hinjewadi Phase 2, Pune',
    pickupDate: '2026-11-01',
    pickupTime: '08:30 AM',
    vehicleCategory: 'Innova Crysta',
    distanceKm: 165,
    tripDays: 1,
    perKmRate: 24,
    baseFare: 3960,
    driverAllowance: 500,
    stateTax: 0,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 213,
    totalFare: 4473,
    paymentMode: 'Full Paid',
    advancePaid: 4473,
    balanceAmount: 0,
    status: 'Confirmed',
    driverName: 'Suresh Kumar Yadav',
    driverPhone: '+91 97654 11209',
    vehicleNumber: 'MH 12 QN 8492',
    vehicleModel: 'Toyota Innova Crysta 2.4 GX',
    invoiceNumber: '',
    invoiceReady: false,
  },
  {
    bookingId: 'SIC2603',
    customerName: 'Ananya Krishnamurthy',
    customerPhone: '+91 99002 58140',
    customerEmail: 'ananya.k@techspire.io',
    customerGstin: '29AABCT4412L1Z5',
    tripType: 'Round Trip Outstation',
    pickupCity: 'Indiranagar, Bengaluru',
    dropCity: 'Madikeri, Coorg (Karnataka)',
    pickupDate: '2026-10-29',
    pickupTime: '05:30 AM',
    vehicleCategory: 'SUV',
    distanceKm: 620,
    tripDays: 2,
    perKmRate: 17,
    baseFare: 10540,
    driverAllowance: 800,
    stateTax: 0,
    nightCharges: 350,
    marketDiscount: 200,
    gstAmount: 575,
    totalFare: 12065,
    paymentMode: 'Full Paid',
    advancePaid: 12065,
    balanceAmount: 0,
    status: 'Completed',
    driverName: 'Ramesh Gowda H',
    driverPhone: '+91 94481 73920',
    vehicleNumber: 'KA 03 MP 5104',
    vehicleModel: 'Maruti Suzuki Ertiga ZXi+',
    invoiceNumber: 'INV-SIC-2610-2603',
    invoiceReady: true,
  },
  {
    bookingId: 'SIC2604',
    customerName: 'Siddharth Malhotra',
    customerPhone: '+91 98180 41299',
    customerEmail: 'siddharth.m@heritagehotels.com',
    customerGstin: '08AAACH7409R1Z1',
    tripType: 'Round Trip Outstation',
    pickupCity: 'Gurugram Cyber Hub (HR)',
    dropCity: 'City Palace, Jaipur (RJ)',
    pickupDate: '2026-11-01',
    pickupTime: '07:00 AM',
    vehicleCategory: 'Innova Crysta',
    distanceKm: 600,
    tripDays: 2,
    perKmRate: 21,
    baseFare: 12600,
    driverAllowance: 1000,
    stateTax: 950,
    nightCharges: 400,
    marketDiscount: 200,
    gstAmount: 738,
    totalFare: 15488,
    paymentMode: '20% Advance',
    advancePaid: 3098,
    balanceAmount: 12390,
    status: 'Confirmed',
    driverName: 'Mahendra Singh Rathore',
    driverPhone: '+91 94140 88211',
    vehicleNumber: 'HR 55 AN 3319',
    vehicleModel: 'Toyota Innova Crysta ZX',
    invoiceNumber: '',
    invoiceReady: false,
  },
  {
    bookingId: 'SIC2605',
    customerName: 'Prashant Verma',
    customerPhone: '+91 97172 39011',
    customerEmail: 'prashant.verma88@gmail.com',
    customerGstin: '',
    tripType: 'One Way Outstation',
    pickupCity: 'Sector 17, Chandigarh',
    dropCity: 'Mall Road, Shimla (HP)',
    pickupDate: '2026-11-03',
    pickupTime: '09:00 AM',
    vehicleCategory: 'Hatchback',
    distanceKm: 250,
    tripDays: 1,
    perKmRate: 13,
    baseFare: 3250,
    driverAllowance: 300,
    stateTax: 450,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 190,
    totalFare: 3990,
    paymentMode: '20% Advance',
    advancePaid: 798,
    balanceAmount: 3192,
    status: 'Pending',
    driverName: '',
    driverPhone: '',
    vehicleNumber: '',
    vehicleModel: '',
    invoiceNumber: '',
    invoiceReady: false,
  },
  {
    bookingId: 'SIC2606',
    customerName: 'Meenakshi Sundaram',
    customerPhone: '+91 98401 67210',
    customerEmail: 'meenakshi@sundaramexports.in',
    customerGstin: '33AABCS1429B1Z9',
    tripType: 'Round Trip Outstation',
    pickupCity: 'T. Nagar, Chennai',
    dropCity: 'White Town, Puducherry',
    pickupDate: '2026-10-27',
    pickupTime: '06:30 AM',
    vehicleCategory: 'Sedan',
    distanceKm: 360,
    tripDays: 1,
    perKmRate: 13,
    baseFare: 4680,
    driverAllowance: 350,
    stateTax: 550,
    nightCharges: 0,
    marketDiscount: 200,
    gstAmount: 269,
    totalFare: 5649,
    paymentMode: 'Full Paid',
    advancePaid: 5649,
    balanceAmount: 0,
    status: 'Completed',
    driverName: 'Murugan Selvam',
    driverPhone: '+91 98410 55392',
    vehicleNumber: 'TN 09 CT 7741',
    vehicleModel: 'Toyota Etios Platinum',
    invoiceNumber: 'INV-SIC-2610-2606',
    invoiceReady: true,
  },
];
