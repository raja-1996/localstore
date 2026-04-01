import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useLike } from '@/hooks/use-like';
import { useComments, useCreateComment } from '@/hooks/use-comments';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface PostMerchantStub {
  id: string;
  business_name?: string;
  name?: string;
  avatar_url: string | null;
}

interface PostItem {
  id: string;
  merchant: PostMerchantStub;
  content: string;
  image_url: string | null;
  post_type: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me?: boolean;
  created_at: string;
}

interface PostCardProps {
  item: PostItem;
}

// ---------------------------------------------------------------------------
// CommentsBottomSheet
// ---------------------------------------------------------------------------

interface CommentsBottomSheetProps {
  postId: string;
  onClose: () => void;
}

function CommentsBottomSheet({ postId, onClose }: CommentsBottomSheetProps) {
  const colors = useTheme();
  const { data } = useComments(postId);
  const createComment = useCreateComment();
  const [inputText, setInputText] = useState('');

  const comments = data?.data ?? [];

  const handleSubmit = useCallback(() => {
    const content = inputText.trim();
    if (!content) return;

    createComment.mutate(
      { postId, content },
      {
        onSuccess: () => setInputText(''),
      },
    );
  }, [inputText, postId, createComment]);

  return (
    <View testID="comments-sheet" style={[styles.sheet, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
        <ThemedText style={styles.sheetTitle}>Comments</ThemedText>
        <Pressable testID="comments-close-button" onPress={onClose} style={styles.sheetClose}>
          <ThemedText style={{ fontSize: FontSize.lg }}>X</ThemedText>
        </Pressable>
      </View>

      {/* Comment list */}
      {comments.length === 0 ? (
        <ThemedText variant="secondary" style={styles.emptyComments}>
          No comments yet
        </ThemedText>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={({ item: comment }) => (
            <View
              testID={`comment-item-${comment.id}`}
              style={[styles.commentItem, { borderBottomColor: colors.border }]}
            >
              <ThemedText style={styles.commentUser}>
                {comment.user?.display_name ?? comment.user?.full_name ?? 'User'}
              </ThemedText>
              <ThemedText style={styles.commentContent}>{comment.content}</ThemedText>
            </View>
          )}
          style={styles.commentList}
        />
      )}

      {/* Input row */}
      <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
        <TextInput
          testID="comment-input"
          style={[
            styles.commentInput,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
          ]}
          placeholder="Write a comment..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
        />
        <Pressable
          testID="comment-submit-button"
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={createComment.isPending}
        >
          <ThemedText style={[styles.submitText, { color: colors.primaryText }]}>
            Post
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------

export function PostCard({ item }: PostCardProps) {
  const colors = useTheme();
  const merchantName = item.merchant.business_name ?? item.merchant.name ?? '?';
  const merchantInitial = merchantName.charAt(0).toUpperCase();

  const [optimisticLikeCount, setOptimisticLikeCount] = useState(item.like_count);
  const [optimisticIsLiked, setOptimisticIsLiked] = useState(item.is_liked_by_me ?? false);
  const [showComments, setShowComments] = useState(false);

  const { mutate: likeMutate } = useLike(item.id);

  const handleLike = useCallback(() => {
    const currentlyLiked = optimisticIsLiked;

    // Optimistic update
    setOptimisticIsLiked(!currentlyLiked);
    setOptimisticLikeCount((prev) => (currentlyLiked ? prev - 1 : prev + 1));

    likeMutate(
      { postId: item.id, liked: currentlyLiked },
      {
        onError: () => {
          // Rollback
          setOptimisticIsLiked(currentlyLiked);
          setOptimisticLikeCount(item.like_count);
        },
      },
    );
  }, [optimisticIsLiked, item.id, item.like_count, likeMutate]);

  return (
    <ThemedView testID="post-card" style={[styles.card, { borderColor: colors.border }]}>
      {/* Merchant header row */}
      <View style={styles.merchantRow}>
        {item.merchant.avatar_url != null ? (
          <Image
            source={{ uri: item.merchant.avatar_url }}
            style={[styles.avatar, { backgroundColor: colors.border }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
            <ThemedText style={[styles.avatarInitial, { color: colors.primaryText }]}>
              {merchantInitial}
            </ThemedText>
          </View>
        )}

        <View style={styles.merchantMeta}>
          <ThemedText style={styles.merchantName} numberOfLines={1}>
            {merchantName}
          </ThemedText>
          <ThemedText variant="secondary" style={styles.postType}>
            {item.post_type}
          </ThemedText>
        </View>
      </View>

      {/* Post content */}
      <ThemedText style={styles.content}>{item.content}</ThemedText>

      {/* Optional image */}
      {item.image_url != null && (
        <Image
          source={{ uri: item.image_url }}
          style={styles.postImage}
          contentFit="cover"
          transition={300}
          recyclingKey={item.id}
        />
      )}

      {/* Interaction row */}
      <View style={styles.interactionRow}>
        <Pressable
          testID="like-button"
          style={styles.interactionButton}
          onPress={handleLike}
          accessibilityState={{ selected: optimisticIsLiked }}
        >
          <ThemedText
            testID={optimisticIsLiked ? 'like-button-active' : 'like-button-inactive'}
            variant="secondary"
            style={styles.interactionText}
          >
            {optimisticIsLiked ? '♥' : '♡'}
          </ThemedText>
          <ThemedText testID="like-count" variant="secondary" style={styles.interactionText}>
            {optimisticLikeCount}
          </ThemedText>
        </Pressable>

        <Pressable
          testID="comment-button"
          style={styles.interactionButton}
          onPress={() => setShowComments(true)}
        >
          <ThemedText variant="secondary" style={styles.interactionText}>
            💬
          </ThemedText>
          <ThemedText testID="comment-count" variant="secondary" style={styles.interactionText}>
            {item.comment_count}
          </ThemedText>
        </Pressable>
      </View>

      {/* Comments bottom sheet — rendered as modal */}
      {showComments && (
        <Modal
          visible={showComments}
          transparent
          animationType="slide"
          onRequestClose={() => setShowComments(false)}
        >
          <View style={styles.sheetOverlay}>
            <CommentsBottomSheet
              postId={item.id}
              onClose={() => setShowComments(false)}
            />
          </View>
        </Modal>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  merchantMeta: {
    flex: 1,
    gap: 2,
  },
  merchantName: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  postType: {
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
  },
  content: {
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  interactionRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  interactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  interactionText: {
    fontSize: FontSize.sm,
  },

  // Sheet overlay
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
    paddingBottom: Spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  sheetClose: {
    padding: Spacing.xs,
  },
  commentList: {
    flexGrow: 0,
    maxHeight: 300,
  },
  commentItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  commentUser: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  commentContent: {
    fontSize: FontSize.sm,
  },
  emptyComments: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: FontSize.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  submitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  submitText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
