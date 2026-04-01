import { useInfiniteQuery } from '@tanstack/react-query';
import { feedService } from '@/services/feed-service';
import type { MerchantCategory, NearbyFeedItem, NearbyFeedResponse } from '@/types/feed';

interface UseFeedParams {
  lat: number | null;
  lng: number | null;
  category?: MerchantCategory | null;
  enabled?: boolean;
}

const STALE_TIME = 5 * 60 * 1000;

// Coerce avg_rating from backend (may return string or number) to number | null.
function normalizeFeedItem(item: NearbyFeedItem): NearbyFeedItem {
  return {
    ...item,
    avg_rating: item.avg_rating != null ? Number(item.avg_rating) : null,
  };
}

export function useFeed({ lat, lng, category, enabled = true }: UseFeedParams) {
  return useInfiniteQuery({
    queryKey: ['feed', 'nearby', lat, lng, category],
    queryFn: ({ pageParam }) =>
      feedService
        .getNearbyFeed({
          lat: lat as number,
          lng: lng as number,
          cursor: pageParam as string | undefined,
          category,
        })
        .then((res) => ({
          ...res.data,
          data: res.data.data.map(normalizeFeedItem),
        })),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more && lastPage.next_cursor != null ? lastPage.next_cursor : undefined,
    enabled: enabled && lat !== null && lng !== null,
    staleTime: STALE_TIME,
  });
}
