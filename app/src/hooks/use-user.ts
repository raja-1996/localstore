import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user-service';
import type { UserUpdate } from '@/types/user';

const STALE_TIME = 5 * 60 * 1000;

export function useUser() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userService.getMe().then((r) => r.data),
    staleTime: STALE_TIME,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserUpdate) => userService.updateMe(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
}
