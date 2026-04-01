import api from '@/lib/api';

// ----- Types -----

export interface LikeResponse {
  liked: true;
}

// ----- Service -----

export const likeService = {
  likePost: (postId: string) =>
    api.post<LikeResponse>(`/posts/${postId}/like`),

  unlikePost: (postId: string) =>
    api.delete(`/posts/${postId}/like`),
};
