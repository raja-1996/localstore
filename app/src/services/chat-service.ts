import api from '@/lib/api';
import type {
  ChatThread,
  ChatThreadListResponse,
  ChatMessage,
  ChatMessageListResponse,
  MarkReadResponse,
} from '@/types/chat';

export const chatService = {
  getThreads: (params?: { limit?: number; cursor?: string | null }) => {
    const queryParams: Record<string, string | number> = {};
    if (params?.limit != null) queryParams.limit = params.limit;
    if (params?.cursor != null) queryParams.before = params.cursor;
    return api.get<ChatThreadListResponse>('/chats', { params: queryParams });
  },

  createThread: (merchantId: string) => {
    return api.post<ChatThread>('/chats', { merchant_id: merchantId });
  },

  getMessages: (threadId: string, cursor?: string | null) => {
    const queryParams: Record<string, string | number> = {};
    if (cursor != null) queryParams.before = cursor;
    return api.get<ChatMessageListResponse>(`/chats/${threadId}/messages`, { params: queryParams });
  },

  sendMessage: (threadId: string, content: string) => {
    return api.post<ChatMessage>(`/chats/${threadId}/messages`, { content });
  },

  markRead: (threadId: string) => {
    return api.patch<MarkReadResponse>(`/chats/${threadId}/read`);
  },
};
