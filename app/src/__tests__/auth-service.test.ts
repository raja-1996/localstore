import authService from '../services/auth-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  post: jest.fn(),
  delete: jest.fn(),
}));

// Intentional partial mock: auth-service only uses `post` and `delete`.
// If additional methods are added, extend this mock accordingly.
const mockApi = api as jest.Mocked<typeof api>;

const mockAuthResponse = {
  data: {
    access_token: 'access-abc',
    refresh_token: 'refresh-xyz',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'user-1', email: 'test@example.com' },
  },
};

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('calls POST /auth/signup with email and password', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      await authService.signup({ email: 'test@example.com', password: 'pass123' });
      expect(mockApi.post).toHaveBeenCalledWith('/auth/signup', {
        email: 'test@example.com',
        password: 'pass123',
      });
    });

    it('returns auth response on success', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.signup({ email: 'test@example.com', password: 'pass123' });
      expect(result.data.access_token).toBe('access-abc');
      expect(result.data.user.email).toBe('test@example.com');
    });

    it('rejects when API returns an error', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Email already exists'));
      await expect(
        authService.signup({ email: 'test@example.com', password: 'pass123' })
      ).rejects.toThrow('Email already exists');
    });

    it('rejects with 422 shape on malformed email', async () => {
      const error = { response: { status: 422, data: { detail: 'Invalid email format' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(
        authService.signup({ email: 'not-an-email', password: 'pass123' })
      ).rejects.toMatchObject({ response: { status: 422 } });
    });

    it('rejects with 429 shape on rate-limit response', async () => {
      const error = { response: { status: 429, data: { detail: 'Too many requests' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(
        authService.signup({ email: 'test@example.com', password: 'pass123' })
      ).rejects.toMatchObject({ response: { status: 429 } });
    });
  });

  describe('login', () => {
    it('calls POST /auth/login with email and password', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      await authService.login({ email: 'test@example.com', password: 'pass123' });
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'pass123',
      });
    });

    it('returns auth response on success', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.login({ email: 'test@example.com', password: 'pass123' });
      expect(result.data.refresh_token).toBe('refresh-xyz');
    });

    it('rejects on invalid credentials', async () => {
      const error = { response: { status: 401, data: { detail: 'Invalid credentials' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(
        authService.login({ email: 'bad@example.com', password: 'wrong' })
      ).rejects.toMatchObject({ response: { status: 401 } });
    });

    it('rejects with 422 shape on missing/empty password field', async () => {
      const error = { response: { status: 422, data: { detail: 'password field required' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(
        authService.login({ email: 'test@example.com', password: '' })
      ).rejects.toMatchObject({ response: { status: 422 } });
    });

    it('returns response as-is without mutating it', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.login({ email: 'test@example.com', password: 'pass123' });
      expect(result).toBe(mockAuthResponse);
    });
  });

  describe('logout', () => {
    it('calls POST /auth/logout', async () => {
      mockApi.post.mockResolvedValueOnce({ data: {} });
      await authService.logout();
      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('rejects when logout API fails', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));
      await expect(authService.logout()).rejects.toThrow('Network error');
    });
  });

  describe('refresh', () => {
    it('calls POST /auth/refresh with refresh_token', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      await authService.refresh('refresh-xyz');
      expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: 'refresh-xyz',
      });
    });

    it('returns new tokens on success', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.refresh('refresh-xyz');
      expect(result.data.access_token).toBe('access-abc');
    });

    it('rejects with 401 when refresh token is expired', async () => {
      const error = { response: { status: 401 } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(authService.refresh('expired-token')).rejects.toMatchObject({
        response: { status: 401 },
      });
    });

    it('rejects with 422 when refresh_token body is empty string', async () => {
      const error = { response: { status: 422, data: { detail: 'refresh_token required' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(authService.refresh('')).rejects.toMatchObject({
        response: { status: 422 },
      });
    });
  });

  describe('verifyPhoneOtp', () => {
    it('calls POST /auth/phone/verify-otp with phone and otp', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      await authService.verifyPhoneOtp('+1234567890', '123456');
      expect(mockApi.post).toHaveBeenCalledWith('/auth/phone/verify-otp', {
        phone: '+1234567890',
        otp: '123456',
      });
    });

    it('returns auth response on success', async () => {
      mockApi.post.mockResolvedValueOnce(mockAuthResponse);
      const result = await authService.verifyPhoneOtp('+1234567890', '123456');
      expect(result.data.user.id).toBe('user-1');
    });

    it('rejects when OTP is invalid', async () => {
      const error = { response: { status: 400, data: { detail: 'Invalid OTP' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(authService.verifyPhoneOtp('+1234567890', '000000')).rejects.toMatchObject({
        response: { status: 400 },
      });
    });
  });

  describe('sendPhoneOtp', () => {
    it('calls POST /auth/phone/send-otp with phone', async () => {
      mockApi.post.mockResolvedValueOnce({ data: {} });
      await authService.sendPhoneOtp('+1234567890');
      expect(mockApi.post).toHaveBeenCalledWith('/auth/phone/send-otp', {
        phone: '+1234567890',
      });
    });

    it('rejects when API returns an error (invalid phone)', async () => {
      const error = { response: { status: 400, data: { detail: 'Invalid phone number' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(authService.sendPhoneOtp('bad-phone')).rejects.toMatchObject({
        response: { status: 400 },
      });
    });

    it('rejects when API returns 429 rate-limit error', async () => {
      const error = { response: { status: 429, data: { detail: 'Too many requests' } } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(authService.sendPhoneOtp('+1234567890')).rejects.toMatchObject({
        response: { status: 429 },
      });
    });
  });

  describe('deleteAccount', () => {
    it('calls DELETE /auth/account', async () => {
      mockApi.delete.mockResolvedValueOnce({ data: {} });
      await authService.deleteAccount();
      expect(mockApi.delete).toHaveBeenCalledWith('/auth/account');
    });

    it('rejects when delete API fails', async () => {
      mockApi.delete.mockRejectedValueOnce(new Error('Server error'));
      await expect(authService.deleteAccount()).rejects.toThrow('Server error');
    });

    it('rejects with 401 when called without a valid session', async () => {
      const error = { response: { status: 401, data: { detail: 'Not authenticated' } } };
      mockApi.delete.mockRejectedValueOnce(error);
      await expect(authService.deleteAccount()).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
  });
});
