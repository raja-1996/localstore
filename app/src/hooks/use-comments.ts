import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentService } from '@/services/comment-service';
import type { Comment, CommentListResponse } from '@/services/comment-service';

export function useComments(postId: string) {
  return useQuery<CommentListResponse, Error>({
    queryKey: ['comments', postId],
    queryFn: () =>
      commentService.getComments(postId).then((r) => r.data),
    enabled: !!postId,
    staleTime: 30_000,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation<Comment, Error, { postId: string; content: string }>({
    mutationFn: ({ postId, content }) =>
      commentService.createComment(postId, content).then((r) => r.data),

    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { postId: string; commentId: string }>({
    mutationFn: ({ postId, commentId }) =>
      commentService.deleteComment(postId, commentId).then(() => undefined),

    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}
