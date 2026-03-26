import api from '../lib/api';

const notificationsService = {
  registerToken: (token: string): Promise<{ message: string }> =>
    api.post<{ message: string }>('/notifications/register-token', { token }),
};

export default notificationsService;
