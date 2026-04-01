import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

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
const mockRouterBack = jest.fn();
const mockSetOptions = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
  useLocalSearchParams: () => ({ threadId: 'thread-1', merchantName: 'Test Salon' }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

// ---------------------------------------------------------------------------
// Mock expo-image
// ---------------------------------------------------------------------------
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// ---------------------------------------------------------------------------
// Mock SkeletonCard
// ---------------------------------------------------------------------------
jest.mock('../components/SkeletonCard', () => ({
  SkeletonCard: ({ count }: any) => {
    const { View } = require('react-native');
    return <View testID="skeleton-card" accessibilityLabel={`skeleton-${count}`} />;
  },
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore
// ---------------------------------------------------------------------------
jest.mock('../stores/auth-store', () => ({
  useAuthStore: (selector: any) =>
    selector({ user: { id: 'user-abc' }, isAuthenticated: true }),
}));

// ---------------------------------------------------------------------------
// Mock useChatStore
// ---------------------------------------------------------------------------
const mockSetTotalUnread = jest.fn();
const mockIncrementUnread = jest.fn();

jest.mock('../stores/chat-store', () => ({
  useChatStore: (selector: any) =>
    selector({
      totalUnread: 0,
      setTotalUnread: mockSetTotalUnread,
      incrementUnread: mockIncrementUnread,
      decrementUnread: jest.fn(),
    }),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase — stub channel/subscribe so realtime doesn't throw
// ---------------------------------------------------------------------------
const mockSubscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
const mockChannel = jest.fn(() => ({
  on: jest.fn().mockReturnThis(),
  subscribe: mockSubscribe,
}));
const mockRemoveChannel = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    channel: (...args: any[]) => mockChannel(...args),
    removeChannel: (...args: any[]) => mockRemoveChannel(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock use-chat hooks
// ---------------------------------------------------------------------------
const mockUseThreads = jest.fn();
const mockUseMessages = jest.fn();
const mockSendMutate = jest.fn();
const mockMarkReadMutate = jest.fn();
const mockUseSendMessage = jest.fn();
const mockUseMarkRead = jest.fn();
const mockUseChatRealtime = jest.fn();
const mockUseCreateThread = jest.fn();

jest.mock('../hooks/use-chat', () => ({
  useThreads: (...args: any[]) => mockUseThreads(...args),
  useMessages: (...args: any[]) => mockUseMessages(...args),
  useSendMessage: (...args: any[]) => mockUseSendMessage(...args),
  useMarkRead: (...args: any[]) => mockUseMarkRead(...args),
  useCreateThread: (...args: any[]) => mockUseCreateThread(...args),
  useChatRealtime: (...args: any[]) => mockUseChatRealtime(...args),
  activeChatThreadRef: { current: null },
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
const makeThread = (overrides = {}) => ({
  id: 'thread-1',
  user_id: 'user-abc',
  merchant_id: 'merchant-1',
  merchant: { id: 'merchant-1', name: 'Test Salon', avatar_url: null },
  last_message: 'Hello!',
  last_message_at: '2026-03-29T12:00:00Z',
  unread_count: 0,
  created_at: '2026-03-29T10:00:00Z',
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: 'msg-1',
  thread_id: 'thread-1',
  sender_id: 'user-abc',
  content: 'Hello!',
  read_by_user: true,
  read_by_merchant: false,
  created_at: '2026-03-29T12:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Default hook return values
// ---------------------------------------------------------------------------
const defaultThreadsReturn = () => ({
  data: { pages: [{ data: [], next_cursor: null, has_more: false }] },
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isRefetching: false,
});

const defaultMessagesReturn = () => ({
  data: { pages: [{ data: [], next_cursor: null, has_more: false }] },
  isLoading: false,
  isError: false,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import ChatListScreen from '../app/(app)/chat/index';
import ChatDetailScreen from '../app/(app)/chat/[threadId]';

// ---------------------------------------------------------------------------
// Tests — ChatListScreen (S10-T2)
// ---------------------------------------------------------------------------
describe('ChatListScreen (S10-T2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseThreads.mockReturnValue(defaultThreadsReturn());
    mockUseSendMessage.mockReturnValue({ mutate: mockSendMutate, isPending: false });
    mockUseMarkRead.mockReturnValue({ mutate: mockMarkReadMutate });
    mockUseChatRealtime.mockReturnValue(undefined);
    mockUseCreateThread.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  // -------------------------------------------------------------------------
  // Test 1: Renders loading state when isLoading=true
  // -------------------------------------------------------------------------
  it('renders loading skeleton when isLoading is true', () => {
    mockUseThreads.mockReturnValue({
      ...defaultThreadsReturn(),
      data: undefined,
      isLoading: true,
    });

    render(<ChatListScreen />);

    expect(screen.getByTestId('skeleton-card')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 2: Renders thread rows with merchant names
  // -------------------------------------------------------------------------
  it('renders thread rows with merchant names', () => {
    const threads = [
      makeThread({ id: 'thread-1', merchant: { id: 'm-1', name: 'Test Salon', avatar_url: null } }),
      makeThread({ id: 'thread-2', merchant: { id: 'm-2', name: 'Quick Cuts', avatar_url: null } }),
    ];

    mockUseThreads.mockReturnValue({
      ...defaultThreadsReturn(),
      data: { pages: [{ data: threads, next_cursor: null, has_more: false }] },
    });

    render(<ChatListScreen />);

    expect(screen.getByTestId('chat-thread-row-thread-1')).toBeTruthy();
    expect(screen.getByTestId('chat-thread-row-thread-2')).toBeTruthy();
    expect(screen.getByText('Test Salon')).toBeTruthy();
    expect(screen.getByText('Quick Cuts')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 3: Shows unread badge when thread.unread_count > 0
  // -------------------------------------------------------------------------
  it('shows unread badge when thread has unread messages', () => {
    const threads = [makeThread({ id: 'thread-1', unread_count: 3 })];

    mockUseThreads.mockReturnValue({
      ...defaultThreadsReturn(),
      data: { pages: [{ data: threads, next_cursor: null, has_more: false }] },
    });

    render(<ChatListScreen />);

    expect(screen.getByTestId('thread-unread-badge-thread-1')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 4: Hides unread badge when thread.unread_count === 0
  // -------------------------------------------------------------------------
  it('does not show unread badge when unread_count is zero', () => {
    const threads = [makeThread({ id: 'thread-1', unread_count: 0 })];

    mockUseThreads.mockReturnValue({
      ...defaultThreadsReturn(),
      data: { pages: [{ data: threads, next_cursor: null, has_more: false }] },
    });

    render(<ChatListScreen />);

    expect(screen.queryByTestId('thread-unread-badge-thread-1')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 5: Shows "No conversations yet" when thread list is empty
  // -------------------------------------------------------------------------
  it('shows empty state message when there are no threads', () => {
    mockUseThreads.mockReturnValue({
      ...defaultThreadsReturn(),
      data: { pages: [{ data: [], next_cursor: null, has_more: false }] },
    });

    render(<ChatListScreen />);

    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 6: Navigates to chat detail on thread row press
  // -------------------------------------------------------------------------
  it('navigates to chat detail screen when a thread row is pressed', () => {
    const threads = [makeThread({ id: 'thread-1', merchant: { id: 'm-1', name: 'Test Salon', avatar_url: null } })];

    mockUseThreads.mockReturnValue({
      ...defaultThreadsReturn(),
      data: { pages: [{ data: threads, next_cursor: null, has_more: false }] },
    });

    render(<ChatListScreen />);

    fireEvent.press(screen.getByTestId('chat-thread-row-thread-1'));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/chat/[threadId]',
        params: expect.objectContaining({ threadId: 'thread-1' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — ChatDetailScreen (S10-T2)
// ---------------------------------------------------------------------------
describe('ChatDetailScreen (S10-T2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMessages.mockReturnValue(defaultMessagesReturn());
    mockUseSendMessage.mockReturnValue({ mutate: mockSendMutate, isPending: false });
    mockUseMarkRead.mockReturnValue({ mutate: mockMarkReadMutate });
    mockUseChatRealtime.mockReturnValue(undefined);
    mockUseCreateThread.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseThreads.mockReturnValue(defaultThreadsReturn());
  });

  // -------------------------------------------------------------------------
  // Test 1: Renders loading state when isLoading=true
  // -------------------------------------------------------------------------
  it('renders loading skeleton when isLoading is true', () => {
    mockUseMessages.mockReturnValue({
      ...defaultMessagesReturn(),
      data: undefined,
      isLoading: true,
    });

    render(<ChatDetailScreen />);

    expect(screen.getByTestId('skeleton-card')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 2: Renders message bubbles
  // -------------------------------------------------------------------------
  it('renders message bubbles for each message', () => {
    const messages = [
      makeMessage({ id: 'msg-1', content: 'Hello there!', sender_id: 'user-abc' }),
      makeMessage({ id: 'msg-2', content: 'Hi back!', sender_id: 'merchant-1' }),
    ];

    mockUseMessages.mockReturnValue({
      ...defaultMessagesReturn(),
      data: { pages: [{ data: messages, next_cursor: null, has_more: false }] },
    });

    render(<ChatDetailScreen />);

    expect(screen.getByTestId('message-bubble-msg-1')).toBeTruthy();
    expect(screen.getByTestId('message-bubble-msg-2')).toBeTruthy();
    expect(screen.getByText('Hello there!')).toBeTruthy();
    expect(screen.getByText('Hi back!')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 3: Send button calls sendMessage mutation with input text
  // -------------------------------------------------------------------------
  it('calls sendMessage mutation with typed text when send button is pressed', () => {
    render(<ChatDetailScreen />);

    fireEvent.changeText(screen.getByTestId('message-input'), 'Hey there!');
    fireEvent.press(screen.getByTestId('send-button'));

    expect(mockSendMutate).toHaveBeenCalledTimes(1);
    expect(mockSendMutate).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'thread-1', content: 'Hey there!' }),
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: Input is cleared after send
  // -------------------------------------------------------------------------
  it('clears the input field after sending a message', async () => {
    render(<ChatDetailScreen />);

    const input = screen.getByTestId('message-input');

    fireEvent.changeText(input, 'A message to send');
    fireEvent.press(screen.getByTestId('send-button'));

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: markRead is called on mount
  // -------------------------------------------------------------------------
  it('calls markRead mutation on mount with the threadId', () => {
    render(<ChatDetailScreen />);

    expect(mockMarkReadMutate).toHaveBeenCalledTimes(1);
    expect(mockMarkReadMutate).toHaveBeenCalledWith({ threadId: 'thread-1' });
  });

  // -------------------------------------------------------------------------
  // Test 6: useChatRealtime is called with the threadId param
  // -------------------------------------------------------------------------
  it('invokes useChatRealtime with the threadId from route params', () => {
    render(<ChatDetailScreen />);

    expect(mockUseChatRealtime).toHaveBeenCalledWith('thread-1');
  });
});
