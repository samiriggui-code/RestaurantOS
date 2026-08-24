import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  nameAr?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'CHEF';
  avatar?: string;
  businessId?: string;
}

interface Business {
  id: string;
  name: string;
  nameAr?: string;
  logo?: string;
  taxRate: number;
  serviceChargeRate: number;
  currency: string;
  wifiDuration: number;
  wifiVoucherEnabled: boolean;
  autoPrintOrders: boolean;
  kitchenDisplayEnabled: boolean;
}

export interface AuthState {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      business: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          localStorage.setItem('accessToken', data.accessToken || data.token);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user: data.user,
            business: data.business,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          const e = err as { response?: { data?: { error?: string } } };
          throw new Error(e.response?.data?.error || 'Login failed');
        }
      },

      loginWithPin: async pin => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { pin });
          localStorage.setItem('accessToken', data.accessToken || data.token);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user: data.user,
            business: data.business,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          const e = err as { response?: { data?: { error?: string } } };
          throw new Error(e.response?.data?.error || 'Login failed');
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          /* ignore */
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, business: null, isAuthenticated: false });
      },

      updateUser: updates => {
        set(state => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      checkAuth: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return set({ isAuthenticated: false, user: null });
        try {
          const { data: user } = await api.get('/auth/me');
          set({ user, isAuthenticated: true });
        } catch {
          set({ isAuthenticated: false, user: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: state => ({
        user: state.user,
        business: state.business,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
