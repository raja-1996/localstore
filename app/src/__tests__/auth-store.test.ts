import * as SecureStore from 'expo-secure-store';
import authService from '../services/auth-service';
import { useAuthStore } from '../stores/auth-store';

jest.mock('../services/auth-service', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    verifyPhoneOtp: jest.fn(),
    deleteAccount: jest.fn(),
    sendPhoneOtp: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

const mockAuthResponse = {
  data: {
    access_token: 'access-abc',
    refresh_token: 'refresh-xyz',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'user-1', email: 'test@example.com' },
  },
};

function getState() {
  return useAuthStore.getState();
}

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  describe('login', () => {
    it('sets user and tokens in state on success', async () => {
      mockAuthService.login.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().login('test@example.com', 'pass123');
      const state = getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual({ id: 'user-1', email: 'test@example.com' });
      expect(state.accessToken).toBe('access-abc');
      expect(state.refreshToken).toBe('refresh-xyz');
      expect(state.isLoading).toBe(false);
    });

    it('saves tokens to SecureStore on success', async () => {
      mockAuthService.login.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().login('test@example.com', 'pass123');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('access_token', 'access-abc');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-xyz');
    });

    it('throws and does not update state on failure', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('Invalid credentials'));
      await expect(getState().login('bad@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials'
      );
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().user).toBeNull();
    });

    it('does not set isLoading during login action', async () => {
      // isLoading is only managed by restoreSession, not individual auth actions
      mockAuthService.login.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().login('test@example.com', 'pass123');
      // isLoading remains false — login does not touch it
      expect(getState().isLoading).toBe(false);
    });

    it('propagates error when SecureStore.setItemAsync throws', async () => {
      mockAuthService.login.mockResolvedValueOnce(mockAuthResponse as any);
      mockSecureStore.setItemAsync.mockRejectedValueOnce(new Error('SecureStore write failed'));
      await expect(getState().login('test@example.com', 'pass123')).rejects.toThrow(
        'SecureStore write failed'
      );
    });
  });

  describe('signup', () => {
    it('sets user and tokens in state on success', async () => {
      mockAuthService.signup.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().signup('new@example.com', 'pass123');
      const state = getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.accessToken).toBe('access-abc');
    });

    it('saves tokens to SecureStore on success', async () => {
      mockAuthService.signup.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().signup('new@example.com', 'pass123');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('access_token', 'access-abc');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-xyz');
    });

    it('throws on signup failure', async () => {
      mockAuthService.signup.mockRejectedValueOnce(new Error('Email taken'));
      await expect(getState().signup('existing@example.com', 'pass123')).rejects.toThrow(
        'Email taken'
      );
      expect(getState().isAuthenticated).toBe(false);
    });

    it('propagates error when SecureStore.setItemAsync throws during signup', async () => {
      mockAuthService.signup.mockResolvedValueOnce(mockAuthResponse as any);
      mockSecureStore.setItemAsync.mockRejectedValueOnce(new Error('SecureStore write failed'));
      await expect(getState().signup('new@example.com', 'pass123')).rejects.toThrow(
        'SecureStore write failed'
      );
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: { id: 'user-1', email: 'test@example.com' },
        accessToken: 'access-abc',
        refreshToken: 'refresh-xyz',
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('clears state after logout', async () => {
      mockAuthService.logout.mockResolvedValueOnce({ data: {} } as any);
      await getState().logout();
      const state = getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('clears tokens from SecureStore', async () => {
      mockAuthService.logout.mockResolvedValueOnce({ data: {} } as any);
      await getState().logout();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    });

    it('still clears state even when logout API fails', async () => {
      mockAuthService.logout.mockRejectedValueOnce(new Error('Network error'));
      await getState().logout();
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().user).toBeNull();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: { id: 'user-1', email: 'test@example.com' },
        accessToken: 'access-abc',
        refreshToken: 'refresh-xyz',
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('clears state after account deletion', async () => {
      mockAuthService.deleteAccount.mockResolvedValueOnce({ data: {} } as any);
      await getState().deleteAccount();
      const state = getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
    });

    it('clears tokens from SecureStore', async () => {
      mockAuthService.deleteAccount.mockResolvedValueOnce({ data: {} } as any);
      await getState().deleteAccount();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    });

    it('throws when deleteAccount API fails', async () => {
      mockAuthService.deleteAccount.mockRejectedValueOnce(new Error('Server error'));
      await expect(getState().deleteAccount()).rejects.toThrow('Server error');
    });

    it('does not clear state or SecureStore when API throws', async () => {
      mockAuthService.deleteAccount.mockRejectedValueOnce(new Error('Server error'));
      await expect(getState().deleteAccount()).rejects.toThrow('Server error');
      // State remains authenticated since deletion failed
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().accessToken).toBe('access-abc');
      expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('propagates error when SecureStore.deleteItemAsync throws during clearTokens', async () => {
      mockAuthService.deleteAccount.mockResolvedValueOnce({ data: {} } as any);
      mockSecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('SecureStore delete failed'));
      await expect(getState().deleteAccount()).rejects.toThrow('SecureStore delete failed');
      // State should NOT be fully cleared — API succeeded but token removal failed
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().accessToken).toBe('access-abc');
    });
  });

  describe('verifyPhoneOtp', () => {
    it('sets user and tokens in state on success', async () => {
      mockAuthService.verifyPhoneOtp.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().verifyPhoneOtp('+1234567890', '123456');
      const state = getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.id).toBe('user-1');
      expect(state.accessToken).toBe('access-abc');
    });

    it('saves tokens to SecureStore', async () => {
      mockAuthService.verifyPhoneOtp.mockResolvedValueOnce(mockAuthResponse as any);
      await getState().verifyPhoneOtp('+1234567890', '123456');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('access_token', 'access-abc');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-xyz');
    });

    it('throws when OTP is invalid', async () => {
      mockAuthService.verifyPhoneOtp.mockRejectedValueOnce(new Error('Invalid OTP'));
      await expect(getState().verifyPhoneOtp('+1234567890', '000000')).rejects.toThrow(
        'Invalid OTP'
      );
      expect(getState().isAuthenticated).toBe(false);
    });

    it('does not mutate state when OTP verification throws', async () => {
      mockAuthService.verifyPhoneOtp.mockRejectedValueOnce(new Error('Invalid OTP'));
      await expect(getState().verifyPhoneOtp('+1234567890', '000000')).rejects.toThrow();
      expect(getState().accessToken).toBeNull();
      expect(getState().user).toBeNull();
    });
  });

  describe('sendPhoneOtp', () => {
    it('calls authService.sendPhoneOtp with correct phone number', async () => {
      mockAuthService.sendPhoneOtp.mockResolvedValueOnce({ data: {} } as any);
      await getState().sendPhoneOtp('+1234567890');
      expect(mockAuthService.sendPhoneOtp).toHaveBeenCalledWith('+1234567890');
    });

    it('does not mutate state on success', async () => {
      mockAuthService.sendPhoneOtp.mockResolvedValueOnce({ data: {} } as any);
      await getState().sendPhoneOtp('+1234567890');
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().user).toBeNull();
    });

    it('throws when authService.sendPhoneOtp rejects', async () => {
      mockAuthService.sendPhoneOtp.mockRejectedValueOnce(new Error('Invalid phone number'));
      await expect(getState().sendPhoneOtp('bad-phone')).rejects.toThrow('Invalid phone number');
    });
  });

  describe('restoreSession', () => {
    it('restores session when refresh succeeds with valid tokens', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('stored-access')
        .mockResolvedValueOnce('stored-refresh');
      mockAuthService.refresh.mockResolvedValueOnce(mockAuthResponse as any);

      await getState().restoreSession();

      const state = getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.accessToken).toBe('access-abc');
      expect(mockAuthService.refresh).toHaveBeenCalledWith('stored-refresh');
    });

    it('saves new tokens to SecureStore after successful refresh', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('stored-access')
        .mockResolvedValueOnce('stored-refresh');
      mockAuthService.refresh.mockResolvedValueOnce(mockAuthResponse as any);

      await getState().restoreSession();

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('access_token', 'access-abc');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-xyz');
    });

    it('clears tokens and sets isLoading false on 401', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('expired-access')
        .mockResolvedValueOnce('expired-refresh');
      const authError = { response: { status: 401 } };
      mockAuthService.refresh.mockRejectedValueOnce(authError);

      await getState().restoreSession();

      const state = getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    });

    it('keeps tokens and stays authenticated on network error', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('stored-access')
        .mockResolvedValueOnce('stored-refresh');
      const networkError = new Error('Network Error');
      mockAuthService.refresh.mockRejectedValueOnce(networkError);

      await getState().restoreSession();

      const state = getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.accessToken).toBe('stored-access');
      expect(state.refreshToken).toBe('stored-refresh');
      expect(state.user).toBeNull();
      expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('sets isLoading false with no tokens present', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await getState().restoreSession();

      expect(getState().isLoading).toBe(false);
      expect(getState().isAuthenticated).toBe(false);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('does not call refresh when only access_token is present', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('stored-access')
        .mockResolvedValueOnce(null);

      await getState().restoreSession();

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      expect(getState().isLoading).toBe(false);
      expect(getState().isAuthenticated).toBe(false);
    });

    it('does not call refresh when only refresh_token is present', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('stored-refresh');

      await getState().restoreSession();

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      expect(getState().isLoading).toBe(false);
      expect(getState().isAuthenticated).toBe(false);
    });

    it('sets isLoading false when SecureStore.getItemAsync throws', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('SecureStore read failed'));

      await getState().restoreSession();

      expect(getState().isLoading).toBe(false);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('sets isLoading false and stays authenticated (network error path) when second getItemAsync throws', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('stored-access')
        .mockRejectedValueOnce(new Error('SecureStore read failed'));

      await getState().restoreSession();

      // Second getItemAsync throws a non-401 error → caught as network error
      // accessToken was already read ('stored-access'), refreshToken stays null
      // else branch sets isAuthenticated: true with the partial tokens
      expect(getState().isLoading).toBe(false);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().accessToken).toBe('stored-access');
      expect(getState().refreshToken).toBeNull();
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('still re-validates via refresh when already authenticated', async () => {
      useAuthStore.setState({
        user: { id: 'user-1', email: 'test@example.com' },
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        isAuthenticated: true,
        isLoading: false,
      });
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('old-access')
        .mockResolvedValueOnce('old-refresh');
      mockAuthService.refresh.mockResolvedValueOnce(mockAuthResponse as any);

      await getState().restoreSession();

      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-refresh');
      expect(getState().accessToken).toBe('access-abc');
    });
  });
});
