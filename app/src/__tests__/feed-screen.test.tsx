import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
  useLocalSearchParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Mock expo-image
// ---------------------------------------------------------------------------
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// ---------------------------------------------------------------------------
// Mock @shopify/flash-list — render as FlatList in tests
// ---------------------------------------------------------------------------
jest.mock('@shopify/flash-list', () => ({
  FlashList: require('react-native').FlatList,
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore
// ---------------------------------------------------------------------------
jest.mock('../stores/auth-store', () => ({
  useAuthStore: (selector: any) =>
    selector({ user: { id: 'user-abc' } }),
}));

// ---------------------------------------------------------------------------
// Mock useLike — optimistic like/unlike mutation
// ---------------------------------------------------------------------------
const mockLikeMutate = jest.fn();

const mockUseLike = jest.fn(() => ({
  mutate: mockLikeMutate,
  isPending: false,
}));

jest.mock('../hooks/use-like', () => ({
  useLike: (...args: any[]) => mockUseLike(...args),
}));

// ---------------------------------------------------------------------------
// Mock useComments + useCreateComment
// ---------------------------------------------------------------------------
const mockCreateCommentMutate = jest.fn();

const mockUseComments = jest.fn(() => ({
  data: { data: [], count: 0 },
  isLoading: false,
  isError: false,
}));

const mockUseCreateComment = jest.fn(() => ({
  mutate: mockCreateCommentMutate,
  isPending: false,
}));

jest.mock('../hooks/use-comments', () => ({
  useComments: (...args: any[]) => mockUseComments(...args),
  useCreateComment: (...args: any[]) => mockUseCreateComment(...args),
}));

// ---------------------------------------------------------------------------
// Helpers — shared test data
// ---------------------------------------------------------------------------
const makePost = (overrides?: Partial<any>) => ({
  id: 'post-1',
  merchant: {
    id: 'merchant-123',
    business_name: 'Test Salon',
    avatar_url: null,
  },
  content: 'Hello from Test Salon!',
  image_url: null,
  post_type: 'update',
  like_count: 5,
  comment_count: 2,
  is_liked_by_me: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeComment = (overrides?: Partial<any>) => ({
  id: 'comment-1',
  post_id: 'post-1',
  user: {
    id: 'user-abc',
    display_name: 'Alice',
    avatar_url: null,
  },
  content: 'Great post!',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { PostCard } from '../components/PostCard';

// ---------------------------------------------------------------------------
// Tests — S8-T4: PostCard interactions
// ---------------------------------------------------------------------------
describe('PostCard (S8-T4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLike.mockReturnValue({ mutate: mockLikeMutate, isPending: false });
    mockUseComments.mockReturnValue({ data: { data: [], count: 0 }, isLoading: false, isError: false });
    mockUseCreateComment.mockReturnValue({ mutate: mockCreateCommentMutate, isPending: false });
  });

  // -------------------------------------------------------------------------
  // Test 1: PostCard renders like_count
  // -------------------------------------------------------------------------
  it('renders like_count from post data', () => {
    const post = makePost({ like_count: 7 });

    render(<PostCard item={post} />);

    expect(screen.getByTestId('post-like-count')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 2: PostCard renders comment_count
  // -------------------------------------------------------------------------
  it('renders comment_count from post data', () => {
    const post = makePost({ comment_count: 3 });

    render(<PostCard item={post} />);

    expect(screen.getByTestId('post-comment-count')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 3: Tapping like button calls useLike mutation
  // -------------------------------------------------------------------------
  it('calls useLike mutate when like button is tapped', () => {
    const post = makePost({ like_count: 5, is_liked_by_me: false });

    render(<PostCard item={post} />);

    fireEvent.press(screen.getByTestId('post-like-button'));

    expect(mockLikeMutate).toHaveBeenCalledTimes(1);
    expect(mockLikeMutate).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'post-1', liked: false }),
      expect.anything(),
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: Optimistic like_count increment on tap
  // -------------------------------------------------------------------------
  it('optimistically increments like_count when like button is tapped', async () => {
    const post = makePost({ like_count: 5, is_liked_by_me: false });

    render(<PostCard item={post} />);

    // Before tap — shows 5
    expect(screen.getByText('5')).toBeTruthy();

    fireEvent.press(screen.getByTestId('post-like-button'));

    // After tap — optimistically shows 6
    await waitFor(() => {
      expect(screen.getByText('6')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Tapping again (unlike) decrements like_count
  // -------------------------------------------------------------------------
  it('optimistically decrements like_count when liked post is tapped again', async () => {
    const post = makePost({ like_count: 8, is_liked_by_me: true });

    render(<PostCard item={post} />);

    // Before tap — shows 8
    expect(screen.getByText('8')).toBeTruthy();

    fireEvent.press(screen.getByTestId('post-like-button'));

    // After tap — optimistically shows 7
    await waitFor(() => {
      expect(screen.getByText('7')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: Tapping comment icon opens CommentsBottomSheet
  // -------------------------------------------------------------------------
  it('opens CommentsBottomSheet when comment button is tapped', async () => {
    const post = makePost({ comment_count: 2 });

    render(<PostCard item={post} />);

    fireEvent.press(screen.getByTestId('post-comment-button'));

    await waitFor(() => {
      expect(screen.getByTestId('comments-bottom-sheet')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Test 7: CommentsBottomSheet renders comment list
  // -------------------------------------------------------------------------
  it('CommentsBottomSheet renders comment list from useComments', async () => {
    const comments = [
      makeComment({ id: 'comment-1', content: 'Great post!' }),
      makeComment({ id: 'comment-2', content: 'Love this!', user: { id: 'user-xyz', display_name: 'Bob', avatar_url: null } }),
    ];

    mockUseComments.mockReturnValue({
      data: { data: comments, count: 2 },
      isLoading: false,
      isError: false,
    });

    const post = makePost({ comment_count: 2 });

    render(<PostCard item={post} />);

    // Open the sheet
    fireEvent.press(screen.getByTestId('post-comment-button'));

    await waitFor(() => {
      expect(screen.getByTestId('comments-bottom-sheet')).toBeTruthy();
      expect(screen.getByTestId('comment-item-comment-1')).toBeTruthy();
      expect(screen.getByTestId('comment-item-comment-2')).toBeTruthy();
      expect(screen.getByText('Great post!')).toBeTruthy();
      expect(screen.getByText('Love this!')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: CommentsBottomSheet shows empty state when no comments
  // -------------------------------------------------------------------------
  it('CommentsBottomSheet shows empty state when comments list is empty', async () => {
    mockUseComments.mockReturnValue({
      data: { data: [], count: 0 },
      isLoading: false,
      isError: false,
    });

    const post = makePost({ comment_count: 0 });

    render(<PostCard item={post} />);

    fireEvent.press(screen.getByTestId('post-comment-button'));

    await waitFor(() => {
      expect(screen.getByTestId('comments-bottom-sheet')).toBeTruthy();
      expect(screen.getByText('No comments yet')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Test 9: CommentsBottomSheet submit calls createComment mutation
  // -------------------------------------------------------------------------
  it('CommentsBottomSheet submit calls createComment with content', async () => {
    const post = makePost({ comment_count: 0 });

    render(<PostCard item={post} />);

    // Open sheet
    fireEvent.press(screen.getByTestId('post-comment-button'));

    await waitFor(() => {
      expect(screen.getByTestId('comments-bottom-sheet')).toBeTruthy();
    });

    // Type a comment
    fireEvent.changeText(screen.getByTestId('comment-input'), 'Awesome!');

    // Submit
    fireEvent.press(screen.getByTestId('comment-submit-button'));

    expect(mockCreateCommentMutate).toHaveBeenCalledTimes(1);
    expect(mockCreateCommentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'post-1', content: 'Awesome!' }),
      expect.anything(),
    );
  });
});
