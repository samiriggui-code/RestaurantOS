import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { enqueueRequest } from './offlineQueue';

const BASE_URL = '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Queue write operations when offline
    if (!error.response && (error.code === 'ERR_NETWORK' || !navigator.onLine)) {
      if (originalRequest.method && originalRequest.method !== 'get' && originalRequest.url) {
        const isOfflineReplay = originalRequest.headers?.['X-Offline-Replay'];
        if (!isOfflineReplay) {
          const data = originalRequest.data
            ? JSON.parse(originalRequest.data as string)
            : undefined;
          const headers: Record<string, string> = {};
          if (originalRequest.headers?.Authorization) {
            headers.Authorization = originalRequest.headers.Authorization as string;
          }
          await enqueueRequest({
            method: originalRequest.method.toUpperCase(),
            url: originalRequest.url,
            data,
            headers,
          }).catch(() => {});
          return Promise.reject(new Error('تم حفظ الطلب وسيتم إرساله عند الاتصال بالإنترنت'));
        }
      }
    }

    if (error.response?.status === 401) {
      const data = error.response.data as { code?: string };

      if (data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token');

          const { data: tokens } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);

          api.defaults.headers.common.Authorization = `Bearer ${tokens.accessToken}`;
          processQueue(null, tokens.accessToken);

          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      if (!originalRequest.url?.includes('/auth/')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Legacy method wrappers for backward compatibility with existing pages
export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

export function getToken() {
  return localStorage.getItem('accessToken');
}

export const apiClient = {
  // Auth
  login: (data: Record<string, unknown>) => api.post('/auth/login', data).then(r => r.data),
  register: (data: Record<string, unknown>) => api.post('/auth/register', data).then(r => r.data),
  getMe: () => api.get('/auth/me').then(r => r.data),
  updateProfile: (data: Record<string, unknown>) =>
    api.put('/auth/profile', data).then(r => r.data),
  changePassword: (data: Record<string, unknown>) =>
    api.put('/auth/change-password', data).then(r => r.data),

  // Menu
  getCategories: (businessId: string) =>
    api.get(`/menu/categories?businessId=${businessId}`).then(r => r.data),
  createCategory: (data: Record<string, unknown>) =>
    api.post('/menu/categories', data).then(r => r.data),
  updateCategory: (id: string, data: Record<string, unknown>) =>
    api.put(`/menu/categories/${id}`, data).then(r => r.data),
  deleteCategory: (id: string) => api.delete(`/menu/categories/${id}`).then(r => r.data),
  deleteItem: (id: string) => api.delete(`/menu/items/${id}`).then(r => r.data),
  createMenuItem: (data: Record<string, unknown>) =>
    api.post('/menu/items', data).then(r => r.data),
  updateMenuItem: (id: string, data: Record<string, unknown>) =>
    api.put(`/menu/items/${id}`, data).then(r => r.data),
  deleteMenuItem: (id: string) => api.delete(`/menu/items/${id}`).then(r => r.data),
  toggleMenuItem: (id: string) => api.patch(`/menu/items/${id}/toggle`).then(r => r.data),
  uploadItemImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/menu/items/${id}/image`, formData, { headers: {} }).then(r => r.data);
  },
  createModifier: (itemId: string, data: Record<string, unknown>) =>
    api.post(`/menu/items/${itemId}/modifiers`, data).then(r => r.data),
  updateModifier: (id: string, data: Record<string, unknown>) =>
    api.put(`/menu/modifiers/${id}`, data).then(r => r.data),
  deleteModifier: (id: string) => api.delete(`/menu/modifiers/${id}`).then(r => r.data),

  // Orders
  createOrder: (data: Record<string, unknown>) => api.post('/orders', data).then(r => r.data),
  getOrders: (params?: string) => api.get(`/orders${params ? `?${params}` : ''}`).then(r => r.data),
  getOrder: (id: string) => api.get(`/orders/${id}`).then(r => r.data),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }).then(r => r.data),
  updateOrderItemStatus: (orderId: string, itemId: string, status: string) =>
    api.patch(`/orders/${orderId}/items/${itemId}/status`, { status }).then(r => r.data),
  updatePayment: (id: string, data: Record<string, unknown>) =>
    api.patch(`/orders/${id}/payment`, data).then(r => r.data),
  cancelOrder: (id: string) => api.patch(`/orders/${id}/cancel`).then(r => r.data),
  getActiveOrderForTable: (tableId: string, businessId: string) =>
    api.get(`/orders/active?tableId=${tableId}&businessId=${businessId}`).then(r => r.data),
  addItemsToOrder: (orderId: string, items: unknown[]) =>
    api.post(`/orders/${orderId}/items`, { items }).then(r => r.data),
  getReceipt: (id: string) => api.get(`/orders/${id}/receipt`).then(r => r.data),
  splitBill: (id: string, splits: { items: string[] }[]) =>
    api.post(`/orders/${id}/split`, { splits }).then(r => r.data),

  // Payments
  // Payroll & Attendance
  updateEmployeeSalary: (id: string, data: Record<string, unknown>) =>
    api.put(`/employees/${id}/salary`, data).then(r => r.data),
  getPayroll: () => api.get('/employees/payroll').then(r => r.data),
  clockIn: () => api.post('/employees/clock-in').then(r => r.data),
  clockOut: () => api.post('/employees/clock-out').then(r => r.data),
  getAttendance: (params?: string) =>
    api.get(`/employees/attendance${params ? `?${params}` : ''}`).then(r => r.data),

  // Loyalty
  getLoyaltyProgram: () => api.get('/loyalty/program').then(r => r.data),
  updateLoyaltyProgram: (data: Record<string, unknown>) =>
    api.put('/loyalty/program', data).then(r => r.data),
  searchLoyaltyCustomer: (phone: string) =>
    api.get(`/loyalty/customers/search?phone=${phone}`).then(r => r.data),
  registerLoyaltyCustomer: (data: Record<string, unknown>) =>
    api.post('/loyalty/customers', data).then(r => r.data),
  addLoyaltyPoints: (data: Record<string, unknown>) =>
    api.post('/loyalty/points/add', data).then(r => r.data),
  redeemLoyaltyPoints: (data: Record<string, unknown>) =>
    api.post('/loyalty/points/redeem', data).then(r => r.data),
  getLoyaltyCustomers: () => api.get('/loyalty/customers').then(r => r.data),

  // Tables
  getTables: () => api.get('/tables').then(r => r.data),
  createTable: (data: Record<string, unknown>) => api.post('/tables', data).then(r => r.data),
  updateTable: (id: string, data: Record<string, unknown>) =>
    api.put(`/tables/${id}`, data).then(r => r.data),
  deleteTable: (id: string) => api.delete(`/tables/${id}`).then(r => r.data),
  updateTableStatus: (id: string, status: string) =>
    api.patch(`/tables/${id}/status`, { status }).then(r => r.data),
  regenerateTableQr: (id: string) => api.post(`/tables/${id}/regenerate-qr`).then(r => r.data),

  // WiFi
  getWifiQrCodes: () => api.get('/wifi/qr-codes').then(r => r.data),
  createWifiQrCode: (data: Record<string, unknown>) =>
    api.post('/wifi/qr-codes', data).then(r => r.data),
  toggleWifiQrCode: (id: string) => api.patch(`/wifi/qr-codes/${id}/toggle`).then(r => r.data),
  connectWifi: (data: Record<string, unknown>) => api.post('/wifi/connect', data).then(r => r.data),
  getWifiInfo: (code: string) => api.get(`/wifi/info/${code}`).then(r => r.data),
  getWifiSessions: () => api.get('/wifi/sessions').then(r => r.data),
  disconnectWifiSession: (id: string) =>
    api.patch(`/wifi/sessions/${id}/disconnect`).then(r => r.data),

  // Employees
  getEmployees: () => api.get('/employees').then(r => r.data),
  createEmployee: (data: Record<string, unknown>) => api.post('/employees', data).then(r => r.data),
  updateEmployee: (id: string, data: Record<string, unknown>) =>
    api.put(`/employees/${id}`, data).then(r => r.data),
  deleteEmployee: (id: string) => api.delete(`/employees/${id}`).then(r => r.data),
  getShifts: () => api.get('/employees/shifts').then(r => r.data),
  createShift: (data: Record<string, unknown>) =>
    api.post('/employees/shifts', data).then(r => r.data),
  updateShift: (id: string, data: Record<string, unknown>) =>
    api.put(`/employees/shifts/${id}`, data).then(r => r.data),
  deleteShift: (id: string) => api.delete(`/employees/shifts/${id}`).then(r => r.data),

  // Reports
  getDashboard: () => api.get('/reports/dashboard').then(r => r.data),
  getSalesReport: (params?: string) =>
    api.get(`/reports/sales${params ? `?${params}` : ''}`).then(r => r.data),
  getCategoryReport: (params?: string) =>
    api.get(`/reports/categories${params ? `?${params}` : ''}`).then(r => r.data),
  getEmployeeReport: (params?: string) =>
    api.get(`/reports/employees${params ? `?${params}` : ''}`).then(r => r.data),
  getItemsPerformance: (params?: string) =>
    api.get(`/reports/items-performance${params ? `?${params}` : ''}`).then(r => r.data),
  getPeakHours: (params?: string) =>
    api.get(`/reports/peak-hours${params ? `?${params}` : ''}`).then(r => r.data),
  getPaymentMethods: (params?: string) =>
    api.get(`/reports/payment-methods${params ? `?${params}` : ''}`).then(r => r.data),

  // Reservations
  getReservations: (params?: string) =>
    api.get(`/reservations${params ? `?${params}` : ''}`).then(r => r.data),
  createReservation: (data: Record<string, unknown>) =>
    api.post('/reservations', data).then(r => r.data),
  updateReservation: (id: string, data: Record<string, unknown>) =>
    api.put(`/reservations/${id}`, data).then(r => r.data),
  updateReservationStatus: (id: string, status: string) =>
    api.patch(`/reservations/${id}/status`, { status }).then(r => r.data),

  // Settings
  getSettings: () => api.get('/settings').then(r => r.data),
  updateSettings: (data: Record<string, unknown>) => api.put('/settings', data).then(r => r.data),

  // Raw axios access
  get: api.get.bind(api),
  post: api.post.bind(api),
  put: api.put.bind(api),
  patch: api.patch.bind(api),
  delete: api.delete.bind(api),
};

export { api as axiosInstance };
export { apiClient as api };
export default apiClient;
