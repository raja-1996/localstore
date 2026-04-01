import { userService } from '../services/user-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
  patch: jest.fn(),
}));

// Intentional partial mock: user-service uses `get` and `patch`.
const mockApi = api as jest.Mocked<typeof api>;

const mockUserProfile = {
  data: {
    id: 'user-1',
    email: 'test@example.com',
    phone: '+919876543210',
    full_name: 'Test User',
    avatar_url: null,
    push_token: null,
    is_merchant: false,
    created_at: '2026-01-01T00:00:00Z',
  },
};

const mockUpdatedProfile = {
  data: {
    id: 'user-1',
    email: 'test@example.com',
    phone: '+919876543210',
    full_name: 'Updated Name',
    avatar_url: null,
    push_token: null,
    is_merchant: false,
    created_at: '2026-01-01T00:00:00Z',
  },
};

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('calls GET /users/me', async () => {
      mockApi.get.mockResolvedValueOnce(mockUserProfile);
      await userService.getMe();
      expect(mockApi.get).toHaveBeenCalledWith('/users/me');
    });

    it('returns UserProfile data on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockUserProfile);
      const result = await userService.getMe();
      expect(result.data.id).toBe('user-1');
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.is_merchant).toBe(false);
    });

    it('rejects on 401', async () => {
      const error = { response: { status: 401, data: { detail: 'Unauthorized' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(userService.getMe()).rejects.toMatchObject({ response: { status: 401 } });
    });
  });

  describe('updateMe', () => {
    it('calls PATCH /users/me with full_name body', async () => {
      mockApi.patch.mockResolvedValueOnce(mockUpdatedProfile);
      await userService.updateMe({ full_name: 'Updated Name' });
      expect(mockApi.patch).toHaveBeenCalledWith('/users/me', { full_name: 'Updated Name' });
    });

    it('returns updated UserProfile on success', async () => {
      mockApi.patch.mockResolvedValueOnce(mockUpdatedProfile);
      const result = await userService.updateMe({ full_name: 'Updated Name' });
      expect(result.data.full_name).toBe('Updated Name');
      expect(result.data.id).toBe('user-1');
    });

    it('sends only provided fields in partial update', async () => {
      mockApi.patch.mockResolvedValueOnce({
        data: { ...mockUserProfile.data, avatar_url: 'https://example.com/avatar.jpg' },
      });
      await userService.updateMe({ avatar_url: 'https://example.com/avatar.jpg' });
      expect(mockApi.patch).toHaveBeenCalledWith('/users/me', {
        avatar_url: 'https://example.com/avatar.jpg',
      });
      // full_name not included in the call
      const callBody = (mockApi.patch.mock.calls[0] as any[])[1];
      expect(callBody).not.toHaveProperty('full_name');
    });

    it('rejects on 401', async () => {
      const error = { response: { status: 401, data: { detail: 'Unauthorized' } } };
      mockApi.patch.mockRejectedValueOnce(error);
      await expect(
        userService.updateMe({ full_name: 'Test' })
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });
});
