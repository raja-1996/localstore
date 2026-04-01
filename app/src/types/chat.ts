export interface MerchantStub {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface ChatThread {
  id: string;
  user_id: string;
  merchant_id: string;
  merchant: MerchantStub | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface ChatThreadListResponse {
  data: ChatThread[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  read_by_user: boolean;
  read_by_merchant: boolean;
  created_at: string;
}

export interface ChatMessageListResponse {
  data: ChatMessage[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface MarkReadResponse {
  marked_read: number;
}
