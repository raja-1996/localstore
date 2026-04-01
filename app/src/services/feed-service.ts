import api from '@/lib/api';
import type { MerchantCategory, NearbyFeedResponse } from '@/types/feed';

export interface GetNearbyFeedParams {
  lat: number;
  lng: number;
  radius_meters?: number;
  limit?: number;
  cursor?: string | null;
  category?: MerchantCategory | null;
}

export const feedService = {
  getNearbyFeed: (params: GetNearbyFeedParams) => {
    const { cursor, category, ...rest } = params;

    const queryParams: Record<string, unknown> = { ...rest };

    // Cursor maps to 'before' per backend pagination convention
    if (cursor != null) {
      queryParams.before = cursor;
    }

    if (category != null) {
      queryParams.category = category;
    }

    return api.get<NearbyFeedResponse>('/feed/nearby', { params: queryParams });
  },
};
