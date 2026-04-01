import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MerchantCard } from '@/components/MerchantCard';
import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import { useSearch } from '@/hooks/use-search';
import { useLocationStore } from '@/stores/location-store';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { MerchantCategory, NearbyFeedItem } from '@/types/feed';
import type { SearchMerchantItem } from '@/types/search';

/**
 * Adapts a SearchMerchantItem to the NearbyFeedItem shape expected by MerchantCard.
 * distance_meters is passed as-is (null when user location is unavailable).
 */
function adaptSearchItem(item: SearchMerchantItem): NearbyFeedItem {
  return {
    type: 'merchant',
    id: item.id,
    name: item.name,
    category: item.category,
    lat: item.lat,
    lng: item.lng,
    avg_rating: item.avg_rating,
    review_count: item.review_count,
    follower_count: item.follower_count,
    is_verified: item.is_verified,
    distance_meters: item.distance_meters,
    description: null,
    neighborhood: item.neighborhood,
    tags: null,
  };
}

export default function SearchScreen() {
  const colors = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MerchantCategory | null>(null);

  const hasCoords = useLocationStore((s) => s.coords !== null);

  const { data, isLoading } = useSearch({ query, category: selectedCategory });

  // Service results (data?.services) are not displayed in this MVP screen.
  // Only merchant-level results are rendered. Service search is a future enhancement.
  const adaptedItems = useMemo<NearbyFeedItem[]>(
    () => (data?.merchants ?? []).map(adaptSearchItem),
    [data]
  );

  const handleCardPress = useCallback(
    (id: string) => {
      router.push({ pathname: '/merchant/[id]', params: { id } } as any);
    },
    [router]
  );

  const showEmptyState =
    query.length > 0 &&
    !isLoading &&
    adaptedItems.length === 0 &&
    hasCoords;

  return (
    <ThemedView testID="search-screen" style={styles.container}>
      {/* Search Input */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          testID="search-input"
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search merchants or services..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Category Filter */}
      <CategoryFilterBar selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Results */}
      {isLoading && query.length > 0 ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : showEmptyState ? (
        <View testID="empty-state" style={styles.centeredState}>
          <ThemedText variant="secondary" style={styles.stateText}>
            No results for "{query}"
          </ThemedText>
        </View>
      ) : (
        <FlashList
          data={adaptedItems}
          renderItem={({ item }) => (
            <MerchantCard item={item} onPress={handleCardPress} />
          )}
          estimatedItemSize={120}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            query.length === 0 ? (
              <View style={styles.centeredState}>
                <ThemedText variant="secondary" style={styles.stateText}>
                  Type to search for merchants and services
                </ThemedText>
              </View>
            ) : null
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    height: 44,
    fontSize: FontSize.md,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  stateText: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
});
