import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'merchant-123' }),
  useRouter: () => ({ back: mockRouterBack, replace: mockRouterReplace }),
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
jest.mock('../components/SkeletonCard', () => {
  const { View } = require('react-native');
  return {
    SkeletonCard: ({ count }: any) => (
      <View testID="skeleton-card" accessibilityLabel={`skeleton-${count}`} />
    ),
  };
});

// ---------------------------------------------------------------------------
// Mock StarRating — renders stars as touchable items by index
// ---------------------------------------------------------------------------
jest.mock('../components/StarRating', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    StarRating: ({ rating, interactive, onRatingChange, size }: any) => {
      if (!interactive) {
        return (
          <View testID="star-rating" accessibilityLabel={`rating-${rating}`}>
            <Text>{rating}</Text>
          </View>
        );
      }
      return (
        <View testID="star-rating-picker">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              testID={`star-${star}`}
              onPress={() => onRatingChange && onRatingChange(star)}
            >
              <Text>{star <= rating ? '★' : '☆'}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
  };
});

// ---------------------------------------------------------------------------
// Mock formatDistance
// ---------------------------------------------------------------------------
jest.mock('../utils/format-distance', () => ({
  formatDistance: (meters: number) => `${meters}m`,
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore
// ---------------------------------------------------------------------------
jest.mock('../stores/auth-store', () => ({
  useAuthStore: (selector: any) =>
    selector({ user: { id: 'user-abc' } }),
}));

// ---------------------------------------------------------------------------
// Mock useFollow
// ---------------------------------------------------------------------------
const mockFollowToggle = jest.fn();

jest.mock('../hooks/use-follow', () => ({
  useFollow: () => ({
    toggle: mockFollowToggle,
    isLoading: false,
    isFollowing: false,
    followerCount: 10,
  }),
}));

// ---------------------------------------------------------------------------
// Mock useMerchant
// ---------------------------------------------------------------------------
const mockMerchantBase = {
  id: 'merchant-123',
  name: 'Test Salon',
  category: 'Beauty' as const,
  lat: 12.9716,
  lng: 77.5946,
  avg_rating: 4.2,
  review_count: 3,
  follower_count: 15,
  is_verified: true,
  distance_meters: 200,
  description: 'Great salon',
  address_text: '1 Test Street',
  neighborhood: 'Koramangala',
  service_radius_meters: 3000,
  tags: null,
  video_intro_url: null,
  phone: '+91****5678',
  whatsapp: null,
  response_time_minutes: null,
  is_active: true,
  is_owner: false,
  is_following: false,
  created_at: '2024-01-01T00:00:00Z',
};

const mockMerchantData = {
  merchant: mockMerchantBase,
  services: [],
  portfolio: [],
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
// Mock useReviews + mutation hooks
// ---------------------------------------------------------------------------
const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();
const mockDeleteMutate = jest.fn();

const mockUseReviews = jest.fn(() => ({
  data: {
    data: [],
    avg_rating: 0,
    count: 0,
  },
  isLoading: false,
  isError: false,
}));

jest.mock('../hooks/use-reviews', () => ({
  useReviews: (...args: any[]) => mockUseReviews(...args),
  useCreateReview: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateReview: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
  useDeleteReview: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import MerchantDetailScreen from '../app/(app)/merchant/[id]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sampleReview = {
  id: 'review-1',
  merchant_id: 'merchant-123',
  reviewer: {
    id: 'other-user-id',
    display_name: 'Jane Smith',
    avatar_url: null,
  },
  rating: 4,
  body: 'Really loved the service here.',
  is_verified_purchase: false,
  created_at: '2024-06-15T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests — S7-T4: ReviewsSection
// ---------------------------------------------------------------------------
describe('ReviewsSection (S7-T4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReviews.mockReturnValue({
      data: { data: [], avg_rating: 0, count: 0 },
      isLoading: false,
      isError: false,
    });
  });

  // -------------------------------------------------------------------------
  // Test 1: renders review list with reviewer name, star count, body text
  // -------------------------------------------------------------------------
  it('renders review list with reviewer name, star count, and body text', () => {
    mockUseReviews.mockReturnValue({
      data: {
        data: [sampleReview],
        avg_rating: 4,
        count: 1,
      },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('review-card-review-1')).toBeTruthy();
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(screen.getByText('Really loved the service here.')).toBeTruthy();
    expect(screen.getByTestId('reviews-section')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 2: shows "No reviews yet" when data is empty
  // -------------------------------------------------------------------------
  it('shows "No reviews yet" when review list is empty', () => {
    mockUseReviews.mockReturnValue({
      data: { data: [], avg_rating: 0, count: 0 },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByText('No reviews yet')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 3: shows loading state while isLoading=true (not the review list)
  // -------------------------------------------------------------------------
  it('shows loading indicator and not review cards while isLoading is true', () => {
    mockUseReviews.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    // ActivityIndicator is rendered — no review cards
    expect(screen.getByTestId('reviews-section')).toBeTruthy();
    expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
    expect(screen.queryByTestId('review-card-review-1')).toBeNull();
    expect(screen.queryByText('No reviews yet')).toBeNull();
    expect(screen.queryByText('Failed to load reviews')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 4: shows "Failed to load reviews" when isError=true
  // -------------------------------------------------------------------------
  it('shows "Failed to load reviews" when isError is true', () => {
    mockUseReviews.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByText('Failed to load reviews')).toBeTruthy();
    expect(screen.queryByTestId('review-card-review-1')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 5: "Write a Review" button present for non-owner (is_owner=false)
  // -------------------------------------------------------------------------
  it('shows "Write a Review" button for a non-owner user', () => {
    mockUseMerchant.mockReturnValue({
      data: {
        ...mockMerchantData,
        merchant: { ...mockMerchantBase, is_owner: false },
      },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.getByTestId('write-review-button')).toBeTruthy();
    expect(screen.getByText('Write a Review')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 6: "Write a Review" button NOT present for merchant owner (is_owner=true)
  // -------------------------------------------------------------------------
  it('does NOT show "Write a Review" button when is_owner is true', () => {
    mockUseMerchant.mockReturnValue({
      data: {
        ...mockMerchantData,
        merchant: { ...mockMerchantBase, is_owner: true },
      },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    expect(screen.queryByTestId('write-review-button')).toBeNull();
    expect(screen.queryByText('Write a Review')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 7: tapping "Write a Review" opens the review modal (review-modal visible)
  // -------------------------------------------------------------------------
  it('opens the review modal when "Write a Review" button is tapped', async () => {
    mockUseMerchant.mockReturnValue({
      data: {
        ...mockMerchantData,
        merchant: { ...mockMerchantBase, is_owner: false },
      },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    fireEvent.press(screen.getByTestId('write-review-button'));

    await waitFor(() => {
      expect(screen.getByTestId('review-modal')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: submit button is disabled when no star rating is selected
  // -------------------------------------------------------------------------
  it('submit button is disabled when no star rating is selected (rating=0)', async () => {
    mockUseMerchant.mockReturnValue({
      data: {
        ...mockMerchantData,
        merchant: { ...mockMerchantBase, is_owner: false },
      },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    // Open the modal
    fireEvent.press(screen.getByTestId('write-review-button'));

    await waitFor(() => {
      expect(screen.getByTestId('review-submit-button')).toBeTruthy();
    });

    // Do NOT select a rating — tap submit without a rating selected
    fireEvent.press(screen.getByTestId('review-submit-button'));

    // Button should be a no-op: createReview.mutate must not be called
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 9: submit calls createReview with correct payload (rating + body)
  // -------------------------------------------------------------------------
  it('calls createReview mutate with correct payload on submit', async () => {
    mockUseMerchant.mockReturnValue({
      data: {
        ...mockMerchantData,
        merchant: { ...mockMerchantBase, is_owner: false },
      },
      isLoading: false,
      isError: false,
    });

    render(<MerchantDetailScreen />);

    // Open the modal
    fireEvent.press(screen.getByTestId('write-review-button'));

    await waitFor(() => {
      expect(screen.getByTestId('review-modal')).toBeTruthy();
    });

    // Select a star rating (tap star 4)
    fireEvent.press(screen.getByTestId('star-4'));

    // Enter body text
    fireEvent.changeText(screen.getByTestId('review-body-input'), 'Excellent service!');

    // Submit
    fireEvent.press(screen.getByTestId('review-submit-button'));

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    expect(mockCreateMutate).toHaveBeenCalledWith(
      {
        merchantId: 'merchant-123',
        payload: {
          rating: 4,
          body: 'Excellent service!',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  // -------------------------------------------------------------------------
  // Test 10: 409 response shows "You've already reviewed this merchant"
  // -------------------------------------------------------------------------
  it('shows duplicate review alert when server returns 409', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    try {
      // Simulate createReview.mutate invoking onError with a 409 error
      mockCreateMutate.mockImplementation((_vars: any, callbacks: any) => {
        const err = new Error('Conflict') as any;
        err.response = { status: 409 };
        callbacks?.onError?.(err);
      });

      mockUseMerchant.mockReturnValue({
        data: {
          ...mockMerchantData,
          merchant: { ...mockMerchantBase, is_owner: false },
        },
        isLoading: false,
        isError: false,
      });

      render(<MerchantDetailScreen />);

      // Open modal
      fireEvent.press(screen.getByTestId('write-review-button'));

      await waitFor(() => {
        expect(screen.getByTestId('review-modal')).toBeTruthy();
      });

      // Select a rating so submit is enabled
      fireEvent.press(screen.getByTestId('star-5'));

      // Submit
      fireEvent.press(screen.getByTestId('review-submit-button'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        "You've already reviewed this merchant",
      );
    } finally {
      alertSpy.mockRestore();
    }
  });
});
