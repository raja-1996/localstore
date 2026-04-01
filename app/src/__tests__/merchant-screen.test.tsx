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
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-merchant-id' }),
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
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
// Mock formatDistance
// ---------------------------------------------------------------------------
jest.mock('../utils/format-distance', () => ({
  formatDistance: (meters: number) => `${meters}m`,
}));

// ---------------------------------------------------------------------------
// Mock useMerchant
// ---------------------------------------------------------------------------
const mockMerchantData = {
  merchant: {
    id: 'test-merchant-id',
    name: 'Test Merchant',
    category: 'Beauty' as const,
    lat: 12.9716,
    lng: 77.5946,
    avg_rating: 4.5,
    review_count: 12,
    follower_count: 20,
    is_verified: true,
    distance_meters: 350,
    description: 'A great merchant for all your needs',
    address_text: '123 Main Street, Bangalore',
    neighborhood: 'Koramangala',
    service_radius_meters: 5000,
    tags: null,
    video_intro_url: null,
    phone: '+91****1234',
    whatsapp: null,
    response_time_minutes: null,
    is_active: true,
    is_owner: false,
    is_following: false,
    created_at: '2024-01-01T00:00:00Z',
  },
  services: [
    {
      id: 'service-1',
      merchant_id: 'test-merchant-id',
      name: 'Haircut',
      description: 'Premium haircut service',
      price: 500,
      price_unit: null,
      image_url: null,
      is_available: true,
      cancellation_policy: null,
      advance_percent: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ],
  portfolio: [
    {
      id: 'portfolio-1',
      merchant_id: 'test-merchant-id',
      image_url: 'https://example.com/image.jpg',
      caption: null,
      sort_order: 0,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
};

const mockUseMerchant = jest.fn(() => ({
  data: mockMerchantData,
  isLoading: false,
  isError: false,
}));

jest.mock('../hooks/use-merchant', () => ({
  useMerchant: (...args: any[]) => mockUseMerchant(...args),
}));

// ---------------------------------------------------------------------------
// Mock useFollow
// ---------------------------------------------------------------------------
jest.mock('../hooks/use-follow', () => ({
  useFollow: () => ({
    toggle: jest.fn(),
    isLoading: false,
    isFollowing: false,
    followerCount: 20,
  }),
}));

// ---------------------------------------------------------------------------
// Mock usePosts — infinite query for merchant posts (S8-F4)
// ---------------------------------------------------------------------------
const mockFetchNextPage = jest.fn();

const mockUsePosts = jest.fn(() => ({
  data: null as any,
  isLoading: false,
  isError: false,
  fetchNextPage: mockFetchNextPage,
  hasNextPage: false,
  isFetchingNextPage: false,
}));

jest.mock('../hooks/use-posts', () => ({
  usePosts: (...args: any[]) => mockUsePosts(...args),
}));

// ---------------------------------------------------------------------------
// Mock PostCard — renders a stub so we can assert on testID / text
// ---------------------------------------------------------------------------
jest.mock('../components/PostCard', () => ({
  PostCard: ({ item }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={`post-card-${item.id}`}>
        <Text>{item.content}</Text>
      </View>
    );
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import MerchantDetailScreen from '../app/(app)/merchant/[id]';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MerchantDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMerchant.mockReturnValue({
      data: mockMerchantData,
      isLoading: false,
      isError: false,
    });
  });

  it('shows skeleton loading when isLoading is true', () => {
    mockUseMerchant.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('skeleton-card')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    mockUseMerchant.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByText('Failed to load merchant')).toBeTruthy();
  });

  it('renders merchant name', () => {
    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('merchant-name')).toBeTruthy();
    expect(screen.getByText('Test Merchant')).toBeTruthy();
  });

  it('renders services section', () => {
    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('services-section')).toBeTruthy();
    expect(screen.getByText('Services')).toBeTruthy();
    expect(screen.getByText('Haircut')).toBeTruthy();
  });

  it('renders portfolio section', () => {
    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('portfolio-section')).toBeTruthy();
    expect(screen.getByText('Portfolio')).toBeTruthy();
  });

  it('renders contact section', () => {
    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('contact-section')).toBeTruthy();
    expect(screen.getByText('Contact')).toBeTruthy();
    expect(screen.getByText('+91****1234')).toBeTruthy();
  });

  it('shows "No services listed yet" when services array is empty', () => {
    mockUseMerchant.mockReturnValue({
      data: { ...mockMerchantData, services: [] },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByText('No services listed yet')).toBeTruthy();
  });

  it('shows "No reviews yet" in reviews placeholder', () => {
    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('reviews-section')).toBeTruthy();
    expect(screen.getByText('No reviews yet')).toBeTruthy();
  });

  it('calls router.back when back button is pressed', () => {
    render(<MerchantDetailScreen />);

    fireEvent.press(screen.getByTestId('back-button'));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — S8-T4: Posts section on merchant detail (S8-F7)
// ---------------------------------------------------------------------------

const makePost = (overrides?: Partial<any>) => ({
  id: 'post-1',
  merchant: {
    id: 'test-merchant-id',
    business_name: 'Test Merchant',
    avatar_url: null,
  },
  content: 'A brand new update!',
  image_url: null,
  post_type: 'update',
  like_count: 0,
  comment_count: 0,
  is_liked_by_me: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('PostsSection on MerchantDetailScreen (S8-T4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore base merchant data
    mockUseMerchant.mockReturnValue({
      data: mockMerchantData,
      isLoading: false,
      isError: false,
    });
    // Default: no posts
    mockUsePosts.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    });
  });

  // -------------------------------------------------------------------------
  // Test 1: Posts section renders PostCards from usePosts
  // -------------------------------------------------------------------------
  it('renders PostCards for each post returned by usePosts', () => {
    const posts = [
      makePost({ id: 'post-1', content: 'First post content' }),
      makePost({ id: 'post-2', content: 'Second post content' }),
    ];

    mockUsePosts.mockReturnValue({
      data: { pages: [{ data: posts, next_cursor: null, has_more: false }] },
      isLoading: false,
      isError: false,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('posts-section')).toBeTruthy();
    expect(screen.getByTestId('post-card-post-1')).toBeTruthy();
    expect(screen.getByTestId('post-card-post-2')).toBeTruthy();
    expect(screen.getByText('First post content')).toBeTruthy();
    expect(screen.getByText('Second post content')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 2: Posts section shows "No posts yet" empty state
  // -------------------------------------------------------------------------
  it('shows "No posts yet" when posts list is empty', () => {
    mockUsePosts.mockReturnValue({
      data: { pages: [{ data: [], next_cursor: null, has_more: false }] },
      isLoading: false,
      isError: false,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('posts-section')).toBeTruthy();
    expect(screen.getByText('No posts yet')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 3: Infinite scroll triggers fetchNextPage when hasNextPage is true
  // -------------------------------------------------------------------------
  it('calls fetchNextPage when end of list is reached and hasNextPage is true', async () => {
    const posts = [
      makePost({ id: 'post-1', content: 'First post' }),
    ];

    mockUsePosts.mockReturnValue({
      data: { pages: [{ data: posts, next_cursor: 'cursor-abc', has_more: true }] },
      isLoading: false,
      isError: false,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    render(<MerchantDetailScreen />);

    const postsList = screen.getByTestId('posts-list');
    fireEvent(postsList, 'onEndReached');

    await waitFor(() => {
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });
  });
});
