import { useInfiniteQuery } from '@tanstack/react-query';
import { postService } from '@/services/post-service';
import type { PostListResponse } from '@/services/post-service';

export function usePosts(merchantId: string) {
  return useInfiniteQuery<PostListResponse, Error>({
    queryKey: ['posts', merchantId],
    queryFn: ({ pageParam }) =>
      postService
        .getMerchantPosts(merchantId, pageParam as string | undefined)
        .then((r) => r.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: !!merchantId,
    staleTime: 30_000,
  });
}
