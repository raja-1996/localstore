import type { MerchantCategory } from './feed';

export interface MerchantDetail {
  id: string;
  name: string;
  category: MerchantCategory;
  lat: number;
  lng: number;
  avg_rating: number | null;
  review_count: number;
  follower_count: number;
  is_verified: boolean;
  distance_meters: number | null;
  description: string | null;
  address_text: string | null;
  neighborhood: string | null;
  service_radius_meters: number;
  tags: string[] | null;
  video_intro_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  response_time_minutes: number | null;
  is_active: boolean;
  is_owner: boolean;
  is_following: boolean;
  created_at: string;
}

export interface ServiceResponse {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  price_unit: string | null;
  image_url: string | null;
  is_available: boolean;
  cancellation_policy: string | null;
  advance_percent: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioImage {
  id: string;
  merchant_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface MerchantCreate {
  name: string;
  category: MerchantCategory;
  description?: string;
  lat: number;
  lng: number;
  address_text?: string;
  neighborhood?: string;
  service_radius_meters?: number;
  phone?: string;
  whatsapp?: string;
}

export interface MerchantUpdate {
  name?: string;
  category?: MerchantCategory;
  description?: string;
  lat?: number;
  lng?: number;
  address_text?: string;
  neighborhood?: string;
  service_radius_meters?: number;
  phone?: string;
  whatsapp?: string;
  avatar_url?: string;
}

export interface ServiceCreate {
  name: string;
  price: number;
  description?: string;
}

export interface ServiceUpdate {
  name?: string;
  price?: number;
  description?: string;
}
