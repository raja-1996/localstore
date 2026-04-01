import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  View,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MerchantCard } from '@/components/MerchantCard';
import { PostCard } from '@/components/PostCard';
import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useLocationStore } from '@/stores/location-store';
import { useFeed } from '@/hooks/use-feed';
import { useFollowingFeed } from '@/hooks/use-following-feed';
import { useTheme } from '@/hooks/use-theme';
import type { MerchantCategory, NearbyFeedItem } from '@/types/feed';
import type { FollowingFeedPost } from '@/services/follow-service';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

type FeedTab = 'nearby' | 'following';

// ---------------------------------------------------------------------------
// NearMe tab
// ---------------------------------------------------------------------------
interface NearMeTabProps {
  category: MerchantCategory | null;
  onSelectCategory: (c: MerchantCategory | null) => void;
}

function NearMeTab({ category, onSelectCategory }: NearMeTabProps) {
  const colors = useTheme();
  const router = useRouter();

  const {
    coords,
    permissionStatus,
    refreshLocation,
    isStale,
    isLoading: locationLoading,
  } = useLocationStore();

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed({
    lat: coords?.latitude ?? null,
    lng: coords?.longitude ?? null,
    category,
  });

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [skipPermission, setSkipPermission] = useState(false);

  // S4-F5a: On foreground resume, refresh location if stale
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        if (isStale()) {
          refreshLocation();
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [isStale, refreshLocation]);

  const handleRefresh = useCallback(async () => {
    if (isStale()) {
      await refreshLocation();
    }
    refetch();
  }, [isStale, refreshLocation, refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  const allItems: NearbyFeedItem[] =
    data?.pages.flatMap((p) => (p as { data: NearbyFeedItem[] }).data) ?? [];

  // Location permission undetermined
  if (permissionStatus === 'undetermined' && !skipPermission) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ThemedText style={styles.permissionTitle}>Enable Location</ThemedText>
        <ThemedText variant="secondary" style={styles.permissionSubtitle}>
          LocalStore uses your location to find nearby merchants
        </ThemedText>
        <Pressable
          testID="allow-location-button"
          style={[styles.allowButton, { backgroundColor: colors.primary }]}
          onPress={refreshLocation}
        >
          <ThemedText style={[styles.allowButtonText, { color: colors.primaryText }]}>
            Allow Location
          </ThemedText>
        </Pressable>
        <Pressable style={styles.laterButton} onPress={() => setSkipPermission(true)}>
          <ThemedText variant="secondary">Maybe Later</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // Location permission denied
  if (permissionStatus === 'denied') {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ThemedText style={styles.permissionTitle}>Location Required</ThemedText>
        <ThemedText variant="secondary" style={styles.permissionSubtitle}>
          Enable location in Settings to find nearby merchants.
        </ThemedText>
      </ThemedView>
    );
  }

  // Loading state
  if (isLoading || locationLoading) {
    return (
      <ThemedView style={styles.container}>
        <SkeletonCard count={5} />
      </ThemedView>
    );
  }

  return (
    <FlashList
      data={allItems}
      renderItem={({ item }) => (
        <MerchantCard
          item={item}
          onPress={(id) =>
            router.push({ pathname: '/merchant/[id]', params: { id } } as any)
          }
        />
      )}
      estimatedItemSize={120}
      keyExtractor={(item) => item.id}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshing={false}
      onRefresh={handleRefresh}
      ListHeaderComponent={
        <CategoryFilterBar selected={category} onSelect={onSelectCategory} />
      }
      ListEmptyComponent={
        <ThemedText variant="secondary" style={styles.emptyText}>
          No merchants nearby
        </ThemedText>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} />
        ) : !hasNextPage && allItems.length > 0 ? (
          <ThemedText variant="secondary" style={styles.endText}>
            You've seen all nearby merchants
          </ThemedText>
        ) : null
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Following tab
// ---------------------------------------------------------------------------
function FollowingTab() {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFollowingFeed();

  const allPosts: FollowingFeedPost[] = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return <SkeletonCard count={4} />;
  }

  return (
    <FlatList
      data={allPosts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PostCard item={item} />}
      onEndReached={() => {
        if (hasNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <ThemedText
          testID="following-empty-state"
          variant="secondary"
          style={styles.emptyText}
        >
          Follow merchants to see their updates
        </ThemedText>
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

// ---------------------------------------------------------------------------
// FeedScreen — root
// ---------------------------------------------------------------------------

function TabItem({
  label,
  testID,
  isActive,
  onPress,
}: {
  label: string;
  testID: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      testID={testID}
      style={[
        styles.tabItem,
        isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
      ]}
      onPress={onPress}
    >
      <ThemedText
        style={[
          styles.tabLabel,
          { color: isActive ? colors.primary : colors.text },
          isActive && { fontWeight: '600' },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function FeedScreen() {
  const colors = useTheme();
  const [activeTab, setActiveTab] = useState<FeedTab>('nearby');
  const [category, setCategory] = useState<MerchantCategory | null>(null);

  return (
    <ThemedView style={styles.container}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TabItem
          label="Near Me"
          testID="near-me-tab"
          isActive={activeTab === 'nearby'}
          onPress={() => setActiveTab('nearby')}
        />
        <TabItem
          label="Following"
          testID="following-tab"
          isActive={activeTab === 'following'}
          onPress={() => setActiveTab('following')}
        />
      </View>

      {/* Tab content */}
      {activeTab === 'nearby' ? (
        <NearMeTab category={category} onSelectCategory={setCategory} />
      ) : (
        <FollowingTab />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: -1,
  },
  tabLabel: {
    fontSize: FontSize.md,
  },

  // Shared permission / empty states
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  permissionSubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  allowButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  allowButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: Spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: FontSize.md,
  },
  footer: {
    paddingVertical: Spacing.md,
  },
  endText: {
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
  },
});
