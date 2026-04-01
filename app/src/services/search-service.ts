import api from '@/lib/api';
import type { MerchantCategory } from '@/types/feed';
import type { SearchResponse } from '@/types/search';

export interface SearchMerchantsParams {
  q: string;
  lat: number;
  lng: number;
  category?: MerchantCategory | null;
  limit?: number;
  offset?: number;
}

export const searchService = {
  searchMerchants: (params: SearchMerchantsParams) => {
    const { category, ...rest } = params;

    const queryParams: Record<string, unknown> = { ...rest };

    if (category != null) {
      queryParams.category = category;
    }

    return api.get<SearchResponse>('/search', { params: queryParams });
  },
};
