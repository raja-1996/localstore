import api from '../lib/api';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: { id: string; email: string | null; phone: string | null };
}

const authService = {
  signup: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),

  sendPhoneOtp: (phone: string) =>
    api.post('/auth/phone/send-otp', { phone }),

  verifyPhoneOtp: (phone: string, otp: string) =>
    api.post<AuthResponse>('/auth/phone/verify-otp', { phone, otp }),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: () => api.post('/auth/logout'),

  deleteAccount: () => api.delete('/auth/account'),
};

export default authService;
