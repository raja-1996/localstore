import { registerForPushNotifications } from '../lib/notifications';
import * as Notifications from 'expo-notifications';
import notificationsService from '../services/notifications-service';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('../services/notifications-service', () => ({
  __esModule: true,
  default: {
    registerToken: jest.fn(),
  },
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockNotificationsService = notificationsService as jest.Mocked<typeof notificationsService>;

describe('registerForPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when Device.isDevice is false (simulator)', () => {
    // Re-require notifications with expo-device mocked to isDevice: false.
    // jest.resetModules + jest.doMock is the standard pattern for per-test
    // module state changes that affect the module under test.
    jest.resetModules();
    jest.doMock('expo-device', () => ({ isDevice: false }));
    jest.doMock('expo-notifications', () => ({
      setNotificationHandler: jest.fn(),
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
      getExpoPushTokenAsync: jest.fn(),
      addNotificationReceivedListener: jest.fn(),
      addNotificationResponseReceivedListener: jest.fn(),
    }));
    jest.doMock('../services/notifications-service', () => ({
      __esModule: true,
      default: { registerToken: jest.fn() },
    }));

    const { registerForPushNotifications: fn } = require('../lib/notifications');
    return fn().then((result: string | null) => {
      expect(result).toBeNull();
    });
  });

  it('returns null when permission is denied and was already denied', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as any);
    const result = await registerForPushNotifications();
    expect(result).toBeNull();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when permission prompt is denied', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
    } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as any);
    const result = await registerForPushNotifications();
    expect(result).toBeNull();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('calls notificationsService.registerToken with the token on success', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[abc123]',
    } as any);
    mockNotificationsService.registerToken.mockResolvedValueOnce({
      data: { message: 'Token registered successfully' },
    } as any);

    await registerForPushNotifications();

    expect(mockNotificationsService.registerToken).toHaveBeenCalledWith(
      'ExponentPushToken[abc123]'
    );
  });

  it('returns the token string on success', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[abc123]',
    } as any);
    mockNotificationsService.registerToken.mockResolvedValueOnce({
      data: { message: 'Token registered successfully' },
    } as any);

    const result = await registerForPushNotifications();

    expect(result).toBe('ExponentPushToken[abc123]');
  });

  it('silently swallows backend registration error and still returns token', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[abc123]',
    } as any);
    mockNotificationsService.registerToken.mockRejectedValueOnce(
      new Error('Backend unavailable')
    );

    const result = await registerForPushNotifications();

    expect(result).toBe('ExponentPushToken[abc123]');
  });

  it('skips requestPermissionsAsync when permission is already granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[abc123]',
    } as any);
    mockNotificationsService.registerToken.mockResolvedValueOnce({
      data: { message: 'Token registered successfully' },
    } as any);

    await registerForPushNotifications();

    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
