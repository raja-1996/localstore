import api from '@/lib/api';

// ----- Types -----

export interface FollowResponse {
  merchant_id: string;
  followed_at: string;
}

export interface ProfileStub {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FollowerListResponse {
  data: ProfileStub[];
  count: number;
}

export interface MerchantCard {
  id: string;
  name: string;
  category: string;
  avatar_url: string | null;
  follower_count: number;
  avg_rating: number | null;
  review_count: number;
  is_verified: boolean;
  neighborhood: string | null;
}

export interface FollowingListResponse {
  data: MerchantCard[];
  count: number;
}

export interface PostMerchantStub {
  id: string;
  business_name: string;
  avatar_url: string | null;
}

export interface FollowingFeedPost {
  id: string;
  merchant: PostMerchantStub;
  content: string;
  image_url: string | null;
  post_type: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export interface FollowingFeedResponse {
  data: FollowingFeedPost[];
  has_more: boolean;
  next_cursor: string | null;
}

// ----- Service -----

export const followService = {
  followMerchant: (merchantId: string) =>
    api.post<FollowResponse>(`/merchants/${merchantId}/follow`),

  unfollowMerchant: (merchantId: string) =>
    api.delete(`/merchants/${merchantId}/follow`),

  getFollowing: () =>
    api.get<FollowingListResponse>('/users/me/following'),

  getFollowers: (merchantId: string) =>
    api.get<FollowerListResponse>(`/merchants/${merchantId}/followers`),

  getFollowingFeed: (cursor?: string) =>
    api.get<FollowingFeedResponse>('/feed/following', {
      params: cursor ? { cursor } : undefined,
    }),
};
