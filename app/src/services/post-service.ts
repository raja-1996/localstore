import api from '@/lib/api';

// ----- Types -----

export interface PostMerchantStub {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface Post {
  id: string;
  merchant_id: string;
  merchant: PostMerchantStub;
  content: string;
  image_url: string | null;
  post_type: 'offer' | 'update';
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  created_at: string;
}

export interface PostListResponse {
  data: Post[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface PostResponse {
  data: Post;
}

export interface PostCreate {
  content: string;
  post_type: 'offer' | 'update';
  image_url?: string | null;
}

export interface PostUpdate {
  content?: string;
  post_type?: 'offer' | 'update';
  image_url?: string | null;
}

// ----- Service -----

export const postService = {
  getMerchantPosts: (merchantId: string, cursor?: string) =>
    api.get<PostListResponse>(`/merchants/${merchantId}/posts`, {
      params: cursor ? { cursor } : undefined,
    }),

  createPost: (merchantId: string, payload: PostCreate) =>
    api.post<Post>(`/merchants/${merchantId}/posts`, payload),

  updatePost: (merchantId: string, postId: string, payload: PostUpdate) =>
    api.patch<Post>(`/merchants/${merchantId}/posts/${postId}`, payload),

  deletePost: (merchantId: string, postId: string) =>
    api.delete(`/merchants/${merchantId}/posts/${postId}`),
};
