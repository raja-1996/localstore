import notificationsService from '../services/notifications-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  post: jest.fn(),
}));

// Intentional partial mock: notifications-service only uses `post`.
// If additional methods are added, extend this mock accordingly.
const mockApi = api as jest.Mocked<typeof api>;

const mockRegisterResponse = {
  data: { message: 'Token registered successfully' },
};

describe('notificationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerToken', () => {
    it('calls POST /notifications/register-token with correct token', async () => {
      mockApi.post.mockResolvedValueOnce(mockRegisterResponse);
      await notificationsService.registerToken('ExponentPushToken[abc123]');
      expect(mockApi.post).toHaveBeenCalledWith('/notifications/register-token', {
        token: 'ExponentPushToken[abc123]',
      });
    });

    it('returns response on success', async () => {
      mockApi.post.mockResolvedValueOnce(mockRegisterResponse);
      const result = await notificationsService.registerToken('ExponentPushToken[abc123]');
      expect(result).toBe(mockRegisterResponse);
    });

    it('rejects when API errors', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));
      await expect(
        notificationsService.registerToken('ExponentPushToken[abc123]')
      ).rejects.toThrow('Network error');
    });

    it('rejects with 401 shape when unauthenticated', async () => {
      const error = { response: { status: 401, data: { detail: 'Not authenticated' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(
        notificationsService.registerToken('ExponentPushToken[abc123]')
      ).rejects.toMatchObject({ response: { status: 401 } });
    });

    it('rejects with 422 shape when token is malformed', async () => {
      const error = { response: { status: 422, data: { detail: 'Invalid token format' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(
        notificationsService.registerToken('bad-token')
      ).rejects.toMatchObject({ response: { status: 422 } });
    });
  });
});
