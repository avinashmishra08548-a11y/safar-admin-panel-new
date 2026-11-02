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

// Verbatim validation constants synced with firebase-blueprint.json and firestore.rules
export const BLUEPRINT_CONSTRAINTS = {
  BOOKING_ID_REGEX: /^SIC[0-9]{4,10}$/,
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
} as const;

export function sanitizeString(val: string, maxLength: number): string {
  return val.trim().slice(0, maxLength);
}

export function clampNumber(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(Math.max(Math.round(val), min), max);
}

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
    minKmPerKm: 250,
    minKmPerDay: 250,
    driverAllowancePerDay: 350,
    nightChargeDefault: 300,
    stateTaxDefault: 550,
    gstPercentage: 5,
    marketDiscountEnabled: true,
    marketDiscountAmount: 200,
  } as Omit<TariffPlan, 'createdBy' | 'updatedAt'>,
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
