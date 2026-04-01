import { chatService } from '../services/chat-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

const mockApi = api as jest.Mocked<typeof api>;

const mockThread = {
  id: 'thread-1',
  user_id: 'user-1',
  merchant_id: 'merchant-1',
  merchant: { id: 'merchant-1', name: 'Raja Tailors', avatar_url: null },
  last_message: 'Hello!',
  last_message_at: '2026-03-29T10:00:00Z',
  unread_count: 2,
  created_at: '2026-03-01T10:00:00Z',
};

const mockMessage = {
  id: 'msg-1',
  thread_id: 'thread-1',
  sender_id: 'user-1',
  content: 'Hello!',
  read_by_user: true,
  read_by_merchant: false,
  created_at: '2026-03-29T10:00:00Z',
};

const mockThreadListResponse = {
  data: {
    data: [mockThread],
    has_more: false,
    next_cursor: null,
  },
};

const mockMessageListResponse = {
  data: {
    data: [mockMessage],
    has_more: false,
    next_cursor: null,
  },
};

const mockMarkReadResponse = {
  data: { marked_read: 3 },
};

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getThreads', () => {
    it('calls GET /chats with no params when called without args', async () => {
      mockApi.get.mockResolvedValueOnce(mockThreadListResponse);
      await chatService.getThreads();
      expect(mockApi.get).toHaveBeenCalledWith('/chats', { params: {} });
    });

    it('passes before param when cursor is provided', async () => {
      mockApi.get.mockResolvedValueOnce(mockThreadListResponse);
      await chatService.getThreads({ cursor: 'cursor-abc' });
      expect(mockApi.get).toHaveBeenCalledWith('/chats', {
        params: { before: 'cursor-abc' },
      });
    });

    it('passes limit param when provided', async () => {
      mockApi.get.mockResolvedValueOnce(mockThreadListResponse);
      await chatService.getThreads({ limit: 10 });
      expect(mockApi.get).toHaveBeenCalledWith('/chats', {
        params: { limit: 10 },
      });
    });

    it('omits before when cursor is null', async () => {
      mockApi.get.mockResolvedValueOnce(mockThreadListResponse);
      await chatService.getThreads({ cursor: null });
      const call = mockApi.get.mock.calls[0];
      expect(call[1]?.params).not.toHaveProperty('before');
    });

    it('omits before when cursor is undefined', async () => {
      mockApi.get.mockResolvedValueOnce(mockThreadListResponse);
      await chatService.getThreads({ cursor: undefined });
      const call = mockApi.get.mock.calls[0];
      expect(call[1]?.params).not.toHaveProperty('before');
    });

    it('returns the response data', async () => {
      mockApi.get.mockResolvedValueOnce(mockThreadListResponse);
      const result = await chatService.getThreads();
      expect(result.data.data[0].id).toBe('thread-1');
      expect(result.data.has_more).toBe(false);
      expect(result.data.next_cursor).toBeNull();
    });
  });

  describe('createThread', () => {
    it('calls POST /chats with merchant_id', async () => {
      mockApi.post.mockResolvedValueOnce({ data: mockThread });
      await chatService.createThread('merchant-1');
      expect(mockApi.post).toHaveBeenCalledWith('/chats', {
        merchant_id: 'merchant-1',
      });
    });

    it('returns thread data', async () => {
      mockApi.post.mockResolvedValueOnce({ data: mockThread });
      const result = await chatService.createThread('merchant-1');
      expect(result.data.id).toBe('thread-1');
      expect(result.data.merchant_id).toBe('merchant-1');
    });
  });

  describe('getMessages', () => {
    it('calls GET /chats/:threadId/messages', async () => {
      mockApi.get.mockResolvedValueOnce(mockMessageListResponse);
      await chatService.getMessages('thread-1');
      expect(mockApi.get).toHaveBeenCalledWith('/chats/thread-1/messages', {
        params: {},
      });
    });

    it('passes before param when cursor is provided', async () => {
      mockApi.get.mockResolvedValueOnce(mockMessageListResponse);
      await chatService.getMessages('thread-1', 'cursor-xyz');
      expect(mockApi.get).toHaveBeenCalledWith('/chats/thread-1/messages', {
        params: { before: 'cursor-xyz' },
      });
    });

    it('omits before when cursor is null', async () => {
      mockApi.get.mockResolvedValueOnce(mockMessageListResponse);
      await chatService.getMessages('thread-1', null);
      const call = mockApi.get.mock.calls[0];
      expect(call[1]?.params).not.toHaveProperty('before');
    });

    it('returns the response data', async () => {
      mockApi.get.mockResolvedValueOnce(mockMessageListResponse);
      const result = await chatService.getMessages('thread-1');
      expect(result.data.data[0].id).toBe('msg-1');
      expect(result.data.data[0].content).toBe('Hello!');
      expect(result.data.has_more).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('calls POST /chats/:threadId/messages with content', async () => {
      mockApi.post.mockResolvedValueOnce({ data: mockMessage });
      await chatService.sendMessage('thread-1', 'Hello!');
      expect(mockApi.post).toHaveBeenCalledWith('/chats/thread-1/messages', {
        content: 'Hello!',
      });
    });

    it('returns message data', async () => {
      mockApi.post.mockResolvedValueOnce({ data: mockMessage });
      const result = await chatService.sendMessage('thread-1', 'Hello!');
      expect(result.data.id).toBe('msg-1');
      expect(result.data.content).toBe('Hello!');
      expect(result.data.thread_id).toBe('thread-1');
    });
  });

  describe('markRead', () => {
    it('calls PATCH /chats/:threadId/read', async () => {
      mockApi.patch.mockResolvedValueOnce(mockMarkReadResponse);
      await chatService.markRead('thread-1');
      expect(mockApi.patch).toHaveBeenCalledWith('/chats/thread-1/read');
    });

    it('returns MarkReadResponse with marked_read count', async () => {
      mockApi.patch.mockResolvedValueOnce(mockMarkReadResponse);
      const result = await chatService.markRead('thread-1');
      expect(result.data.marked_read).toBe(3);
    });
  });
});
