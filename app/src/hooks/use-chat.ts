import { useEffect } from 'react';

import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { chatService } from '@/services/chat-service';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, ChatMessageListResponse, ChatThreadListResponse } from '@/types/chat';

const THREADS_STALE_TIME = 30_000;
const MESSAGES_STALE_TIME = 0;

export const activeChatThreadRef = { current: null as string | null };

export function useThreads() {
  const setTotalUnread = useChatStore((s) => s.setTotalUnread);

  const query = useInfiniteQuery<
    ChatThreadListResponse,
    Error,
    InfiniteData<ChatThreadListResponse>,
    string[],
    string | undefined
  >({
    queryKey: ['chat', 'threads'],
    queryFn: ({ pageParam }) =>
      chatService
        .getThreads({ cursor: pageParam })
        .then((res) => res.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more && lastPage.next_cursor != null ? lastPage.next_cursor : undefined,
    staleTime: THREADS_STALE_TIME,
  });

  useEffect(() => {
    if (!query.data) return;
    const total = query.data.pages
      .flatMap((p) => p.data)
      .reduce((sum, t) => sum + t.unread_count, 0);
    setTotalUnread(total);
  }, [query.data, setTotalUnread]);

  return query;
}

export function useMessages(threadId: string) {
  return useInfiniteQuery<
    ChatMessageListResponse,
    Error,
    InfiniteData<ChatMessageListResponse>,
    string[],
    string | undefined
  >({
    queryKey: ['chat', 'messages', threadId],
    queryFn: ({ pageParam }) =>
      chatService
        .getMessages(threadId, pageParam)
        .then((res) => res.data),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more && lastPage.next_cursor != null ? lastPage.next_cursor : undefined,
    enabled: !!threadId,
    staleTime: MESSAGES_STALE_TIME,
  });
}

type SendMessageVars = { threadId: string; content: string };
type SendMessageContext = { snapshot: unknown; tempId: string };

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation<ChatMessage, Error, SendMessageVars, SendMessageContext>({
    mutationFn: ({ threadId, content }) =>
      chatService.sendMessage(threadId, content).then((r) => r.data),

    onMutate: async ({ threadId, content }) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages', threadId] });
      const snapshot = queryClient.getQueryData<{ pages: ChatMessageListResponse[] }>(
        ['chat', 'messages', threadId]
      );
      const tempId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const optimistic: ChatMessage = {
        id: tempId,
        thread_id: threadId,
        sender_id: user.id,
        content,
        read_by_user: true,
        read_by_merchant: false,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<{ pages: ChatMessageListResponse[]; pageParams: unknown[] }>(
        ['chat', 'messages', threadId],
        (old) => {
          if (!old) return old;
          const pages = [...old.pages];
          if (!pages.length) return old;
          pages[0] = { ...pages[0], data: [optimistic, ...pages[0].data] };
          return { ...old, pages };
        }
      );

      return { snapshot, tempId };
    },

    onSuccess: (data, { threadId }, context) => {
      queryClient.setQueryData<{ pages: ChatMessageListResponse[]; pageParams: unknown[] }>(
        ['chat', 'messages', threadId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((msg) => (msg.id === context.tempId ? data : msg)),
          }));
          return { ...old, pages };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },

    onError: (_err, { threadId }, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['chat', 'messages', threadId], context.snapshot);
      }
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation<{ marked_read: number }, Error, { threadId: string }>({
    mutationFn: ({ threadId }) =>
      chatService.markRead(threadId).then((r) => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (merchantId: string) =>
      chatService.createThread(merchantId).then((r) => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });
}

export function useChatRealtime(threadId: string) {
  const queryClient = useQueryClient();
  const incrementUnread = useChatStore((s) => s.incrementUnread);

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;

          queryClient.setQueryData<{ pages: ChatMessageListResponse[]; pageParams: unknown[] }>(
            ['chat', 'messages', threadId],
            (old) => {
              if (!old) return old;
              if (!old.pages.length) return old;

              const exists = old.pages.some((page) =>
                page.data.some((msg) => msg.id === newMessage.id)
              );
              if (exists) return old;

              const pages = [...old.pages];
              pages[0] = { ...pages[0], data: [newMessage, ...pages[0].data] };
              return { ...old, pages };
            }
          );

          if (activeChatThreadRef.current !== threadId) {
            incrementUnread();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient, incrementUnread]);
}
