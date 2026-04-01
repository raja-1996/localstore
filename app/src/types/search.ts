import type { MerchantCategory } from './feed';

export interface SearchMerchantItem {
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
  neighborhood: string | null;
}

export interface ServiceMerchantBrief {
  id: string;
  name: string;
}

export interface SearchServiceItem {
  id: string;
  merchant: ServiceMerchantBrief;
  name: string;
  description: string | null;
  price: number;
  price_unit: string | null;
  image_url: string | null;
  distance_meters: number | null;
}

export interface SearchResponse {
  merchants: SearchMerchantItem[];
  services: SearchServiceItem[];
}
