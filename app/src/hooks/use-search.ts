import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/services/search-service';
import { useLocationStore } from '@/stores/location-store';
import type { MerchantCategory } from '@/types/feed';
import type { SearchResponse } from '@/types/search';

const DEBOUNCE_MS = 300;

interface UseSearchParams {
  query: string;
  category?: MerchantCategory | null;
}

export function useSearch({ query, category }: UseSearchParams) {
  const coords = useLocationStore((s) => s.coords);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const lat = coords?.latitude ?? null;
  const lng = coords?.longitude ?? null;

  return useQuery({
    queryKey: ['search', debouncedQuery, lat, lng, category],
    queryFn: () => {
      const safeLat = lat!;
      const safeLng = lng!;
      return searchService
        .searchMerchants({ q: debouncedQuery, lat: safeLat, lng: safeLng, category })
        .then((r) => r.data);
    },
    // Coerce avg_rating from backend (may return string or number) to number | null.
    select: (data: SearchResponse): SearchResponse => ({
      ...data,
      merchants: data.merchants.map((m) => ({
        ...m,
        avg_rating: m.avg_rating != null ? Number(m.avg_rating) : null,
      })),
    }),
    enabled: debouncedQuery.length > 0 && lat !== null && lng !== null,
    // staleTime: 0 — search results are always considered stale so every
    // query (new text, tab re-mount) fetches fresh results from the backend.
    // This differs from the project default of 5 minutes used in feed/merchant queries.
    staleTime: 0,
  });
}
