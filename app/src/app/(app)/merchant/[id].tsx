import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SkeletonCard } from '@/components/SkeletonCard';
import { StarRating } from '@/components/StarRating';
import { PostCard } from '@/components/PostCard';
import { useMerchant } from '@/hooks/use-merchant';
import { useFollow } from '@/hooks/use-follow';
import { useCreateThread } from '@/hooks/use-chat';
import { usePosts } from '@/hooks/use-posts';
import { useReviews, useCreateReview, useUpdateReview, useDeleteReview } from '@/hooks/use-reviews';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import { formatDistance } from '@/utils/format-distance';
import type { MerchantDetail, ServiceResponse, PortfolioImage } from '@/types/merchant';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTFOLIO_IMAGE_SIZE = (SCREEN_WIDTH - Spacing.md * 2) / 3;

// ---------------------------------------------------------------------------
// MerchantHeader
// ---------------------------------------------------------------------------
interface MerchantHeaderProps {
  merchant: MerchantDetail;
}

function MerchantHeader({ merchant }: MerchantHeaderProps) {
  const colors = useTheme();
  const isFollowing = merchant.is_following ?? false;
  const { toggle, isLoading } = useFollow({
    merchantId: merchant.id,
    isFollowing,
  });

  return (
    <View style={styles.headerContainer}>
      {/* Avatar */}
      <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
        <ThemedText style={[styles.avatarInitial, { color: colors.primaryText }]}>
          {merchant.name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>

      {/* Name */}
      <ThemedText testID="merchant-name" style={styles.merchantName}>
        {merchant.name}
      </ThemedText>

      {/* Category + verified row */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: colors.border }]}>
          <ThemedText variant="secondary" style={styles.badgeText}>
            {merchant.category}
          </ThemedText>
        </View>

        {merchant.is_verified && (
          <View style={[styles.badge, { backgroundColor: colors.success }]}>
            <ThemedText style={[styles.badgeText, { color: '#FFFFFF' }]}>
              ✓ Verified
            </ThemedText>
          </View>
        )}
      </View>

      {/* Follow button + follower count */}
      {!merchant.is_owner && (
        <View style={styles.followRow}>
          <Pressable
            testID="follow-button"
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing ? colors.border : colors.primary,
                borderColor: isFollowing ? colors.border : colors.primary,
              },
            ]}
            onPress={toggle}
            disabled={isLoading}
          >
            <ThemedText
              style={[
                styles.followButtonText,
                { color: isFollowing ? colors.text : colors.primaryText },
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </ThemedText>
          </Pressable>

          <ThemedText testID="follower-count" variant="secondary" style={styles.followerCount}>
            {merchant.follower_count}{' '}
            {merchant.follower_count === 1 ? 'follower' : 'followers'}
          </ThemedText>
        </View>
      )}

      {/* Neighborhood */}
      {merchant.neighborhood != null && (
        <ThemedText variant="secondary" style={styles.neighborhood}>
          {merchant.neighborhood}
        </ThemedText>
      )}

      {/* Rating */}
      <ThemedText variant="secondary" style={styles.rating}>
        {merchant.avg_rating != null
          ? `★ ${Number(merchant.avg_rating).toFixed(1)} (${merchant.review_count} reviews)`
          : `${merchant.review_count} reviews`}
      </ThemedText>

      {/* Distance */}
      {merchant.distance_meters != null && (
        <ThemedText variant="secondary" style={styles.distance}>
          {formatDistance(merchant.distance_meters)}
        </ThemedText>
      )}

      {/* Description */}
      {merchant.description != null && (
        <ThemedText variant="secondary" style={styles.description} numberOfLines={2}>
          {merchant.description}
        </ThemedText>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ServicesSection
// ---------------------------------------------------------------------------
interface ServicesSectionProps {
  services: ServiceResponse[];
}

function ServicesSection({ services }: ServicesSectionProps) {
  const colors = useTheme();

  return (
    <View testID="services-section" style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Services</ThemedText>

      {services.length === 0 ? (
        <ThemedText variant="secondary">No services listed yet</ThemedText>
      ) : (
        services.map((item) => (
          <View key={item.id} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.serviceHeader}>
              <ThemedText style={styles.serviceName}>{item.name}</ThemedText>
              <ThemedText style={[styles.servicePrice, { color: colors.primary }]}>
                {`Rs ${item.price}`}
              </ThemedText>
            </View>
            {item.description != null && (
              <ThemedText variant="secondary" style={styles.serviceDesc} numberOfLines={2}>
                {item.description}
              </ThemedText>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PortfolioSection
// ---------------------------------------------------------------------------
interface PortfolioSectionProps {
  portfolio: PortfolioImage[];
}

function PortfolioSection({ portfolio }: PortfolioSectionProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <View testID="portfolio-section" style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Portfolio</ThemedText>

      {portfolio.length === 0 ? (
        <ThemedText variant="secondary">No portfolio images yet</ThemedText>
      ) : (
        <View style={styles.portfolioGrid}>
          {portfolio.map((image) => (
            <Pressable
              key={image.id}
              onPress={() => setSelectedImage(image.image_url)}
              style={styles.portfolioImageWrapper}
            >
              <Image
                source={{ uri: image.image_url }}
                style={[
                  styles.portfolioImage,
                  { width: PORTFOLIO_IMAGE_SIZE, height: PORTFOLIO_IMAGE_SIZE },
                ]}
                contentFit="cover"
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* Full-screen image modal */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedImage != null && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImage}
              contentFit="contain"
            />
          )}
          <Pressable
            style={styles.modalCloseButton}
            onPress={() => setSelectedImage(null)}
          >
            <ThemedText style={styles.modalCloseText}>✕</ThemedText>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ContactSection
// ---------------------------------------------------------------------------
interface ContactSectionProps {
  merchant: MerchantDetail;
}

function ContactSection({ merchant }: ContactSectionProps) {
  const colors = useTheme();
  const router = useRouter();
  const createThread = useCreateThread();

  const handleWhatsApp = useCallback(() => {
    Alert.alert('Coming Soon', 'Chat coming soon — share via WhatsApp link');
  }, []);

  const handleChatPress = useCallback(() => {
    createThread.mutate(merchant.id, {
      onSuccess: (thread) => {
        router.push({
          pathname: '/chat/[threadId]',
          params: { threadId: thread.id, merchantName: merchant.name },
        } as any);
      },
    });
  }, [createThread, merchant.id, merchant.name, router]);

  return (
    <View testID="contact-section" style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Contact</ThemedText>

      {merchant.phone != null && (
        <View style={styles.contactRow}>
          <ThemedText variant="secondary" style={styles.contactLabel}>Phone</ThemedText>
          <ThemedText style={styles.contactValue}>{merchant.phone}</ThemedText>
        </View>
      )}

      {merchant.address_text != null && (
        <View style={styles.contactRow}>
          <ThemedText variant="secondary" style={styles.contactLabel}>Address</ThemedText>
          <ThemedText style={styles.contactValue}>{merchant.address_text}</ThemedText>
        </View>
      )}

      {!merchant.is_owner && (
        <Pressable
          testID="chat-button"
          style={[styles.whatsappButton, { backgroundColor: colors.primary }]}
          onPress={handleChatPress}
          disabled={createThread.isPending}
        >
          <ThemedText style={styles.whatsappButtonText}>
            {createThread.isPending ? 'Opening...' : 'Chat'}
          </ThemedText>
        </Pressable>
      )}

      <Pressable
        style={[styles.whatsappButton, { backgroundColor: '#25D366' }]}
        onPress={handleWhatsApp}
      >
        <ThemedText style={styles.whatsappButtonText}>WhatsApp</ThemedText>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ReviewsSection
// ---------------------------------------------------------------------------
interface ReviewsSectionProps {
  merchantId: string;
  isOwner: boolean;
}

function ReviewsSection({ merchantId, isOwner }: ReviewsSectionProps) {
  const colors = useTheme();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, isError } = useReviews(merchantId);

  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();

  const [showForm, setShowForm] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [bodyText, setBodyText] = useState('');

  const reviews = data?.data ?? [];
  const avgRating = data?.avg_rating ?? 0;
  const reviewCount = data?.count ?? 0;

  const ownReview =
    reviews.find(
      (r) => r.reviewer.id.toString().toLowerCase() === currentUserId?.toString().toLowerCase(),
    ) ?? null;
  const isEditMode = ownReview !== null;

  const openForm = useCallback(() => {
    if (ownReview) {
      setSelectedRating(ownReview.rating);
      setBodyText(ownReview.body ?? '');
    } else {
      setSelectedRating(0);
      setBodyText('');
    }
    setShowForm(true);
  }, [ownReview]);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setSelectedRating(0);
    setBodyText('');
  }, []);

  const createMutate = createReview.mutate;
  const updateMutate = updateReview.mutate;
  const deleteMutate = deleteReview.mutate;

  const handleSubmit = useCallback(() => {
    if (selectedRating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }

    const payload = {
      rating: selectedRating,
      body: bodyText.trim() || undefined,
    };

    const onError = (err: Error) => {
      const status = (err as unknown as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        Alert.alert('Error', "You've already reviewed this merchant");
      } else if (status === 403) {
        Alert.alert('Error', 'Cannot review your own business');
      } else {
        Alert.alert('Error', 'Failed to submit review');
      }
    };

    if (isEditMode && ownReview) {
      updateMutate(
        { merchantId, reviewId: ownReview.id, payload },
        { onSuccess: closeForm, onError },
      );
    } else {
      createMutate(
        { merchantId, payload },
        { onSuccess: closeForm, onError },
      );
    }
  }, [
    selectedRating,
    bodyText,
    isEditMode,
    ownReview,
    merchantId,
    createMutate,
    updateMutate,
    closeForm,
  ]);

  const handleDelete = useCallback(() => {
    if (!ownReview) return;
    Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMutate(
            { merchantId, reviewId: ownReview.id },
            {
              onSuccess: closeForm,
              onError: () => Alert.alert('Error', 'Failed to delete review'),
            },
          );
        },
      },
    ]);
  }, [ownReview, merchantId, deleteMutate, closeForm]);

  const isMutating =
    createReview.isPending || updateReview.isPending || deleteReview.isPending;

  return (
    <View testID="reviews-section" style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Reviews</ThemedText>

      {/* Avg rating header */}
      {!isLoading && !isError && (
        avgRating > 0 ? (
          <View testID="reviews-avg-rating" style={styles.reviewsRatingRow}>
            <StarRating rating={avgRating} size="small" />
            <ThemedText variant="secondary" style={styles.reviewsRatingText}>
              {`${avgRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`}
            </ThemedText>
          </View>
        ) : (
          <ThemedText variant="secondary">No reviews yet</ThemedText>
        )
      )}

      {/* Review list */}
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : isError ? (
        <ThemedText variant="secondary">Failed to load reviews</ThemedText>
      ) : (
        reviews.map((review) => {
          const initial = (review.reviewer.display_name ?? '?').charAt(0).toUpperCase();
          return (
            <View
              key={review.id}
              testID={`review-card-${review.id}`}
              style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.reviewHeader}>
                <View style={[styles.reviewerAvatar, { backgroundColor: colors.primary }]}>
                  <ThemedText style={[styles.reviewerInitial, { color: colors.primaryText }]}>
                    {initial}
                  </ThemedText>
                </View>
                <View style={styles.reviewerMeta}>
                  <ThemedText style={styles.reviewerName}>
                    {review.reviewer.display_name ?? 'Anonymous'}
                  </ThemedText>
                  <StarRating rating={review.rating} size="small" />
                </View>
                <ThemedText variant="secondary" style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </ThemedText>
              </View>
              {review.body != null && (
                <ThemedText testID="review-body-text" style={styles.reviewBody}>{review.body}</ThemedText>
              )}
            </View>
          );
        })
      )}

      {/* Write / Edit review button */}
      {!isOwner && (
        <Pressable
          testID="write-review-button"
          style={[styles.writeReviewButton, { backgroundColor: colors.primary }]}
          onPress={openForm}
          disabled={isMutating}
        >
          <ThemedText style={[styles.writeReviewText, { color: colors.primaryText }]}>
            {isEditMode ? 'Edit Your Review' : 'Write a Review'}
          </ThemedText>
        </Pressable>
      )}

      {/* Write / Edit review modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <View style={styles.reviewModalOverlay}>
          <View testID="review-modal" style={[styles.reviewModalSheet, { backgroundColor: colors.background }]}>
            {/* Modal header */}
            <View style={styles.reviewModalHeader}>
              <ThemedText style={styles.reviewModalTitle}>
                {isEditMode ? 'Edit Review' : 'Write a Review'}
              </ThemedText>
              {isEditMode && (
                <Pressable testID="review-delete-button" onPress={handleDelete} disabled={isMutating}>
                  <ThemedText style={[styles.reviewDeleteText, { color: colors.danger }]}>
                    Delete
                  </ThemedText>
                </Pressable>
              )}
              <Pressable onPress={closeForm} style={styles.reviewModalClose}>
                <ThemedText style={styles.reviewModalCloseText}>✕</ThemedText>
              </Pressable>
            </View>

            {/* Star picker */}
            <View style={styles.reviewStarPicker}>
              <StarRating
                rating={selectedRating}
                size="large"
                interactive
                onRatingChange={setSelectedRating}
              />
            </View>

            {/* Body input */}
            <TextInput
              testID="review-body-input"
              style={[
                styles.reviewBodyInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Write a review... (optional)"
              placeholderTextColor={colors.textSecondary}
              value={bodyText}
              onChangeText={setBodyText}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            {/* Submit */}
            <Pressable
              testID="review-submit-button"
              style={[
                styles.reviewSubmitButton,
                {
                  backgroundColor:
                    selectedRating === 0 ? colors.border : colors.primary,
                },
              ]}
              onPress={handleSubmit}
              disabled={selectedRating === 0 || isMutating}
            >
              {isMutating ? (
                <ActivityIndicator size="small" color={colors.primaryText} />
              ) : (
                <ThemedText
                  style={[
                    styles.reviewSubmitText,
                    { color: selectedRating === 0 ? colors.textSecondary : colors.primaryText },
                  ]}
                >
                  {isEditMode ? 'Update Review' : 'Submit Review'}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PostsSection
// ---------------------------------------------------------------------------
interface PostsSectionProps {
  merchantId: string;
}

function PostsSection({ merchantId }: PostsSectionProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts(merchantId);

  const allPosts = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View testID="posts-section" style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Posts</ThemedText>

      <FlatList
        testID="posts-list"
        data={allPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard item={item} />}
        onEndReached={() => {
          if (hasNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        scrollEnabled={false}
        ListEmptyComponent={
          <ThemedText variant="secondary">No posts yet</ThemedText>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ paddingVertical: Spacing.md }} />
          ) : null
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// MerchantDetailScreen
// ---------------------------------------------------------------------------
export default function MerchantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useMerchant(id);

  if (isLoading) {
    return (
      <ThemedView testID="merchant-detail-screen" style={styles.container}>
        <SkeletonCard count={3} />
      </ThemedView>
    );
  }

  if (isError || data == null) {
    return (
      <ThemedView testID="merchant-detail-screen" style={styles.container}>
        <ThemedText variant="secondary" style={styles.errorText}>
          Failed to load merchant
        </ThemedText>
      </ThemedView>
    );
  }

  const { merchant, services, portfolio } = data;

  return (
    <ThemedView testID="merchant-detail-screen" style={styles.container}>
      {/* Custom back button */}
      <Pressable
        testID="back-button"
        style={styles.backButton}
        onPress={() => (router.canGoBack?.() ? router.back() : router.back())}
      >
        <ThemedText style={styles.backButtonText}>← Back</ThemedText>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <MerchantHeader merchant={merchant} />
        <ServicesSection services={services} />
        <PortfolioSection portfolio={portfolio} />
        <ContactSection merchant={merchant} />
        <ReviewsSection merchantId={merchant.id} isOwner={merchant.is_owner} />
        <PostsSection merchantId={merchant.id} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 150,
  },
  errorText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: FontSize.md,
  },

  // Back button
  backButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSize.md,
  },

  // MerchantHeader
  headerContainer: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  followButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  followerCount: {
    fontSize: FontSize.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarInitial: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
  },
  merchantName: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.sm,
  },
  neighborhood: {
    fontSize: FontSize.sm,
  },
  rating: {
    fontSize: FontSize.sm,
  },
  distance: {
    fontSize: FontSize.sm,
  },
  description: {
    fontSize: FontSize.md,
  },

  // Section shared
  section: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },

  // ServicesSection
  serviceCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  servicePrice: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  serviceDesc: {
    fontSize: FontSize.sm,
  },

  // PortfolioSection
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  portfolioImageWrapper: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  portfolioImage: {
    borderRadius: BorderRadius.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  modalCloseButton: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.md,
    padding: Spacing.sm,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: FontSize.xl,
  },

  // ReviewsSection
  reviewsRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  reviewsRatingText: {
    fontSize: FontSize.sm,
  },
  reviewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewerInitial: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  reviewerMeta: {
    flex: 1,
    gap: 2,
  },
  reviewerName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: FontSize.sm,
  },
  reviewBody: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  writeReviewButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  writeReviewText: {
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reviewModalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  reviewDeleteText: {
    fontSize: FontSize.sm,
    marginRight: Spacing.md,
  },
  reviewModalClose: {
    padding: Spacing.xs,
  },
  reviewModalCloseText: {
    fontSize: FontSize.lg,
  },
  reviewStarPicker: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  reviewBodyInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    minHeight: 100,
  },
  reviewSubmitButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  reviewSubmitText: {
    fontWeight: '600',
    fontSize: FontSize.md,
  },

  // ContactSection
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  contactLabel: {
    fontSize: FontSize.sm,
  },
  contactValue: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  whatsappButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FontSize.md,
  },
});
