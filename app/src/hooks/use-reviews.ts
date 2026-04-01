import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '@/services/review-service';
import type { ReviewCreate, ReviewListResponse, ReviewResponse, ReviewUpdate } from '@/services/review-service';

export function useReviews(merchantId: string) {
  return useQuery<ReviewListResponse, Error>({
    queryKey: ['reviews', merchantId],
    queryFn: () => reviewService.getReviews(merchantId).then((r) => r.data),
    enabled: !!merchantId,
    staleTime: 30_000,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation<ReviewResponse, Error, { merchantId: string; payload: ReviewCreate }>({
    mutationFn: ({ merchantId, payload }) =>
      reviewService.createReview(merchantId, payload).then((r) => r.data),

    onSuccess: (_data, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation<
    ReviewResponse,
    Error,
    { merchantId: string; reviewId: string; payload: ReviewUpdate }
  >({
    mutationFn: ({ merchantId, reviewId, payload }) =>
      reviewService.updateReview(merchantId, reviewId, payload).then((r) => r.data),

    onSuccess: (_data, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { merchantId: string; reviewId: string }>({
    mutationFn: ({ merchantId, reviewId }) =>
      reviewService.deleteReview(merchantId, reviewId).then(() => undefined),

    onSuccess: (_data, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });
}
