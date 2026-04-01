import { merchantService } from '../services/merchant-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
}));

// Intentional partial mock: merchant-service only uses `get`.
const mockApi = api as jest.Mocked<typeof api>;

const mockMerchantDetail = {
  data: {
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
    address_text: '12 MG Road',
    neighborhood: 'Koramangala',
    service_radius_meters: 5000,
    tags: ['tailoring'],
    video_intro_url: null,
    phone: '+91**98765',
    whatsapp: null,
    response_time_minutes: 30,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
};

const mockServices = {
  data: [
    {
      id: 'service-1',
      merchant_id: 'merchant-1',
      name: 'Shirt Stitching',
      description: 'Custom shirt stitching',
      price: 500,
      price_unit: 'per piece',
      image_url: null,
      is_available: true,
      cancellation_policy: null,
      advance_percent: 20,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
};

const mockPortfolio = {
  data: [
    {
      id: 'portfolio-1',
      merchant_id: 'merchant-1',
      image_url: 'https://example.com/photo.jpg',
      caption: 'Sample work',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
};

describe('merchantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMerchant', () => {
    it('calls GET /merchants/{id} with correct id', async () => {
      mockApi.get.mockResolvedValueOnce(mockMerchantDetail);
      await merchantService.getMerchant('merchant-1');
      expect(mockApi.get).toHaveBeenCalledWith('/merchants/merchant-1');
    });

    it('returns typed MerchantDetail on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockMerchantDetail);
      const result = await merchantService.getMerchant('merchant-1');
      expect(result.data.id).toBe('merchant-1');
      expect(result.data.category).toBe('Tailoring');
      expect(result.data.is_active).toBe(true);
    });

    it('rejects on API error', async () => {
      const error = { response: { status: 404, data: { detail: 'Merchant not found' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(
        merchantService.getMerchant('merchant-1')
      ).rejects.toMatchObject({ response: { status: 404 } });
    });
  });

  describe('getMerchantServices', () => {
    it('calls GET /merchants/{id}/services with correct merchantId', async () => {
      mockApi.get.mockResolvedValueOnce(mockServices);
      await merchantService.getMerchantServices('merchant-1');
      expect(mockApi.get).toHaveBeenCalledWith('/merchants/merchant-1/services');
    });

    it('returns typed ServiceResponse array on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockServices);
      const result = await merchantService.getMerchantServices('merchant-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].merchant_id).toBe('merchant-1');
      expect(result.data[0].price).toBe(500);
    });

    it('rejects on API error', async () => {
      const error = { response: { status: 500, data: { detail: 'Internal server error' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(
        merchantService.getMerchantServices('merchant-1')
      ).rejects.toMatchObject({ response: { status: 500 } });
    });
  });

  describe('getMerchantPortfolio', () => {
    it('calls GET /merchants/{id}/portfolio with correct merchantId', async () => {
      mockApi.get.mockResolvedValueOnce(mockPortfolio);
      await merchantService.getMerchantPortfolio('merchant-1');
      expect(mockApi.get).toHaveBeenCalledWith('/merchants/merchant-1/portfolio');
    });

    it('returns typed PortfolioImage array on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockPortfolio);
      const result = await merchantService.getMerchantPortfolio('merchant-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].image_url).toBe('https://example.com/photo.jpg');
      expect(result.data[0].sort_order).toBe(1);
    });

    it('rejects on API error', async () => {
      const error = { response: { status: 500, data: { detail: 'Internal server error' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(
        merchantService.getMerchantPortfolio('merchant-1')
      ).rejects.toMatchObject({ response: { status: 500 } });
    });
  });
});
