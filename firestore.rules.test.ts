/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Security Rules Verification Suite for SafarIndiaCabs Customer Operations Admin
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface AdversarialPayloadTest {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  authContext: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialPayloadTest[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Booking Create',
    collection: '/bookings/SIC2601',
    operation: 'create',
    authContext: { uid: 'op_1', email: 'avinashmishra08548@gmail.com', email_verified: true },
    payload: { bookingId: 'SIC2601', isSuperVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Email Spoofing Attack (Unverified Admin Email)',
    collection: '/bookings/SIC2601',
    operation: 'get',
    authContext: { uid: 'spoof_1', email: 'avinashmishra08548@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Booking Create (Mismatched createdBy)',
    collection: '/bookings/SIC2602',
    operation: 'create',
    authContext: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { bookingId: 'SIC2602', createdBy: 'user_b' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Path ID Poisoning Attack (Invalid Characters)',
    collection: '/bookings/SIC$INVALID!ID',
    operation: 'create',
    authContext: { uid: 'op_1', email: 'avinashmishra08548@gmail.com', email_verified: true },
    payload: { bookingId: 'SIC2603' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Value Poisoning on Driver Assignment Update (Oversized String)',
    collection: '/bookings/SIC2601',
    operation: 'update',
    authContext: { uid: 'op_1', email: 'avinashmishra08548@gmail.com', email_verified: true },
    payload: { driverName: 'A'.repeat(500) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Terminal State Bypass by Non-Admin on Completed Booking',
    collection: '/bookings/SIC2601',
    operation: 'update',
    authContext: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { status: 'Pending' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Booking Create',
    collection: '/bookings/SIC2604',
    operation: 'create',
    authContext: { uid: 'op_1', email: 'avinashmishra08548@gmail.com', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation (Mutating createdBy on Update)',
    collection: '/bookings/SIC2601',
    operation: 'update',
    authContext: { uid: 'op_1', email: 'avinashmishra08548@gmail.com', email_verified: true },
    payload: { createdBy: 'hijacked_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'PII Blanket Read on Another User Booking',
    collection: '/bookings/SIC2601',
    operation: 'get',
    authContext: { uid: 'intruder_uid', email: 'intruder@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Negative Per-KM Rate on Tariff Update',
    collection: '/tariffs/sedan',
    operation: 'update',
    authContext: { uid: 'op_1', email: 'avinashmishra08548@gmail.com', email_verified: true },
    payload: { baseRatePerKm: -15 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Self-Assigned Privilege Escalation in /admins',
    collection: '/admins/intruder_uid',
    operation: 'create',
    authContext: { uid: 'intruder_uid', email: 'intruder@example.com', email_verified: true },
    payload: { uid: 'intruder_uid', email: 'intruder@example.com', name: 'Intruder', role: 'Super Admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthenticated List Query on /bookings',
    collection: '/bookings',
    operation: 'list',
    authContext: null,
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
