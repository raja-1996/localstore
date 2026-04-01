import api from '@/lib/api';
import type { UserProfile, UserUpdate } from '@/types/user';

export const userService = {
  getMe: () => api.get<UserProfile>('/users/me'),

  updateMe: (data: UserUpdate) => api.patch<UserProfile>('/users/me', data),

  registerPushToken: (token: string) =>
    api.put('/users/me/push-token', { token }),
};
