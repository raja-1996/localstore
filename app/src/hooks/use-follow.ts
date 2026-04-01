import { useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followService } from '@/services/follow-service';
import type { MerchantDetail } from '@/types/merchant';

const DEBOUNCE_MS = 300;

interface UseFollowParams {
  merchantId: string;
  isFollowing: boolean;
}

export function useFollow({ merchantId, isFollowing }: UseFollowParams) {
  const queryClient = useQueryClient();
  const lastFiredAt = useRef<number>(0);

  const mutation = useMutation({
    mutationFn: async (shouldFollow: boolean) => {
      if (shouldFollow) {
        await followService.followMerchant(merchantId);
      } else {
        await followService.unfollowMerchant(merchantId);
      }
    },

    onMutate: async (shouldFollow: boolean) => {
      // Cancel any in-flight refetch for this merchant
      await queryClient.cancelQueries({ queryKey: ['merchant', merchantId] });

      // Snapshot current data for rollback
      const previous = queryClient.getQueryData<{ merchant: MerchantDetail }>(
        ['merchant', merchantId],
      );

      // Optimistically update follower_count + is_following
      queryClient.setQueryData<{ merchant: MerchantDetail }>(
        ['merchant', merchantId],
        (old) => {
          if (old == null) return old;
          return {
            ...old,
            merchant: {
              ...old.merchant,
              follower_count: shouldFollow
                ? old.merchant.follower_count + 1
                : Math.max(0, old.merchant.follower_count - 1),
              is_following: shouldFollow,
            },
          };
        },
      );

      return { previous };
    },

    onError: (_err, _shouldFollow, context) => {
      // Rollback on any error (including 409 — already following)
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['merchant', merchantId], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });

  // Debounced toggle — ignore rapid double-fires within 300ms
  const toggle = useCallback(() => {
    const now = Date.now();
    if (now - lastFiredAt.current < DEBOUNCE_MS) return;
    lastFiredAt.current = now;
    mutation.mutate(!isFollowing);
  }, [isFollowing, mutation.mutate]);

  return {
    toggle,
    isLoading: mutation.isPending,
  };
}
