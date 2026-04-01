import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useThreads } from '@/hooks/use-chat';
import { useTheme } from '@/hooks/use-theme';
import type { ChatThread } from '@/types/chat';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatRelativeTime(isoString: string | null): string {
  if (isoString == null) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function truncate(text: string | null, maxLen: number): string {
  if (text == null) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

// ---------------------------------------------------------------------------
// ChatThreadRow
// ---------------------------------------------------------------------------
interface ChatThreadRowProps {
  thread: ChatThread;
  onPress: (thread: ChatThread) => void;
}

function ChatThreadRow({ thread, onPress }: ChatThreadRowProps) {
  const colors = useTheme();
  const merchantName = thread.merchant?.name ?? 'Unknown';
  const initial = merchantName.charAt(0).toUpperCase();

  return (
    <Pressable
      testID={`chat-thread-row-${thread.id}`}
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onPress(thread)}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <ThemedText style={[styles.avatarInitial, { color: colors.primaryText }]}>
          {initial}
        </ThemedText>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <ThemedText style={styles.merchantName} numberOfLines={1}>
            {merchantName}
          </ThemedText>
          <ThemedText variant="secondary" style={styles.timestamp}>
            {formatRelativeTime(thread.last_message_at)}
          </ThemedText>
        </View>

        <View style={styles.rowBottom}>
          <ThemedText
            variant="secondary"
            style={[styles.lastMessage, thread.unread_count > 0 && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {truncate(thread.last_message, 50)}
          </ThemedText>

          {thread.unread_count > 0 && (
            <View
              testID={`thread-unread-badge-${thread.id}`}
              style={[styles.badge, { backgroundColor: colors.primary }]}
            >
              <ThemedText style={[styles.badgeText, { color: colors.primaryText }]}>
                {thread.unread_count > 99 ? '99+' : thread.unread_count}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ChatListScreen
// ---------------------------------------------------------------------------
export default function ChatListScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useThreads();

  const allThreads = data?.pages.flatMap((p) => p.data) ?? [];

  const handleThreadPress = useCallback(
    (thread: ChatThread) => {
      router.push({
        pathname: '/chat/[threadId]',
        params: {
          threadId: thread.id,
          merchantName: thread.merchant?.name ?? '',
        },
      } as any);
    },
    [router]
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ChatThread }) => (
      <ChatThreadRow thread={item} onPress={handleThreadPress} />
    ),
    [handleThreadPress]
  );

  if (isLoading) {
    return (
      <ThemedView testID="chat-list-screen" style={styles.container}>
        <SkeletonCard count={6} />
      </ThemedView>
    );
  }

  return (
    <ThemedView testID="chat-list-screen" style={styles.container}>
      <FlatList
        data={allThreads}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <ThemedText
            variant="secondary"
            style={styles.emptyText}
          >
            No conversations yet
          </ThemedText>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} />
          ) : null
        }
        contentContainerStyle={allThreads.length === 0 ? styles.emptyContainer : undefined}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: FontSize.md,
  },
  footer: {
    paddingVertical: Spacing.md,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  avatarInitial: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  merchantName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.xs,
    flexShrink: 0,
  },
  lastMessage: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  lastMessageUnread: {
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: Spacing.xs,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
