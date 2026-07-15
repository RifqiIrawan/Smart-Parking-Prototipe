import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
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
export const getSlots = (params?: { status?: string; zone?: string }) =>
  api.get('/slots', { params });

// Reports
export const getReports = (period: 'daily' | 'monthly') =>
  api.get('/reports', { params: { period } });
