import type { MerchantCategory } from '@/types/feed';

export const CATEGORIES: MerchantCategory[] = [
  'Food',
  'Beauty',
  'Tailoring',
  'HomeServices',
  'Events',
  'Other',
];

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  Food: 'Food',
  Beauty: 'Beauty',
  Tailoring: 'Tailoring',
  HomeServices: 'Home Services',
  Events: 'Events',
  Other: 'Other',
};
