import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ---------------------------------------------------------------------------
// Mock useTheme
// ---------------------------------------------------------------------------
const mockColors = {
  text: '#0F1419',
  textSecondary: '#536471',
  background: '#FFFFFF',
  surface: '#F7F9F9',
  border: '#EFF3F4',
  primary: '#1D9BF0',
  primaryText: '#FFFFFF',
  danger: '#F4212E',
  dangerText: '#FFFFFF',
  success: '#00BA7C',
};

jest.mock('../hooks/use-theme', () => ({
  useTheme: () => mockColors,
}));

// ---------------------------------------------------------------------------
// Mock expo-router
// ---------------------------------------------------------------------------
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
}));

// ---------------------------------------------------------------------------
// Mock expo-image-picker
// ---------------------------------------------------------------------------
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

// ---------------------------------------------------------------------------
// Mock expo-image
// ---------------------------------------------------------------------------
jest.mock('expo-image', () => ({ Image: 'Image' }));

// ---------------------------------------------------------------------------
// Mock storageService
// ---------------------------------------------------------------------------
jest.mock('../services/storage-service', () => ({
  __esModule: true,
  default: {
    upload: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-secure-store (needed by auth-store module resolution)
// ---------------------------------------------------------------------------
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore
// ---------------------------------------------------------------------------
const mockLogout = jest.fn().mockResolvedValue(undefined);

jest.mock('../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({
      user: { id: 'user-1', email: 'test@example.com', phone: '+919876543210' },
      logout: mockLogout,
    })
  ),
}));

// ---------------------------------------------------------------------------
// Mock useUser and useUpdateUser
// ---------------------------------------------------------------------------
const mockUpdateUser = jest.fn().mockResolvedValue({});

const mockUserHook = {
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
  isLoading: false,
};

jest.mock('../hooks/use-user', () => ({
  useUser: jest.fn(() => mockUserHook),
  useUpdateUser: jest.fn(() => ({ mutateAsync: mockUpdateUser })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import ProfileScreen from '../app/(app)/profile/index';
import { useUser } from '../hooks/use-user';
import { useAuthStore } from '../stores/auth-store';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUser as jest.Mock).mockReturnValue(mockUserHook);
    (useAuthStore as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: { id: 'user-1', email: 'test@example.com', phone: '+919876543210' },
        logout: mockLogout,
      })
    );
  });

  it('renders profile name with testID profile-name', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-name')).toBeTruthy();
    expect(screen.getByText('Test User')).toBeTruthy();
  });

  it('renders masked phone with testID profile-phone', () => {
    render(<ProfileScreen />);
    const phoneEl = screen.getByTestId('profile-phone');
    expect(phoneEl).toBeTruthy();
    // Phone +919876543210 should be masked as "+91 ****3210"
    expect(screen.getByText(/\*{4}/)).toBeTruthy();
  });

  it('shows "Become a Merchant" CTA when is_merchant is false', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('become-merchant-cta')).toBeTruthy();
    expect(screen.getByText('Become a Merchant')).toBeTruthy();
  });

  it('hides "Become a Merchant" CTA when is_merchant is true', () => {
    (useUser as jest.Mock).mockReturnValue({
      ...mockUserHook,
      data: { ...mockUserHook.data, is_merchant: true },
    });

    render(<ProfileScreen />);
    expect(screen.queryByTestId('become-merchant-cta')).toBeNull();
  });

  it('shows "Manage My Business" button when is_merchant is true', () => {
    (useUser as jest.Mock).mockReturnValue({
      ...mockUserHook,
      data: { ...mockUserHook.data, is_merchant: true },
    });

    render(<ProfileScreen />);
    expect(screen.getByTestId('manage-merchant-cta')).toBeTruthy();
    expect(screen.getByText('Manage My Business')).toBeTruthy();
  });

  it('logout button calls logout and navigates to phone-login', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
      (_title, _msg, buttons) => {
        // Simulate pressing the "Logout" button in the Alert
        const logoutButton = (buttons as any[]).find((b) => b.text === 'Logout');
        logoutButton?.onPress?.();
      }
    );

    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('logout-button'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/phone-login');
    });

    alertSpy.mockRestore();
  });
});
