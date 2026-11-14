import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_URL ||
      import.meta.env?.NEXT_PUBLIC_SUPABASE_URL)) ||
  'https://tuexsdplewvxswreuuwh.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_ANON_KEY ||
      import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
  'sb_publishable_0dYn7sx6S1bkH7ghAGXQmw_01k-y3Uw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface SupabaseBookingRow {
  id?: string | number;
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: string;
  drop_location: string;
  trip_type: string;
  vehicle_type: string;
  trip_date: string;
  trip_time: string;
  total_fare: number;
  advance_paid: number;
  remaining_balance: number;
  toll_charges: number;
  state_tax: number;
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  status: string;
  created_at?: string;
  // Extended optional fields if present in row or JSON metadata
  customer_email?: string;
  customer_gstin?: string;
  distance_km?: number;
  trip_days?: number;
  per_km_rate?: number;
  base_fare?: number;
  driver_allowance?: number;
  night_charges?: number;
  market_discount?: number;
  gst_amount?: number;
  payment_mode?: string;
  vehicle_model?: string;
  invoice_number?: string;
  invoice_ready?: boolean;
  workflow_stage?: string;
  booking_source?: string;
  special_instructions?: string;
  internal_notes?: string;
}
