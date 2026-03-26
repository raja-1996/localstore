import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import authService, { AuthResponse } from '../services/auth-service';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

async function saveTokens(data: AuthResponse) {
  await SecureStore.setItemAsync('access_token', data.access_token);
  await SecureStore.setItemAsync('refresh_token', data.refresh_token);
}

async function clearTokens() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await authService.login({ email, password });
    await saveTokens(data);
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
    });
  },

  signup: async (email, password) => {
    const { data } = await authService.signup({ email, password });
    await saveTokens(data);
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
    });
  },

  sendPhoneOtp: async (phone) => {
    await authService.sendPhoneOtp(phone);
  },

  verifyPhoneOtp: async (phone, otp) => {
    const { data } = await authService.verifyPhoneOtp(phone, otp);
    await saveTokens(data);
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout API errors
    }
    await clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  deleteAccount: async () => {
    await authService.deleteAccount();
    await clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  restoreSession: async () => {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    try {
      accessToken = await SecureStore.getItemAsync('access_token');
      refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (accessToken && refreshToken) {
        // Try to refresh the token to validate the session
        const { data } = await authService.refresh(refreshToken);
        await saveTokens(data);
        set({
          user: data.user,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      // Distinguish between auth errors (401) and network errors
      if (error.response?.status === 401) {
        // Token is invalid — clear and force re-login
        await clearTokens();
        set({ isLoading: false });
      } else {
        // Network error — keep tokens and allow offline use
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    }
  },
}));
