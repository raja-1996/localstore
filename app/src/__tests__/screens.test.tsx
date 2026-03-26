import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
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
// Mock useAuthStore
// ---------------------------------------------------------------------------
const mockLogin = jest.fn();
const mockSignup = jest.fn();
const mockLogout = jest.fn();
const mockDeleteAccount = jest.fn();
const mockSendPhoneOtp = jest.fn();
const mockVerifyPhoneOtp = jest.fn();

jest.mock('../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({
      user: { id: 'user-1', email: 'test@example.com' },
      login: mockLogin,
      signup: mockSignup,
      logout: mockLogout,
      deleteAccount: mockDeleteAccount,
      sendPhoneOtp: mockSendPhoneOtp,
      verifyPhoneOtp: mockVerifyPhoneOtp,
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Mock use-todos hooks
// ---------------------------------------------------------------------------
const mockRefetch = jest.fn();
const mockUpdateTodoMutate = jest.fn();
const mockDeleteTodoMutate = jest.fn();

jest.mock('../hooks/use-todos', () => ({
  useTodos: jest.fn(),
  useUpdateTodo: jest.fn(() => ({ mutate: mockUpdateTodoMutate })),
  useDeleteTodo: jest.fn(() => ({ mutate: mockDeleteTodoMutate })),
}));

// ---------------------------------------------------------------------------
// Mock expo-router
// ---------------------------------------------------------------------------
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  Link: ({ children, href }: any) => {
    const { Text } = require('react-native');
    return <Text testID={`link-${href}`}>{children}</Text>;
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-image-picker
// ---------------------------------------------------------------------------
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
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

// Resolve the mock reference after module registration to avoid hoisting issues
let mockStorageUpload: jest.Mock;

// ---------------------------------------------------------------------------
// Mock expo-secure-store (needed by auth-store module resolution)
// ---------------------------------------------------------------------------
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Screen imports (after mocks)
// ---------------------------------------------------------------------------
import LoginScreen from '../app/(auth)/login';
import SignupScreen from '../app/(auth)/signup';
import TodosScreen from '../app/(app)/todos';
import SettingsScreen from '../app/(app)/settings';
import PhoneLoginScreen from '../app/(auth)/phone-login';

import { useTodos, useUpdateTodo, useDeleteTodo } from '../hooks/use-todos';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../stores/auth-store';
import storageService from '../services/storage-service';

// Resolve mock references after module system processes them
beforeAll(() => {
  mockStorageUpload = (storageService.upload as jest.Mock);
});

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------
describe('LoginScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders the title "Welcome Back"', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Welcome Back')).toBeTruthy();
  });

  it('renders the subtitle "Sign in to your account"', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Sign in to your account')).toBeTruthy();
  });

  it('renders Email and Password input fields', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders the "Sign In" button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders signup and phone-login link text', () => {
    render(<LoginScreen />);
    expect(screen.getByText("Don't have an account? Sign Up")).toBeTruthy();
    expect(screen.getByText('Login with Phone')).toBeTruthy();
  });

  it('shows email required error when submitting empty email', async () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows invalid email format error for malformed email', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'not-an-email');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeTruthy();
    });
  });

  it('shows password required error when submitting empty password', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeTruthy();
    });
  });

  it('shows password too short error when password is under 6 chars', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'abc');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeTruthy();
    });
  });

  it('does not call login when validation fails', async () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with email and password on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
    });
  });

  it('does not show an error alert after successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows loading state on the button while login is pending', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValueOnce(new Promise<void>((res) => { resolveLogin = res; }));
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
    });
    await act(async () => { resolveLogin(); });
  });

  it('clears loading state after login resolves', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator).length).toBe(0);
    });
  });

  it('calls Alert.alert with "Login Failed" when login throws', async () => {
    const err = Object.assign(new Error('Bad credentials'), { response: { data: { detail: 'Bad credentials' } } });
    mockLogin.mockRejectedValueOnce(err);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Login Failed', 'Bad credentials');
    });
  });

  it('clears loading state after login throws', async () => {
    mockLogin.mockRejectedValueOnce(new Error('network error'));
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator).length).toBe(0);
    });
  });

  it('signup link has correct href', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('link-/(auth)/signup')).toBeTruthy();
  });

  it('phone-login link has correct href', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('link-/(auth)/phone-login')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Signup Screen
// ---------------------------------------------------------------------------
describe('SignupScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders the title "Create Account" and the submit button', () => {
    render(<SignupScreen />);
    expect(screen.getAllByText('Create Account').length).toBe(2);
  });

  it('renders the subtitle "Sign up to get started"', () => {
    render(<SignupScreen />);
    expect(screen.getByText('Sign up to get started')).toBeTruthy();
  });

  it('renders Email, Password, and Confirm Password input fields', () => {
    render(<SignupScreen />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    expect(screen.getByText('Confirm Password')).toBeTruthy();
  });

  it('renders the sign-in link text', () => {
    render(<SignupScreen />);
    expect(screen.getByText('Already have an account? Sign In')).toBeTruthy();
  });

  it('sign-in link has correct href', () => {
    render(<SignupScreen />);
    expect(screen.getByTestId('link-/(auth)/login')).toBeTruthy();
  });

  it('shows email required error when email is empty', async () => {
    render(<SignupScreen />);
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows invalid email format error for malformed email', async () => {
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'bad-email');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeTruthy();
    });
  });

  it('shows password required error when password is empty', async () => {
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeTruthy();
    });
  });

  it('shows password too short error when password is under 6 chars', async () => {
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'abc');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeTruthy();
    });
  });

  it('shows passwords do not match error when confirm differs from password', async () => {
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.changeText(screen.getByTestId('confirm-password-input'), 'different');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('does not call signup when validation fails', async () => {
    render(<SignupScreen />);
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('calls signup with email and password on valid submit', async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.changeText(screen.getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('new@example.com', 'password123');
    });
  });

  it('shows loading state on the button while signup is pending', async () => {
    let resolveSignup!: () => void;
    mockSignup.mockReturnValueOnce(new Promise<void>((res) => { resolveSignup = res; }));
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.changeText(screen.getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
    });
    await act(async () => { resolveSignup(); });
  });

  it('clears loading state after signup resolves', async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.changeText(screen.getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator).length).toBe(0);
    });
  });

  it('calls Alert.alert with "Signup Failed" when signup throws', async () => {
    const err = Object.assign(new Error('Email taken'), { response: { data: { detail: 'Email taken' } } });
    mockSignup.mockRejectedValueOnce(err);
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'existing@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.changeText(screen.getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Signup Failed', 'Email taken');
    });
  });

  it('clears loading state after signup throws', async () => {
    mockSignup.mockRejectedValueOnce(new Error('network error'));
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByTestId('email-input'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    fireEvent.changeText(screen.getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-button'));
    await waitFor(() => {
      expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator).length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Todos Screen
// ---------------------------------------------------------------------------
describe('TodosScreen', () => {
  let alertSpy: jest.SpyInstance;

  const mockTodos = [
    { id: 'todo-1', title: 'Buy milk', description: 'From the store', is_completed: false },
    { id: 'todo-2', title: 'Read book', description: undefined, is_completed: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (useTodos as jest.Mock).mockReturnValue({ data: [], isLoading: false, refetch: mockRefetch });
    (useUpdateTodo as jest.Mock).mockReturnValue({ mutate: mockUpdateTodoMutate });
    (useDeleteTodo as jest.Mock).mockReturnValue({ mutate: mockDeleteTodoMutate });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders a list of todo cards when todos are present', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: mockTodos, isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    expect(screen.getByText('Buy milk')).toBeTruthy();
    expect(screen.getByText('Read book')).toBeTruthy();
  });

  it('renders empty state text when todos list is empty and not loading', () => {
    render(<TodosScreen />);
    expect(screen.getByText('No todos yet')).toBeTruthy();
  });

  it('does not render empty state when isLoading is true', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: [], isLoading: true, refetch: mockRefetch });
    render(<TodosScreen />);
    expect(screen.queryByText('No todos yet')).toBeNull();
  });

  it('renders the FAB "+" button', () => {
    render(<TodosScreen />);
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('pressing the FAB calls router.push to todo-detail with no id param', () => {
    render(<TodosScreen />);
    fireEvent.press(screen.getByText('+'));
    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: '/(app)/todo-detail' });
  });

  it('pressing a TodoCard calls router.push to todo-detail with the todo id', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: mockTodos, isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    fireEvent.press(screen.getByText('Buy milk'));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/todo-detail',
      params: { id: 'todo-1' },
    });
  });

  it('pressing the toggle on a TodoCard calls updateTodo.mutate with correct payload', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: mockTodos, isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    fireEvent.press(screen.getByTestId('checkbox-buy-milk'));
    expect(mockUpdateTodoMutate).toHaveBeenCalledWith({
      id: 'todo-1',
      data: { is_completed: true },
    });
  });

  it('long pressing a TodoCard shows the delete confirmation Alert', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: mockTodos, isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    fireEvent(screen.getByText('Buy milk'), 'longPress');
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Todo',
      'Are you sure you want to delete this todo?',
      expect.any(Array),
    );
  });

  it('pressing Delete in the alert calls deleteTodo.mutate with the todo id', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: mockTodos, isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    fireEvent(screen.getByText('Buy milk'), 'longPress');
    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const deleteBtn = alertButtons.find((b: any) => b.text === 'Delete');
    deleteBtn.onPress();
    expect(mockDeleteTodoMutate).toHaveBeenCalledWith('todo-1');
  });

  it('pressing Cancel in the alert does not call deleteTodo.mutate', () => {
    (useTodos as jest.Mock).mockReturnValue({ data: mockTodos, isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    fireEvent(screen.getByText('Buy milk'), 'longPress');
    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const cancelBtn = alertButtons.find((b: any) => b.text === 'Cancel');
    if (cancelBtn.onPress) cancelBtn.onPress();
    expect(mockDeleteTodoMutate).not.toHaveBeenCalled();
  });

  it('onRefresh calls refetch and resets refreshing state after completion', async () => {
    mockRefetch.mockResolvedValueOnce(undefined);
    (useTodos as jest.Mock).mockReturnValue({ data: [], isLoading: false, refetch: mockRefetch });
    render(<TodosScreen />);
    const refreshControl = screen.UNSAFE_getByType(require('react-native').RefreshControl);
    await act(async () => {
      refreshControl.props.onRefresh();
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(refreshControl.props.refreshing).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------
describe('SettingsScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockStorageUpload.mockResolvedValue({ data: { url: 'https://example.com/avatar.jpg' } });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders the user email from the auth store', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders avatar placeholder initial from email first character', () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId('avatar-initial').props.children).toBe('T');
  });

  it('renders the "Sign Out" button', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Sign Out')).toBeTruthy();
  });

  it('renders the "Delete Account" button', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });

  it('pressing "Sign Out" shows the logout confirmation Alert', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sign Out'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Logout',
      'Are you sure you want to sign out?',
      expect.any(Array),
    );
  });

  it('confirming logout calls logout from the auth store', () => {
    mockLogout.mockResolvedValue(undefined);
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sign Out'));
    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const logoutBtn = alertButtons.find((b: any) => b.text === 'Logout');
    logoutBtn.onPress();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('cancelling logout does not call logout', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sign Out'));
    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const cancelBtn = alertButtons.find((b: any) => b.text === 'Cancel');
    if (cancelBtn.onPress) cancelBtn.onPress();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('pressing "Delete Account" first time reveals the DELETE confirmation input', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Delete Account'));
    await waitFor(() => {
      expect(screen.getByText('Type DELETE to confirm account deletion')).toBeTruthy();
    });
  });

  it('pressing "Delete Account" when input is not "DELETE" shows an error Alert', async () => {
    render(<SettingsScreen />);
    // First press reveals the input
    fireEvent.press(screen.getByText('Delete Account'));
    await waitFor(() => {
      expect(screen.getByText('Type DELETE to confirm account deletion')).toBeTruthy();
    });
    // Type wrong value
    const deleteInput = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(deleteInput, 'WRONG');
    // Second press with wrong input
    fireEvent.press(screen.getByText('Delete Account'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please type DELETE to confirm');
  });

  it('pressing "Delete Account" when input is "DELETE" shows the final confirm Alert', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Delete Account'));
    await waitFor(() => {
      expect(screen.getByText('Type DELETE to confirm account deletion')).toBeTruthy();
    });
    const deleteInput = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(deleteInput, 'DELETE');
    fireEvent.press(screen.getByText('Delete Account'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Account',
      expect.stringContaining('permanently delete'),
      expect.any(Array),
    );
  });

  it('confirming deletion calls deleteAccount from the auth store', async () => {
    mockDeleteAccount.mockResolvedValueOnce(undefined);
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Delete Account'));
    await waitFor(() => {
      expect(screen.getByText('Type DELETE to confirm account deletion')).toBeTruthy();
    });
    const deleteInput = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(deleteInput, 'DELETE');
    fireEvent.press(screen.getByText('Delete Account'));
    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const deleteForeverBtn = alertButtons.find((b: any) => b.text === 'Delete Forever');
    await act(async () => {
      await deleteForeverBtn.onPress();
    });
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it('calls Alert.alert with "Error" when deleteAccount throws', async () => {
    const err = Object.assign(new Error('Server error'), { response: { data: { detail: 'Server error' } } });
    mockDeleteAccount.mockRejectedValueOnce(err);
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Delete Account'));
    await waitFor(() => {
      expect(screen.getByText('Type DELETE to confirm account deletion')).toBeTruthy();
    });
    const deleteInput = screen.UNSAFE_getByType(require('react-native').TextInput);
    fireEvent.changeText(deleteInput, 'DELETE');
    fireEvent.press(screen.getByText('Delete Account'));
    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const deleteForeverBtn = alertButtons.find((b: any) => b.text === 'Delete Forever');
    await act(async () => {
      await deleteForeverBtn.onPress();
    });
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Server error');
    });
  });

  it('pressing "Tap to change avatar" calls launchImageLibraryAsync', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('avatar-pressable'));
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('when image picker is cancelled, storageService.upload is not called', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('avatar-pressable'));
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('when image picker succeeds, storageService.upload is called with correct FormData', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.jpg', mimeType: 'image/jpeg' }],
    });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('avatar-pressable'));
    // Wait for the picker to be called first, then the upload
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    });
    const formData = mockStorageUpload.mock.calls[0][0];
    expect(formData).toBeInstanceOf(FormData);
  });

  it('sets avatarUrl state and shows Image component after successful upload', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.jpg', mimeType: 'image/jpeg' }],
    });
    mockStorageUpload.mockResolvedValue({ data: { url: 'https://cdn.example.com/avatar.jpg' } });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('avatar-pressable'));
    // Wait for picker, then upload, then state update
    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockStorageUpload).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('avatar-image')).toBeTruthy();
    });
  });

  it('calls Alert.alert with "Upload Failed" when storageService.upload throws', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://photo.jpg', mimeType: 'image/jpeg' }],
    });
    // Use an error that matches what the screen's catch block reads:
    // error.response?.data?.detail || 'Could not upload avatar'
    mockStorageUpload.mockRejectedValueOnce(new Error('Could not upload avatar'));
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('avatar-pressable'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Upload Failed', 'Could not upload avatar');
    });
  });

  it('renders fallback text when user is null', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ user: null, login: mockLogin, signup: mockSignup, logout: mockLogout, deleteAccount: mockDeleteAccount, sendPhoneOtp: mockSendPhoneOtp, verifyPhoneOtp: mockVerifyPhoneOtp })
    );
    render(<SettingsScreen />);
    expect(screen.getByText('Unknown')).toBeTruthy();
    expect(screen.getByTestId('avatar-initial')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PhoneLogin Screen
// ---------------------------------------------------------------------------
describe('PhoneLoginScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: { id: 'user-1', email: 'test@example.com', phone: null },
        login: mockLogin,
        signup: mockSignup,
        logout: mockLogout,
        deleteAccount: mockDeleteAccount,
        sendPhoneOtp: mockSendPhoneOtp,
        verifyPhoneOtp: mockVerifyPhoneOtp,
      })
    );
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders "Phone Login" title on initial render', () => {
    render(<PhoneLoginScreen />);
    expect(screen.getByText('Phone Login')).toBeTruthy();
  });

  it('renders "Phone Number" input and "Send Code" button in phone step', () => {
    render(<PhoneLoginScreen />);
    expect(screen.getByText('Phone Number')).toBeTruthy();
    expect(screen.getByText('Send Code')).toBeTruthy();
  });

  it('shows error alert when phone is empty and Send Code is pressed', async () => {
    render(<PhoneLoginScreen />);
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter your phone number');
    });
  });

  it('calls sendPhoneOtp with phone number when phone is valid and Send Code is pressed', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(mockSendPhoneOtp).toHaveBeenCalledWith('+15551234567');
    });
  });

  it('transitions to OTP step after sendPhoneOtp resolves (shows "Verification Code" input and "Verify" button)', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByText('Verification Code')).toBeTruthy();
      expect(screen.getByText('Verify')).toBeTruthy();
    });
  });

  it('shows error alert when OTP is not 6 digits and Verify is pressed', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123');
    fireEvent.press(screen.getByText('Verify'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter the 6-digit code');
    });
  });

  it('calls verifyPhoneOtp with phone and otp when OTP is 6 digits and Verify is pressed', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    mockVerifyPhoneOtp.mockResolvedValueOnce(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    fireEvent.press(screen.getByText('Verify'));
    await waitFor(() => {
      expect(mockVerifyPhoneOtp).toHaveBeenCalledWith('+15551234567', '123456');
    });
  });

  it('shows error alert when verifyPhoneOtp throws', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    const err = Object.assign(new Error('Invalid OTP'), { response: { data: { detail: 'Invalid OTP' } } });
    mockVerifyPhoneOtp.mockRejectedValueOnce(err);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    fireEvent.press(screen.getByText('Verify'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Invalid OTP');
    });
  });

  it('shows error alert when sendPhoneOtp throws', async () => {
    const err = Object.assign(new Error('Failed to send OTP'), { response: { data: { detail: 'Failed to send OTP' } } });
    mockSendPhoneOtp.mockRejectedValueOnce(err);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to send OTP');
    });
  });

  it('"Resend Code" button appears in OTP step and calls sendPhoneOtp again', async () => {
    mockSendPhoneOtp.mockResolvedValue(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByText('Resend Code')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Resend Code'));
    await waitFor(() => {
      expect(mockSendPhoneOtp).toHaveBeenCalledTimes(2);
    });
  });

  it('renders "Back to Email Login" link with correct href', () => {
    render(<PhoneLoginScreen />);
    expect(screen.getByTestId('link-/(auth)/login')).toBeTruthy();
  });

  it('shows phone step subtitle on initial render', () => {
    render(<PhoneLoginScreen />);
    expect(screen.getByText('Enter your phone number to receive a code')).toBeTruthy();
  });

  it('shows OTP step subtitle after sendPhoneOtp resolves', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByText('Enter the 6-digit code sent to your phone')).toBeTruthy();
    });
  });

  it('shows loading spinner while sendPhoneOtp is in-flight', async () => {
    let resolve!: () => void;
    mockSendPhoneOtp.mockReturnValueOnce(new Promise<void>((res) => { resolve = res; }));
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
    });
    await act(async () => { resolve(); });
  });

  it('shows error alert when OTP is 6 non-numeric characters', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByPlaceholderText('000000'), 'abcdef');
    fireEvent.press(screen.getByText('Verify'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter the 6-digit code');
    });
  });

  it('shows error alert when Resend Code throws in OTP step', async () => {
    mockSendPhoneOtp.mockResolvedValueOnce(undefined);
    const err = Object.assign(new Error('Rate limited'), { response: { data: { detail: 'Rate limited' } } });
    mockSendPhoneOtp.mockRejectedValueOnce(err);
    render(<PhoneLoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => {
      expect(screen.getByText('Resend Code')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Resend Code'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Rate limited');
    });
  });
});
