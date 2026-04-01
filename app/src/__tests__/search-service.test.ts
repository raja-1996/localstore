import { searchService } from '../services/search-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
}));

// Intentional partial mock: search-service only uses `get`.
const mockApi = api as jest.Mocked<typeof api>;

const mockSearchResponse = {
  data: {
    merchants: [
      {
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
        neighborhood: 'Koramangala',
      },
    ],
    services: [],
  },
};

describe('searchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchMerchants', () => {
    it('calls GET /search with q, lat, lng params', async () => {
      mockApi.get.mockResolvedValueOnce(mockSearchResponse);
      await searchService.searchMerchants({ q: 'tailor', lat: 12.9716, lng: 77.5946 });
      expect(mockApi.get).toHaveBeenCalledWith('/search', {
        params: { q: 'tailor', lat: 12.9716, lng: 77.5946 },
      });
    });

    it('includes category param when category is provided', async () => {
      mockApi.get.mockResolvedValueOnce(mockSearchResponse);
      await searchService.searchMerchants({
        q: 'beauty',
        lat: 12.9716,
        lng: 77.5946,
        category: 'Beauty',
      });
      expect(mockApi.get).toHaveBeenCalledWith('/search', {
        params: { q: 'beauty', lat: 12.9716, lng: 77.5946, category: 'Beauty' },
      });
    });

    it('omits category param when category is null', async () => {
      mockApi.get.mockResolvedValueOnce(mockSearchResponse);
      await searchService.searchMerchants({
        q: 'tailor',
        lat: 12.9716,
        lng: 77.5946,
        category: null,
      });
      const call = mockApi.get.mock.calls[0];
      expect(call[1]?.params).not.toHaveProperty('category');
    });

    it('omits category param when category is undefined', async () => {
      mockApi.get.mockResolvedValueOnce(mockSearchResponse);
      await searchService.searchMerchants({
        q: 'tailor',
        lat: 12.9716,
        lng: 77.5946,
        category: undefined,
      });
      const call = mockApi.get.mock.calls[0];
      expect(call[1]?.params).not.toHaveProperty('category');
    });

    it('returns SearchResponse data on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockSearchResponse);
      const result = await searchService.searchMerchants({ q: 'tailor', lat: 12.9716, lng: 77.5946 });
      expect(result.data.merchants).toHaveLength(1);
      expect(result.data.merchants[0].name).toBe('Raja Tailors');
      expect(result.data.services).toHaveLength(0);
    });

    it('rejects on API error', async () => {
      const error = { response: { status: 500, data: { detail: 'Internal server error' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(
        searchService.searchMerchants({ q: 'tailor', lat: 12.9716, lng: 77.5946 })
      ).rejects.toMatchObject({ response: { status: 500 } });
    });

    it('calls with correct default limit when not specified', async () => {
      mockApi.get.mockResolvedValueOnce(mockSearchResponse);
      await searchService.searchMerchants({ q: 'tailor', lat: 12.9716, lng: 77.5946 });
      // No limit in call params — service does not inject a default limit
      const call = mockApi.get.mock.calls[0];
      expect(call[0]).toBe('/search');
      expect(call[1]?.params).toHaveProperty('q', 'tailor');
      expect(call[1]?.params).toHaveProperty('lat', 12.9716);
      expect(call[1]?.params).toHaveProperty('lng', 77.5946);
    });
  });
});
