import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { useLocationStore } from '@/stores/location-store';
import { merchantService } from '@/services/merchant-service';
import storageService from '@/services/storage-service';
import { useQueryClient } from '@tanstack/react-query';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { CATEGORIES, CATEGORY_LABELS } from '@/constants/categories';
import type { MerchantCategory } from '@/types/feed';

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface WizardState {
  step: Step;
  name: string;
  category: MerchantCategory | null;
  description: string;
  avatarUri: string | null;
  phone: string;
  whatsapp: string;
  hasServiceData: boolean;
  serviceName: string;
  servicePrice: string;
  serviceDescription: string;
  portfolioImages: Array<{ uri: string }>;
}

function initialState(): WizardState {
  return {
    step: 1,
    name: '',
    category: null,
    description: '',
    avatarUri: null,
    phone: '',
    whatsapp: '',
    hasServiceData: false,
    serviceName: '',
    servicePrice: '',
    serviceDescription: '',
    portfolioImages: [],
  };
}

// ---------------------------------------------------------------------------
// CategorySelectorModal
// ---------------------------------------------------------------------------

interface CategorySelectorModalProps {
  visible: boolean;
  selected: MerchantCategory | null;
  onSelect: (cat: MerchantCategory) => void;
  onClose: () => void;
}

function CategorySelectorModal({
  visible,
  selected,
  onSelect,
  onClose,
}: CategorySelectorModalProps) {
  const colors = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <ThemedText style={styles.modalTitle}>Select Category</ThemedText>

          {CATEGORIES.map((cat, index) => {
            const isSelected = selected === cat;
            return (
              <Pressable
                key={cat}
                testID={`category-option-${index}`}
                style={[
                  styles.categoryOption,
                  { borderColor: colors.border },
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => {
                  onSelect(cat);
                  onClose();
                }}
              >
                <ThemedText
                  style={[
                    styles.categoryOptionText,
                    isSelected && { color: colors.primaryText },
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </ThemedText>
              </Pressable>
            );
          })}

          <Pressable style={styles.modalCancel} onPress={onClose}>
            <ThemedText variant="secondary">Cancel</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// StepHeader
// ---------------------------------------------------------------------------

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  const colors = useTheme();
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepIndicatorRow}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[
              styles.stepDot,
              { backgroundColor: n <= step ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>
      <ThemedText style={styles.stepTitle}>{title}</ThemedText>
      <ThemedText variant="secondary" style={styles.stepSubtitle}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LoadingOverlay
// ---------------------------------------------------------------------------

function LoadingOverlay() {
  const colors = useTheme();
  return (
    <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.loadingBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText style={styles.loadingText}>Creating your profile…</ThemedText>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SuccessView
// ---------------------------------------------------------------------------

function SuccessView({
  warning,
  onGoToFeed,
}: {
  warning: string | null;
  onGoToFeed: () => void;
}) {
  const colors = useTheme();
  return (
    <ThemedView testID="merchant-create-success" style={styles.successContainer}>
      <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
        <ThemedText style={styles.successIconText}>✓</ThemedText>
      </View>

      <ThemedText style={styles.successTitle}>Profile Created!</ThemedText>

      {warning != null ? (
        <ThemedText variant="secondary" style={styles.successWarning}>
          {warning}
        </ThemedText>
      ) : (
        <ThemedText variant="secondary" style={styles.successSubtitle}>
          Your merchant profile is live. Customers nearby can now find you.
        </ThemedText>
      )}

      <Button
        testID="go-to-feed-button"
        title="Go to Feed"
        onPress={onGoToFeed}
        style={styles.goToFeedButton}
      />
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// MerchantCreateWizard — main screen
// ---------------------------------------------------------------------------

export default function MerchantCreateScreen() {
  const colors = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const coords = useLocationStore((s) => s.coords);
  const { width: screenWidth } = useWindowDimensions();
  const portfolioThumb = (screenWidth - Spacing.md * 2 - Spacing.sm * 2) / 3;

  const [state, setState] = useState<WizardState>(initialState);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = useCallback(
    (updates: Partial<WizardState>) => setState((prev) => ({ ...prev, ...updates })),
    []
  );

  // Ref keeps handleSubmit stable (not recreated on every keystroke).
  const stateRef = React.useRef(state);
  React.useEffect(() => { stateRef.current = state; }, [state]);

  // ─── Step 1 ────────────────────────────────────────────────────────────────

  const handleStep1Next = useCallback(() => {
    if (!state.name.trim()) {
      setStep1Error('Business name is required');
      return;
    }
    if (state.category === null) {
      setStep1Error('Please select a category');
      return;
    }
    if (coords === null) {
      setStep1Error('Location is required — enable location access in Settings');
      return;
    }
    setStep1Error(null);
    patch({ step: 2 });
  }, [state.name, state.category, coords, patch]);

  // ─── Step 2 ────────────────────────────────────────────────────────────────

  const handlePickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      patch({ avatarUri: result.assets[0].uri });
    }
  }, [patch]);

  // ─── Step 3 ────────────────────────────────────────────────────────────────

  const handleStep3Skip = useCallback(() => {
    patch({ hasServiceData: false, step: 4 });
  }, [patch]);

  const handleStep3Next = useCallback(() => {
    patch({ hasServiceData: true, step: 4 });
  }, [patch]);

  // ─── Step 4 ────────────────────────────────────────────────────────────────

  const handlePickPortfolio = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets.length > 0) {
      const imgs = result.assets.map((a) => ({ uri: a.uri }));
      patch({ portfolioImages: imgs });
    }
  }, [patch]);

  // ─── Submission ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const s = stateRef.current;
    if (coords === null || s.category === null) return;

    setIsSubmitting(true);
    setSubmitError(null);

    let merchantId: string;

    // Step 1: Create merchant
    try {
      const res = await merchantService.createMerchant({
        name: s.name.trim(),
        category: s.category,
        description: s.description.trim() || undefined,
        lat: coords.latitude,
        lng: coords.longitude,
        phone: s.phone.trim() || undefined,
        whatsapp: s.whatsapp.trim() || undefined,
      });
      merchantId = res.data.id;
    } catch (err: unknown) {
      const msg =
        err != null &&
        typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data
          ?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : 'Failed to create merchant profile. Please try again.';
      setSubmitError(msg);
      setIsSubmitting(false);
      return;
    }

    // Invalidate queries immediately after merchant creation
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });

    let hadPartialFailure = false;

    // Step 2: Create service (optional)
    if (s.hasServiceData && s.serviceName.trim()) {
      const priceNum = parseFloat(s.servicePrice);
      if (!isNaN(priceNum)) {
        try {
          await merchantService.createService(merchantId, {
            name: s.serviceName.trim(),
            price: priceNum,
            description: s.serviceDescription.trim() || undefined,
          });
        } catch {
          hadPartialFailure = true;
        }
      }
    }

    // Step 3: Upload avatar (optional)
    if (s.avatarUri) {
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: s.avatarUri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        } as unknown as Blob);
        formData.append('path', `merchant-avatars/${merchantId}/avatar.jpg`);
        const { data: uploadData } = await storageService.upload(formData);
        await merchantService.updateMerchant(merchantId, { avatar_url: uploadData.url });
      } catch {
        hadPartialFailure = true;
      }
    }

    // Step 4: Upload portfolio images (optional)
    for (let imgIdx = 0; imgIdx < s.portfolioImages.length; imgIdx++) {
      const img = s.portfolioImages[imgIdx];
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `portfolio-${imgIdx}.jpg`,
        } as unknown as Blob);
        formData.append('path', `portfolio-images/${merchantId}/${Date.now()}-${imgIdx}.jpg`);
        const { data: uploadData } = await storageService.upload(formData);
        await merchantService.addPortfolioImage(merchantId, { image_url: uploadData.url });
      } catch {
        hadPartialFailure = true;
      }
    }

    setIsSubmitting(false);

    if (hadPartialFailure) {
      setSubmitWarning(
        'Your profile was created. Some media uploads failed.'
      );
    }

    setIsDone(true);
  }, [coords, queryClient]);

  const handleGoToFeed = useCallback(() => {
    router.replace('/(app)/feed');
  }, [router]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isDone) {
    return <SuccessView warning={submitWarning} onGoToFeed={handleGoToFeed} />;
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* ── Step 1 ── */}
          {state.step === 1 && (
            <View testID="merchant-create-step-1" style={styles.stepContainer}>
              <StepHeader
                step={1}
                title="Business Info"
                subtitle="Tell us about your business"
              />

              {/* Name */}
              <ThemedText style={styles.fieldLabel}>Business Name *</ThemedText>
              <TextInput
                testID="merchant-name-input"
                style={[
                  styles.textInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="e.g. Lakshmi Beauty Parlour"
                placeholderTextColor={colors.textSecondary}
                value={state.name}
                onChangeText={(v) => patch({ name: v })}
                returnKeyType="next"
              />

              {/* Category */}
              <ThemedText style={styles.fieldLabel}>Category *</ThemedText>
              <Pressable
                testID="merchant-category-selector"
                style={[
                  styles.categorySelectorButton,
                  {
                    borderColor: state.category ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
                onPress={() => setCategoryModalVisible(true)}
              >
                <ThemedText
                  style={state.category ? styles.categorySelectorSelected : undefined}
                >
                  {state.category
                    ? CATEGORY_LABELS[state.category]
                    : 'Select a category…'}
                </ThemedText>
              </Pressable>

              {/* Description */}
              <ThemedText style={styles.fieldLabel}>Description</ThemedText>
              <TextInput
                testID="merchant-description-input"
                style={[
                  styles.textInput,
                  styles.textInputMultiline,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="Briefly describe your business (optional)"
                placeholderTextColor={colors.textSecondary}
                value={state.description}
                onChangeText={(v) => patch({ description: v })}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Location */}
              <View
                style={[
                  styles.locationBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: coords ? colors.success : colors.border,
                  },
                ]}
              >
                {coords ? (
                  <ThemedText variant="secondary" style={styles.locationText}>
                    📍 Using current location
                  </ThemedText>
                ) : (
                  <ThemedText
                    style={[styles.locationWarning, { color: colors.danger }]}
                  >
                    ⚠ Location required — enable location access in Settings
                  </ThemedText>
                )}
              </View>

              {step1Error != null && (
                <ThemedText style={[styles.errorText, { color: colors.danger }]}>
                  {step1Error}
                </ThemedText>
              )}

              <Button
                testID="step-next-button"
                title="Next"
                onPress={handleStep1Next}
                disabled={coords === null}
                style={styles.actionButton}
              />
            </View>
          )}

          {/* ── Step 2 ── */}
          {state.step === 2 && (
            <View testID="merchant-create-step-2" style={styles.stepContainer}>
              <StepHeader
                step={2}
                title="Profile & Contact"
                subtitle="Add your photo and contact details"
              />

              {/* Avatar picker */}
              <ThemedText style={styles.fieldLabel}>Profile Photo</ThemedText>
              <Pressable
                testID="merchant-avatar-picker"
                style={[styles.avatarPickerButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={handlePickAvatar}
              >
                {state.avatarUri ? (
                  <Image
                    source={{ uri: state.avatarUri }}
                    style={styles.avatarPreview}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarPickerPlaceholder}>
                    <ThemedText style={styles.avatarPickerPlus}>+</ThemedText>
                    <ThemedText variant="secondary" style={styles.avatarPickerHint}>
                      Tap to add photo
                    </ThemedText>
                  </View>
                )}
              </Pressable>

              {/* Phone */}
              <ThemedText style={styles.fieldLabel}>Phone Number</ThemedText>
              <TextInput
                testID="merchant-phone-input"
                style={[
                  styles.textInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="+91 9876543210"
                placeholderTextColor={colors.textSecondary}
                value={state.phone}
                onChangeText={(v) => patch({ phone: v })}
                keyboardType="phone-pad"
              />

              {/* WhatsApp */}
              <ThemedText style={styles.fieldLabel}>WhatsApp Number</ThemedText>
              <TextInput
                testID="merchant-whatsapp-input"
                style={[
                  styles.textInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="+91 9876543210"
                placeholderTextColor={colors.textSecondary}
                value={state.whatsapp}
                onChangeText={(v) => patch({ whatsapp: v })}
                keyboardType="phone-pad"
              />

              <View style={styles.buttonRow}>
                <Button
                  testID="step-back-button"
                  title="Back"
                  variant="outline"
                  onPress={() => patch({ step: 1 })}
                  style={styles.backButton}
                />
                <Button
                  testID="step-next-button"
                  title="Next"
                  onPress={() => patch({ step: 3 })}
                  style={styles.nextButton}
                />
              </View>
            </View>
          )}

          {/* ── Step 3 ── */}
          {state.step === 3 && (
            <View testID="merchant-create-step-3" style={styles.stepContainer}>
              <StepHeader
                step={3}
                title="Add a Service"
                subtitle="Optionally list your first service"
              />

              {/* Service name */}
              <ThemedText style={styles.fieldLabel}>Service Name</ThemedText>
              <TextInput
                testID="service-name-input"
                style={[
                  styles.textInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="e.g. Haircut"
                placeholderTextColor={colors.textSecondary}
                value={state.serviceName}
                onChangeText={(v) => patch({ serviceName: v })}
              />

              {/* Service price */}
              <ThemedText style={styles.fieldLabel}>Price (Rs)</ThemedText>
              <TextInput
                testID="service-price-input"
                style={[
                  styles.textInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="e.g. 300"
                placeholderTextColor={colors.textSecondary}
                value={state.servicePrice}
                onChangeText={(v) => patch({ servicePrice: v })}
                keyboardType="numeric"
              />

              {/* Service description */}
              <ThemedText style={styles.fieldLabel}>Service Description</ThemedText>
              <TextInput
                testID="service-description-input"
                style={[
                  styles.textInput,
                  styles.textInputMultiline,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                placeholder="Optional details about this service"
                placeholderTextColor={colors.textSecondary}
                value={state.serviceDescription}
                onChangeText={(v) => patch({ serviceDescription: v })}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              <View style={styles.buttonRow}>
                <Button
                  testID="step-back-button"
                  title="Back"
                  variant="outline"
                  onPress={() => patch({ step: 2 })}
                  style={styles.backButton}
                />
                <Button
                  testID="step-skip-button"
                  title="Skip"
                  variant="outline"
                  onPress={handleStep3Skip}
                  style={styles.skipButton}
                />
                <Button
                  testID="step-next-button"
                  title="Next"
                  onPress={handleStep3Next}
                  style={styles.nextButton}
                />
              </View>
            </View>
          )}

          {/* ── Step 4 ── */}
          {state.step === 4 && (
            <View testID="merchant-create-step-4" style={styles.stepContainer}>
              <StepHeader
                step={4}
                title="Portfolio"
                subtitle="Add photos of your work (optional)"
              />

              <Button
                testID="portfolio-picker-button"
                title={
                  state.portfolioImages.length > 0
                    ? `${state.portfolioImages.length} photo(s) selected — tap to change`
                    : 'Select Photos (up to 10)'
                }
                variant="outline"
                onPress={handlePickPortfolio}
                style={styles.portfolioPickerButton}
              />

              {/* Preview grid */}
              {state.portfolioImages.length > 0 && (
                <View style={styles.portfolioGrid}>
                  {state.portfolioImages.map((img) => (
                    <Image
                      key={img.uri}
                      source={{ uri: img.uri }}
                      style={[
                        styles.portfolioThumb,
                        { width: portfolioThumb, height: portfolioThumb },
                      ]}
                      contentFit="cover"
                    />
                  ))}
                </View>
              )}

              {submitError != null && (
                <ThemedText style={[styles.errorText, { color: colors.danger }]}>
                  {submitError}
                </ThemedText>
              )}

              <View style={styles.buttonRow}>
                <Button
                  testID="step-back-button"
                  title="Back"
                  variant="outline"
                  onPress={() => patch({ step: 3 })}
                  style={styles.backButton}
                />
                <Button
                  testID="step-skip-button"
                  title="Skip"
                  variant="outline"
                  onPress={handleSubmit}
                  style={styles.skipButton}
                />
                <Button
                  testID="step-create-button"
                  title="Create"
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  style={styles.nextButton}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category selector modal */}
      <CategorySelectorModal
        visible={categoryModalVisible}
        selected={state.category}
        onSelect={(cat) => patch({ category: cat })}
        onClose={() => setCategoryModalVisible(false)}
      />

      {/* Loading overlay */}
      {isSubmitting && <LoadingOverlay />}
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
  },

  // Step containers
  stepContainer: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  stepHeader: {
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  stepSubtitle: {
    fontSize: FontSize.md,
  },

  // Field label
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },

  // Text inputs
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    minHeight: 44,
  },
  textInputMultiline: {
    minHeight: 80,
    paddingTop: Spacing.sm,
  },

  // Category selector button
  categorySelectorButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  categorySelectorSelected: {
    fontWeight: '600',
  },

  // Location box
  locationBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  locationText: {
    fontSize: FontSize.sm,
  },
  locationWarning: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },

  // Error text
  errorText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },

  // Buttons
  actionButton: {
    marginTop: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  backButton: {
    flex: 1,
  },
  skipButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },

  // Avatar picker
  avatarPickerButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderRadius: 50,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPickerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerPlus: {
    fontSize: 28,
    lineHeight: 32,
  },
  avatarPickerHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },

  // Portfolio
  portfolioPickerButton: {
    marginTop: Spacing.xs,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  portfolioThumb: {
    borderRadius: BorderRadius.sm,
  },

  // Category modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  categoryOption: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  categoryOptionText: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
  },

  // Success view
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: {
    fontSize: FontSize.xxl,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  successWarning: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  goToFeedButton: {
    marginTop: Spacing.md,
    minWidth: 200,
  },
});
