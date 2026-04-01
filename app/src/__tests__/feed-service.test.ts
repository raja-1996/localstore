import { feedService } from '../services/feed-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
}));

// Intentional partial mock: feed-service only uses `get`.
const mockApi = api as jest.Mocked<typeof api>;

const mockFeedResponse = {
  data: {
    data: [
      {
        type: 'merchant' as const,
        id: 'merchant-1',
        name: 'Raja Tailors',
        category: 'Tailoring' as const,
        lat: 12.9716,
        lng: 77.5946,
        avg_rating: 4.5,
        review_count: 10,
        follower_count: 50,
        is_verified: true,
        distance_meters: 300,
        description: 'Expert tailoring',
        neighborhood: 'Koramangala',
        tags: ['tailoring', 'alterations'],
      },
    ],
    has_more: false,
    next_cursor: null,
  },
};

describe('feedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNearbyFeed', () => {
    it('calls GET /feed/nearby with lat, lng, radius, and limit', async () => {
      mockApi.get.mockResolvedValueOnce(mockFeedResponse);
      await feedService.getNearbyFeed({
        lat: 12.9716,
        lng: 77.5946,
        radius_meters: 5000,
        limit: 20,
      });
      expect(mockApi.get).toHaveBeenCalledWith('/feed/nearby', {
        params: { lat: 12.9716, lng: 77.5946, radius_meters: 5000, limit: 20 },
      });
    });

    it('passes before param when cursor is provided', async () => {
      mockApi.get.mockResolvedValueOnce(mockFeedResponse);
      await feedService.getNearbyFeed({
        lat: 12.9716,
        lng: 77.5946,
        cursor: 'cursor-abc123',
      });
      expect(mockApi.get).toHaveBeenCalledWith('/feed/nearby', {
        params: { lat: 12.9716, lng: 77.5946, before: 'cursor-abc123' },
      });
    });

    it('passes category param when category is provided', async () => {
      mockApi.get.mockResolvedValueOnce(mockFeedResponse);
      await feedService.getNearbyFeed({
        lat: 12.9716,
        lng: 77.5946,
        category: 'Beauty',
      });
      expect(mockApi.get).toHaveBeenCalledWith('/feed/nearby', {
        params: { lat: 12.9716, lng: 77.5946, category: 'Beauty' },
      });
    });

    it('omits before and category when both are null', async () => {
      mockApi.get.mockResolvedValueOnce(mockFeedResponse);
      await feedService.getNearbyFeed({
        lat: 12.9716,
        lng: 77.5946,
        cursor: null,
        category: null,
      });
      const call = mockApi.get.mock.calls[0];
      expect(call[1]?.params).not.toHaveProperty('before');
      expect(call[1]?.params).not.toHaveProperty('category');
    });

    it('returns typed NearbyFeedResponse on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockFeedResponse);
      const result = await feedService.getNearbyFeed({ lat: 12.9716, lng: 77.5946 });
      expect(result.data.data[0].type).toBe('merchant');
      expect(result.data.has_more).toBe(false);
      expect(result.data.next_cursor).toBeNull();
    });

    it('rejects on API error', async () => {
      const error = { response: { status: 500, data: { detail: 'Internal server error' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(
        feedService.getNearbyFeed({ lat: 12.9716, lng: 77.5946 })
      ).rejects.toMatchObject({ response: { status: 500 } });
    });
  });
});
