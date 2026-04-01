import api from '@/lib/api';

// ----- Types -----

export interface ReviewCreate {
  rating: number; // 1–5
  body?: string;
}

export interface ReviewUpdate {
  rating?: number;
  body?: string;
}

export interface ReviewerStub {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ReviewResponse {
  id: string;
  merchant_id: string;
  reviewer: ReviewerStub;
  rating: number;
  body: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface ReviewListResponse {
  data: ReviewResponse[];
  avg_rating: number;
  count: number;
}

// ----- Service -----

export const reviewService = {
  getReviews: (merchantId: string, limit?: number, offset?: number) =>
    api
      .get<ReviewListResponse>(`/merchants/${merchantId}/reviews`, {
        params:
          limit !== undefined || offset !== undefined
            ? { limit, offset }
            : undefined,
      })
      .then((r) => {
        // avg_rating may deserialise as string from Supabase — coerce at boundary
        r.data.avg_rating = Number(r.data.avg_rating);
        return r;
      }),

  createReview: (merchantId: string, payload: ReviewCreate) =>
    api.post<ReviewResponse>(`/merchants/${merchantId}/reviews`, payload),

  updateReview: (merchantId: string, reviewId: string, payload: ReviewUpdate) =>
    api.patch<ReviewResponse>(
      `/merchants/${merchantId}/reviews/${reviewId}`,
      payload,
    ),

  deleteReview: (merchantId: string, reviewId: string) =>
    api.delete(`/merchants/${merchantId}/reviews/${reviewId}`),
};
