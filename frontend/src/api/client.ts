import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: on 401, try a silent refresh (once) using the
// stored refresh token before giving up and bouncing to /login.
let refreshInFlight: Promise<string | null> | null = null;

const doSilentRefresh = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await axios.post('/api/refresh-token', { refresh_token: refreshToken });
    const { token, refresh_token } = res.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return token;
  } catch {
    return null;
  }
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retried) {
      original._retried = true;
      refreshInFlight = refreshInFlight || doSilentRefresh();
      const newToken = await refreshInFlight;
      refreshInFlight = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const login = (email: string, password: string) =>
  api.post('/login', { email, password });

export const getMe = () => api.get('/me');

export const logoutApi = (refresh_token?: string) =>
  api.post('/logout', { refresh_token });

export const refreshAccessToken = (refresh_token: string) =>
  api.post('/refresh-token', { refresh_token });

export const forgotPassword = (email: string) =>
  api.post('/forgot-password', { email });

export const resetPassword = (token: string, new_password: string) =>
  api.post('/reset-password', { token, new_password });

// Audit log
export const getAuditLogs = (params?: {
  entity_type?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) => api.get('/audit-logs', { params });

// Dashboard
export const getDashboardStats = () => api.get('/dashboard');
export const getRevenueChart = () => api.get('/dashboard/revenue-chart');
export const getSlotMap = () => api.get('/dashboard/slot-map');

// Vehicles
export const vehicleEntry = (data: {
  plate_number: string;
  vehicle_type?: string;
  gate_id?: string;
  plate_image?: string;
}) => api.post('/vehicle/entry', data);

export const vehicleExit = (data: {
  ticket_number: string;
  plate_number?: string;
  gate_id?: string;
  plate_image?: string;
}) => api.post('/vehicle/exit', data);

export const getTransactions = (params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) => api.get('/transactions', { params });

export const getTransaction = (id: string) => api.get(`/transactions/${id}`);

// Gates
export const getGates = () => api.get('/gates');
export const controlGate = (gate_id: string, command: 'open' | 'close') =>
  api.post(`/gate/${command}`, { gate_id, command });
export const createGate = (data: object) => api.post('/gates', data);
export const updateGate = (id: string, data: object) => api.put(`/gates/${id}`, data);

// Payments
export const createPayment = (data: {
  transaction_id: string;
  payment_method: string;
  payment_channel?: string;
}) => api.post('/payment/create', data);

export const getPayment = (id: string) => api.get(`/payment/${id}`);
export const simulatePayment = (order_id: string) =>
  api.post(`/payment/simulate/${order_id}`);

// Users
export const getUsers = () => api.get('/users');
export const createUser = (data: object) => api.post('/users', data);
export const updateUser = (id: string, data: object) => api.put(`/users/${id}`, data);
export const deleteUser = (id: string) => api.delete(`/users/${id}`);
export const getRoles = () => api.get('/roles');

// Slots
export const getSlots = (params?: { status?: string; zone?: string; location_id?: string }) =>
  api.get('/slots', { params });

export const getSlotFloors = (params?: { location_id?: string }) =>
  api.get('/slots/floors', { params });

export const createSlot = (data: {
  slot_number: string;
  floor: string;
  zone: string;
  type?: string;
  status?: string;
  location_id?: string;
}) => api.post('/slots', data);

export const createSlotsBulk = (data: {
  floor: string;
  zone: string;
  type?: string;
  count: number;
  prefix?: string;
  location_id?: string;
}) => api.post('/slots/bulk', data);

export const updateSlot = (id: string, data: {
  slot_number: string;
  floor: string;
  zone: string;
  type: string;
  status: string;
}) => api.put(`/slots/${id}`, data);

export const deleteSlot = (id: string) => api.delete(`/slots/${id}`);

// Reports
export const getReports = (period: 'daily' | 'monthly') =>
  api.get('/reports', { params: { period } });
export const exportReportsXlsx = (period: 'daily' | 'monthly') =>
  api.get('/reports/export', { params: { period }, responseType: 'blob' });

// Tariffs
export const getTariffs = () => api.get('/tariffs');
export const createTariff = (data: {
  vehicle_type: string;
  first_hour_rate: number;
  next_hour_rate: number;
  max_daily_rate: number;
}) => api.post('/tariffs', data);
export const updateTariff = (id: string, data: {
  first_hour_rate: number;
  next_hour_rate: number;
  max_daily_rate: number;
  is_active: boolean;
}) => api.put(`/tariffs/${id}`, data);

// Members (subscription/discount)
export const getMembers = () => api.get('/members');
export const createMember = (data: {
  plate_number: string;
  member_name: string;
  phone?: string;
  membership_type: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  notes?: string;
}) => api.post('/members', data);
export const updateMember = (id: string, data: {
  member_name: string;
  phone?: string;
  membership_type: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  notes?: string;
}) => api.put(`/members/${id}`, data);
export const deleteMember = (id: string) => api.delete(`/members/${id}`);
