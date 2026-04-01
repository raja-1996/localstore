export type MerchantCategory = 'Food' | 'Tailoring' | 'Beauty' | 'HomeServices' | 'Events' | 'Other';

export interface NearbyFeedItem {
  type: 'merchant';
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
  neighborhood: string | null;
  tags: string[] | null;
}

export interface NearbyFeedResponse {
  data: NearbyFeedItem[];
  has_more: boolean;
  next_cursor: string | null;
}
