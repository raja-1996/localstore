import { useMutation, useQueryClient } from '@tanstack/react-query';
import { likeService } from '@/services/like-service';

interface LikeVariables {
  postId: string;
  liked: boolean;
  merchantId?: string;
}

export function useLike(postId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, LikeVariables>({
    mutationFn: ({ postId: pid, liked }) =>
      liked
        ? likeService.unlikePost(pid).then(() => undefined)
        : likeService.likePost(pid).then(() => undefined),

    onSettled: (_data, _err, { merchantId }) => {
      if (merchantId) {
        queryClient.invalidateQueries({ queryKey: ['posts', merchantId] });
      }
    },
  });

  return {
    mutate: mutation.mutate,
    isPending: mutation.isPending,
    isLiking: mutation.isPending,
  };
}
