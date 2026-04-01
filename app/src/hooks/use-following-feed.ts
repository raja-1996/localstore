import { useInfiniteQuery } from '@tanstack/react-query';
import { followService } from '@/services/follow-service';
import type { FollowingFeedPost } from '@/services/follow-service';

const STALE_TIME = 2 * 60 * 1000;

export function useFollowingFeed() {
  return useInfiniteQuery<
    { data: FollowingFeedPost[]; has_more: boolean; next_cursor: string | null },
    Error
  >({
    queryKey: ['feed', 'following'],
    queryFn: ({ pageParam }) =>
      followService
        .getFollowingFeed(pageParam as string | undefined)
        .then((res) => res.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more && lastPage.next_cursor != null
        ? lastPage.next_cursor
        : undefined,
    staleTime: STALE_TIME,
  });
}
