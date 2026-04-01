export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  push_token: string | null;
  is_merchant: boolean;
  created_at: string;
}

export interface UserUpdate {
  full_name?: string;
  avatar_url?: string;
}
