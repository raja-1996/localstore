import { renderHook, act, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock expo-notifications
// All jest.fn() calls are INSIDE the factory so they are not affected by
// jest.mock hoisting (outer const/let variables are in TDZ at factory time).
// ---------------------------------------------------------------------------
jest.mock('expo-notifications', () => {
  const mock = {
    addNotificationResponseReceivedListener: jest.fn(),
    getLastNotificationResponseAsync: jest.fn(),
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    AndroidImportance: { MAX: 5 },
  };
  Object.defineProperty(mock, '__esModule', { value: true });
  return mock;
});

// ---------------------------------------------------------------------------
// Mock expo-device
// ---------------------------------------------------------------------------
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// ---------------------------------------------------------------------------
// Mock expo-router
// ---------------------------------------------------------------------------
jest.mock('expo-router', () => {
  const mock = { router: { push: jest.fn() } };
  Object.defineProperty(mock, '__esModule', { value: true });
  return mock;
});

// ---------------------------------------------------------------------------
// Mock @/lib/notifications
// ---------------------------------------------------------------------------
jest.mock('../lib/notifications', () => {
  const mock = { registerForPushNotifications: jest.fn() };
  Object.defineProperty(mock, '__esModule', { value: true });
  return mock;
});

// ---------------------------------------------------------------------------
// Mock @/services/user-service
// ---------------------------------------------------------------------------
jest.mock('../services/user-service', () => {
  const mock = {
    userService: {
      registerPushToken: jest.fn(),
    },
  };
  Object.defineProperty(mock, '__esModule', { value: true });
  return mock;
});

// ---------------------------------------------------------------------------
// Mock @/stores/auth-store — use a module-level variable to control state.
// The factory captures a reference to the outer module scope via closure
// using a getter so tests can mutate isAuthenticated.
// ---------------------------------------------------------------------------
let mockIsAuthenticated = true;

jest.mock('../stores/auth-store', () => {
  const mock = {
    // The selector is called each render, so it reads the outer variable
    // via the closure at call time (not at factory evaluation time).
    useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
      selector({ isAuthenticated: mockIsAuthenticated }),
  };
  Object.defineProperty(mock, '__esModule', { value: true });
  return mock;
});

// ---------------------------------------------------------------------------
// Import after mocks — module references for assertion
// ---------------------------------------------------------------------------
import { usePushNotifications } from '../hooks/use-push-notifications';
import * as NotificationsMod from 'expo-notifications';
import * as RouterMod from 'expo-router';
import * as NotificationsLib from '../lib/notifications';
import * as UserServiceMod from '../services/user-service';

// Typed mock accessors
const mockAddNotificationResponseReceivedListener = jest.mocked(
  NotificationsMod.addNotificationResponseReceivedListener,
);
const mockGetLastNotificationResponseAsync = jest.mocked(
  NotificationsMod.getLastNotificationResponseAsync,
);
const mockRouterPush = jest.mocked(RouterMod.router.push);
const mockRegisterForPush = jest.mocked(
  NotificationsLib.registerForPushNotifications,
);
const mockRegisterPushToken = jest.mocked(
  UserServiceMod.userService.registerPushToken,
);

// ---------------------------------------------------------------------------
// Helper: build a notification response object
// ---------------------------------------------------------------------------
function buildNotificationResponse(data: Record<string, unknown>) {
  return {
    notification: {
      request: {
        content: { data },
      },
    },
  };
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[abc123]');
    mockRegisterPushToken.mockResolvedValue({ data: { ok: true } });
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockAddNotificationResponseReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // Test 1: registers push token after auth
  // -------------------------------------------------------------------------
  it('registers push token when authenticated', async () => {
    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockRegisterPushToken).toHaveBeenCalledWith(
        'ExponentPushToken[abc123]',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: does not register if not authenticated
  // -------------------------------------------------------------------------
  it('does not register if not authenticated', async () => {
    mockIsAuthenticated = false;

    renderHook(() => usePushNotifications());

    // Give effect a tick to run (it shouldn't)
    await act(async () => {});

    expect(mockRegisterForPush).not.toHaveBeenCalled();
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 3: does not register if permission denied (token is null)
  // -------------------------------------------------------------------------
  it('does not call registerPushToken when permission denied', async () => {
    mockRegisterForPush.mockResolvedValue(null);

    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    });

    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 4: handles registration failure gracefully
  // -------------------------------------------------------------------------
  it('handles registerPushToken failure without throwing', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRegisterPushToken.mockRejectedValue(new Error('Network error'));

    renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockRegisterPushToken).toHaveBeenCalled();
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to register push token:',
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 5: does not double-register on re-render
  // -------------------------------------------------------------------------
  it('does not double-register on re-render', async () => {
    const { rerender } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
    });

    // Re-render the hook
    rerender({});

    // Still called only once due to tokenRegistered ref
    expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
  });
});

describe('notification tap navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockRegisterForPush.mockResolvedValue(null);
    mockRegisterPushToken.mockResolvedValue({ data: { ok: true } });
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockAddNotificationResponseReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: chat notification navigates to chat detail
  // -------------------------------------------------------------------------
  it('navigates to chat screen on chat notification tap', () => {
    // Capture the listener callback
    let capturedListener: (response: unknown) => void = () => {};
    mockAddNotificationResponseReceivedListener.mockImplementation(
      (cb: (response: unknown) => void) => {
        capturedListener = cb;
        return { remove: jest.fn() };
      },
    );

    renderHook(() => usePushNotifications());

    // Simulate a notification tap
    const response = buildNotificationResponse({
      screen: 'chat',
      threadId: 't1',
    });
    capturedListener(response);

    expect(mockRouterPush).toHaveBeenCalledWith('/chat/t1');
  });

  // -------------------------------------------------------------------------
  // Test 7: merchant notification navigates to merchant detail
  // -------------------------------------------------------------------------
  it('navigates to merchant screen on merchant notification tap', () => {
    let capturedListener: (response: unknown) => void = () => {};
    mockAddNotificationResponseReceivedListener.mockImplementation(
      (cb: (response: unknown) => void) => {
        capturedListener = cb;
        return { remove: jest.fn() };
      },
    );

    renderHook(() => usePushNotifications());

    const response = buildNotificationResponse({
      screen: 'merchant',
      merchantId: 'm1',
    });
    capturedListener(response);

    expect(mockRouterPush).toHaveBeenCalledWith('/merchant/m1');
  });
});
