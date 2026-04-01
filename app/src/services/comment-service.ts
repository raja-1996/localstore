import api from '@/lib/api';

// ----- Types -----

export interface CommentUserStub {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user: CommentUserStub;
  content: string;
  created_at: string;
}

export interface CommentListResponse {
  data: Comment[];
  count: number;
}

export interface CommentResponse {
  data: Comment;
}

// ----- Service -----

export const commentService = {
  getComments: (postId: string, limit?: number, offset?: number) =>
    api.get<CommentListResponse>(`/posts/${postId}/comments`, {
      params:
        limit !== undefined || offset !== undefined
          ? { limit, offset }
          : undefined,
    }),

  createComment: (postId: string, content: string) =>
    api.post<Comment>(`/posts/${postId}/comments`, { content }),

  deleteComment: (postId: string, commentId: string) =>
    api.delete(`/posts/${postId}/comments/${commentId}`),
};
