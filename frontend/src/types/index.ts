export interface User {
  id: string;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Gate {
  id: string;
  name: string;
  type: 'entry' | 'exit';
  location: string;
  status: 'open' | 'closed' | 'error';
  ip_address: string;
  is_active: boolean;
  created_at: string;
}

export interface ParkingSlot {
  id: string;
  slot_number: string;
  floor: string;
  zone: string;
  type: 'regular' | 'vip' | 'handicap' | 'motorcycle';
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  location_id?: string | null;
  location_name?: string;
}

export interface Transaction {
  id: string;
  ticket_number: string;
  plate_number: string;
  entry_time: string;
  exit_time?: string;
  duration_minutes?: number;
  total_amount: number;
  base_rate: number;
  status: 'active' | 'completed' | 'cancelled';
  slot_number?: string;
  entry_gate_name?: string;
  exit_gate_name?: string;
}

export interface Payment {
  id: string;
  transaction_id: string;
  payment_method: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  gateway_order_id: string;
  paid_at?: string;
  expired_at?: string;
}

export interface Tariff {
  id: string;
  vehicle_type: string;
  first_hour_rate: number;
  next_hour_rate: number;
  max_daily_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  plate_number: string;
  member_name: string;
  phone: string;
  membership_type: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  notes: string;
  created_at: string;
}

export interface DashboardStats {
  total_slots: number;
  available_slots: number;
  occupied_slots: number;
  active_transactions: number;
  today_revenue: number;
  today_transactions: number;
  month_revenue: number;
  occupancy_rate: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  transactions: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
