import React, { useCallback } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import type { NearbyFeedItem } from '@/types/feed';
import { formatDistance } from '@/utils/format-distance';

interface MerchantCardProps {
  item: NearbyFeedItem;
  onPress: (id: string) => void;
}

export function MerchantCard({ item, onPress }: MerchantCardProps) {
  const colors = useTheme();
  const initial = item.name.charAt(0).toUpperCase();
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

  return (
    <Pressable
      testID="merchant-card"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      {/* Avatar with first-letter fallback */}
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <ThemedText style={[styles.avatarText, { color: colors.primaryText }]}>
          {initial}
        </ThemedText>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Name + distance row */}
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText variant="secondary" style={styles.distance}>
            {formatDistance(item.distance_meters)}
          </ThemedText>
        </View>

        {/* Category badge */}
        <View style={[styles.badge, { backgroundColor: colors.border }]}>
          <ThemedText variant="secondary" style={styles.badgeText}>
            {item.category}
          </ThemedText>
        </View>

        {/* Description */}
        {item.description != null && (
          <ThemedText variant="secondary" style={styles.description} numberOfLines={2}>
            {item.description}
          </ThemedText>
        )}

        {/* Rating */}
        <ThemedText testID="merchant-rating" variant="secondary" style={styles.rating}>
          {item.avg_rating != null && Number(item.avg_rating) > 0
            ? `★ ${Number(item.avg_rating).toFixed(1)} (${item.review_count})`
            : 'No reviews yet'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  distance: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.sm,
  },
  description: {
    fontSize: FontSize.sm,
  },
  rating: {
    fontSize: FontSize.sm,
  },
});
