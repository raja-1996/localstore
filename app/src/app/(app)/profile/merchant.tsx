import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import {
  useOwnMerchant,
  useMerchant,
  useUpdateMerchant,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useAddPortfolioImage,
  useDeletePortfolioImage,
} from '@/hooks/use-merchant';
import storageService from '@/services/storage-service';
import api from '@/lib/api';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { CATEGORIES, CATEGORY_LABELS } from '@/constants/categories';
import type { MerchantCategory } from '@/types/feed';
import type { ServiceResponse, PortfolioImage, MerchantUpdate } from '@/types/merchant';

type ActiveSection = 'profile' | 'services' | 'portfolio';

// Shared helper — avoids recomputing identical style arrays in multiple components.
function buildInputStyles(colors: ReturnType<typeof useTheme>) {
  const base = [styles.textInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }] as const;
  const error = [styles.textInput, { borderColor: colors.danger, color: colors.text, backgroundColor: colors.surface }] as const;
  return { base, error };
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View
          style={[styles.modalSheet, { backgroundColor: colors.background }]}
          // Prevent backdrop tap from closing when tapping inside sheet
          onStartShouldSetResponder={() => true}
        >
          <ThemedText style={styles.modalTitle}>Select Category</ThemedText>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryOption,
                {
                  backgroundColor:
                    selected === cat ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                onSelect(cat);
                onClose();
              }}
            >
              <ThemedText
                style={[
                  styles.categoryOptionText,
                  { color: selected === cat ? colors.primaryText : colors.text },
                ]}
              >
                {CATEGORY_LABELS[cat]}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ServiceModal — create or edit a service
// ---------------------------------------------------------------------------

interface ServiceModalProps {
  visible: boolean;
  initialName?: string;
  initialPrice?: string;
  initialDescription?: string;
  title: string;
  submitLabel: string;
  onSubmit: (name: string, price: number, description: string) => void;
  onClose: () => void;
  loading?: boolean;
}

function ServiceModal({
  visible,
  initialName = '',
  initialPrice = '',
  initialDescription = '',
  title,
  submitLabel,
  onSubmit,
  onClose,
  loading = false,
}: ServiceModalProps) {
  const colors = useTheme();
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice);
  const [description, setDescription] = useState(initialDescription);
  const [nameError, setNameError] = useState('');
  const [priceError, setPriceError] = useState('');

  // Reset fields when modal opens with new initialValues
  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setPrice(initialPrice);
      setDescription(initialDescription);
      setNameError('');
      setPriceError('');
    }
  }, [visible, initialName, initialPrice, initialDescription]);

  const handleSubmit = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Service name is required');
      valid = false;
    } else {
      setNameError('');
    }
    const parsed = parseFloat(price);
    if (!price.trim() || isNaN(parsed) || parsed <= 0) {
      setPriceError('Enter a valid price');
      valid = false;
    } else {
      setPriceError('');
    }
    if (!valid) return;
    onSubmit(name.trim(), parsed, description.trim());
  };

  const { base: inputStyle, error: errorInputStyle } = buildInputStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View
          style={[styles.modalSheet, { backgroundColor: colors.background }]}
          onStartShouldSetResponder={() => true}
        >
          <ThemedText style={styles.modalTitle}>{title}</ThemedText>

          <ThemedText variant="secondary" style={styles.fieldLabel}>Name</ThemedText>
          <TextInput
            style={nameError ? errorInputStyle : inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Haircut"
            placeholderTextColor={colors.textSecondary}
          />
          {nameError !== '' && (
            <ThemedText style={[styles.errorText, { color: colors.danger }]}>{nameError}</ThemedText>
          )}

          <ThemedText variant="secondary" style={styles.fieldLabel}>Price (Rs)</ThemedText>
          <TextInput
            style={priceError ? errorInputStyle : inputStyle}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 300"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
          {priceError !== '' && (
            <ThemedText style={[styles.errorText, { color: colors.danger }]}>{priceError}</ThemedText>
          )}

          <ThemedText variant="secondary" style={styles.fieldLabel}>Description (optional)</ThemedText>
          <TextInput
            style={[inputStyle, styles.textAreaInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description of this service"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={styles.modalActionBtn} />
            <Button
              title={submitLabel}
              onPress={handleSubmit}
              loading={loading}
              style={styles.modalActionBtn}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// SectionTab
// ---------------------------------------------------------------------------

interface SectionTabProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function SectionTab({ label, active, onPress }: SectionTabProps) {
  const colors = useTheme();
  return (
    <Pressable
      style={[
        styles.sectionTab,
        {
          borderBottomColor: active ? colors.primary : 'transparent',
          borderBottomWidth: 2,
        },
      ]}
      onPress={onPress}
    >
      <ThemedText
        style={[
          styles.sectionTabText,
          { color: active ? colors.primary : colors.textSecondary },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// EditProfileSection (F12a)
// ---------------------------------------------------------------------------

interface EditProfileSectionProps {
  merchantId: string;
  initialName: string;
  initialCategory: MerchantCategory;
  initialDescription: string;
  initialAddress: string;
}

function EditProfileSection({
  merchantId,
  initialName,
  initialCategory,
  initialDescription,
  initialAddress,
}: EditProfileSectionProps) {
  const colors = useTheme();
  const updateMutation = useUpdateMerchant();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<MerchantCategory>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [address, setAddress] = useState(initialAddress);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [nameError, setNameError] = useState('');

  // Fields are seeded once from props on mount via useState initial values.
  // No re-sync effect: avoids clobbering in-progress edits on background refetches.

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');

    const changes: MerchantUpdate = {};
    if (name.trim() !== initialName) changes.name = name.trim();
    if (category !== initialCategory) changes.category = category;
    if (description.trim() !== initialDescription) changes.description = description.trim();
    if (address.trim() !== initialAddress) changes.address_text = address.trim();

    if (Object.keys(changes).length === 0) {
      Alert.alert('No Changes', 'Nothing to save');
      return;
    }

    updateMutation.mutate(
      { id: merchantId, data: changes },
      {
        onSuccess: () => Alert.alert('Saved', 'Profile updated successfully'),
        onError: (err: any) =>
          Alert.alert('Error', err?.response?.data?.detail || 'Failed to save'),
      }
    );
  };

  const { base: inputStyle, error: errorInputStyle } = buildInputStyles(colors);

  return (
    <View testID="merchant-edit-profile" style={styles.sectionContent}>
      <ThemedText variant="secondary" style={styles.fieldLabel}>Business Name</ThemedText>
      <TextInput
        style={nameError ? errorInputStyle : inputStyle}
        value={name}
        onChangeText={setName}
        placeholder="Business name"
        placeholderTextColor={colors.textSecondary}
      />
      {nameError !== '' && (
        <ThemedText style={[styles.errorText, { color: colors.danger }]}>{nameError}</ThemedText>
      )}

      <ThemedText variant="secondary" style={styles.fieldLabel}>Category</ThemedText>
      <Pressable
        style={[styles.categoryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={() => setShowCategoryModal(true)}
      >
        <ThemedText style={{ color: colors.text }}>{CATEGORY_LABELS[category]}</ThemedText>
        <ThemedText variant="secondary" style={{ fontSize: FontSize.sm }}>▼</ThemedText>
      </Pressable>

      <ThemedText variant="secondary" style={styles.fieldLabel}>Description</ThemedText>
      <TextInput
        style={[inputStyle, styles.textAreaInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Tell customers about your business"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      <ThemedText variant="secondary" style={styles.fieldLabel}>Address</ThemedText>
      <TextInput
        style={inputStyle}
        value={address}
        onChangeText={setAddress}
        placeholder="Street address"
        placeholderTextColor={colors.textSecondary}
      />

      <Button
        title="Save Changes"
        onPress={handleSave}
        loading={updateMutation.isPending}
        style={styles.saveButton}
      />

      <CategorySelectorModal
        visible={showCategoryModal}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryModal(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ServicesSection (F12b)
// ---------------------------------------------------------------------------

interface ServicesSectionProps {
  merchantId: string;
  services: ServiceResponse[];
}

function ServicesManageSection({ merchantId, services }: ServicesSectionProps) {
  const colors = useTheme();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceResponse | null>(null);

  const handleAdd = useCallback(
    (name: string, price: number, description: string) => {
      createService.mutate(
        { merchantId, data: { name, price, description: description || undefined } },
        {
          onSuccess: () => setShowAddModal(false),
          onError: (err: any) =>
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to add service'),
        }
      );
    },
    [merchantId, createService]
  );

  const handleEdit = useCallback(
    (name: string, price: number, description: string) => {
      if (!editingService) return;
      updateService.mutate(
        {
          merchantId,
          serviceId: editingService.id,
          data: { name, price, description: description || undefined },
        },
        {
          onSuccess: () => setEditingService(null),
          onError: (err: any) =>
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to update service'),
        }
      );
    },
    [merchantId, editingService, updateService]
  );

  const handleDelete = useCallback(
    (service: ServiceResponse) => {
      Alert.alert(
        'Delete Service',
        `Are you sure you want to delete "${service.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              deleteService.mutate(
                { merchantId, serviceId: service.id },
                {
                  onError: (err: any) =>
                    Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete service'),
                }
              ),
          },
        ]
      );
    },
    [merchantId, deleteService]
  );

  return (
    <View style={styles.sectionContent}>
      {services.length === 0 ? (
        <ThemedText variant="secondary" style={styles.emptyText}>
          No services yet. Add your first service below.
        </ThemedText>
      ) : (
        services.map((svc) => (
          <View
            key={svc.id}
            style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.serviceItemInfo}>
              <ThemedText style={styles.serviceItemName}>{svc.name}</ThemedText>
              <ThemedText style={[styles.serviceItemPrice, { color: colors.primary }]}>
                Rs {svc.price}
              </ThemedText>
            </View>
            {svc.description != null && (
              <ThemedText variant="secondary" style={styles.serviceItemDesc} numberOfLines={2}>
                {svc.description}
              </ThemedText>
            )}
            <View style={styles.serviceItemActions}>
              <Pressable
                testID={`edit-service-${svc.id}`}
                style={[styles.serviceActionBtn, { borderColor: colors.border }]}
                onPress={() => setEditingService(svc)}
              >
                <ThemedText style={{ fontSize: FontSize.sm }}>Edit</ThemedText>
              </Pressable>
              <Pressable
                testID={`delete-service-${svc.id}`}
                style={[styles.serviceActionBtn, { borderColor: colors.danger }]}
                onPress={() => handleDelete(svc)}
              >
                <ThemedText style={{ fontSize: FontSize.sm, color: colors.danger }}>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Button
        testID="add-service-button"
        title="+ Add Service"
        variant="outline"
        onPress={() => setShowAddModal(true)}
        style={styles.addButton}
      />

      {/* Add service modal */}
      <ServiceModal
        visible={showAddModal}
        title="Add Service"
        submitLabel="Add"
        onSubmit={handleAdd}
        onClose={() => setShowAddModal(false)}
        loading={createService.isPending}
      />

      {/* Edit service modal */}
      <ServiceModal
        visible={editingService !== null}
        initialName={editingService?.name ?? ''}
        initialPrice={editingService ? String(editingService.price) : ''}
        initialDescription={editingService?.description ?? ''}
        title="Edit Service"
        submitLabel="Save"
        onSubmit={handleEdit}
        onClose={() => setEditingService(null)}
        loading={updateService.isPending}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// PortfolioSection (F12c)
// ---------------------------------------------------------------------------

interface PortfolioSectionProps {
  merchantId: string;
  portfolio: PortfolioImage[];
}

function PortfolioManageSection({ merchantId, portfolio }: PortfolioSectionProps) {
  const colors = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const portfolioThumb = (screenWidth - Spacing.md * 2 - Spacing.sm) / 2;
  const addImage = useAddPortfolioImage();
  const deleteImage = useDeletePortfolioImage();
  const [uploading, setUploading] = useState(false);

  const handleAddPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    let failCount = 0;

    for (let i = 0; i < result.assets.length; i++) {
      const asset = result.assets[i];
      try {
        // Upload to storage — capture timestamp once so name and path stay in sync.
        const ts = Date.now();
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: `portfolio-${ts}-${i}.jpg`,
        } as any);
        formData.append('path', `portfolio-images/${merchantId}/${ts}-${i}.jpg`);

        const { data: uploadData } = await storageService.upload(formData);

        // Register image on backend
        await addImage.mutateAsync({
          merchantId,
          data: { image_url: uploadData.url },
        });
      } catch {
        failCount++;
      }
    }

    setUploading(false);

    if (failCount > 0) {
      const total = result.assets.length;
      const succeeded = total - failCount;
      const message =
        succeeded === 0
          ? `All ${total} image(s) failed to upload.`
          : `${failCount} of ${total} image(s) failed. ${succeeded} added successfully.`;
      Alert.alert('Upload Issue', message);
    }
  };

  const handleDeleteImage = useCallback(
    (image: PortfolioImage) => {
      Alert.alert(
        'Delete Photo',
        'Remove this photo from your portfolio?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              deleteImage.mutate(
                { merchantId, imageId: image.id },
                {
                  onError: (err: any) =>
                    Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete image'),
                }
              ),
          },
        ]
      );
    },
    [merchantId, deleteImage]
  );

  return (
    <View style={styles.sectionContent}>
      {portfolio.length === 0 ? (
        <ThemedText variant="secondary" style={styles.emptyText}>
          No portfolio images yet. Add your work photos below.
        </ThemedText>
      ) : (
        <View style={styles.portfolioGrid}>
          {portfolio.map((img) => (
            <View key={img.id} style={styles.portfolioItem}>
              <Image
                source={{ uri: img.image_url }}
                style={[styles.portfolioThumb, { width: portfolioThumb, height: portfolioThumb }]}
                contentFit="cover"
              />
              <Pressable
                style={[styles.deleteImageBtn, { backgroundColor: colors.danger }]}
                onPress={() => handleDeleteImage(img)}
              >
                <ThemedText style={styles.deleteImageText}>✕</ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Note: drag-to-reorder skipped for MVP — future improvement */}

      <Button
        testID="add-portfolio-button"
        title={uploading ? 'Uploading...' : '+ Add Photos'}
        variant="outline"
        onPress={handleAddPhotos}
        disabled={uploading}
        loading={uploading}
        style={styles.addButton}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// MerchantOwnerScreen
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NewPostModal (S8-F10)
// ---------------------------------------------------------------------------

interface NewPostModalProps {
  visible: boolean;
  merchantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function NewPostModal({ visible, merchantId, onClose, onSuccess }: NewPostModalProps) {
  const colors = useTheme();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'update' | 'offer'>('update');
  const [loading, setLoading] = useState(false);
  const [contentError, setContentError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setContent('');
      setPostType('update');
      setContentError('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setContentError('Post content is required');
      return;
    }
    setContentError('');
    setLoading(true);
    try {
      await api.post(`/merchants/${merchantId}/posts`, {
        content: content.trim(),
        post_type: postType,
      });
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const { base: inputStyle, error: errorInputStyle } = buildInputStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View
          testID="new-post-form"
          style={[styles.modalSheet, { backgroundColor: colors.background }]}
          onStartShouldSetResponder={() => true}
        >
          <ThemedText style={styles.modalTitle}>New Post</ThemedText>

          <ThemedText variant="secondary" style={styles.fieldLabel}>Content</ThemedText>
          <TextInput
            testID="post-content-input"
            style={[contentError ? errorInputStyle : inputStyle, styles.textAreaInput]}
            value={content}
            onChangeText={setContent}
            placeholder="What would you like to share?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          {contentError !== '' && (
            <ThemedText style={[styles.errorText, { color: colors.danger }]}>{contentError}</ThemedText>
          )}

          <ThemedText variant="secondary" style={styles.fieldLabel}>Post Type</ThemedText>
          <View style={styles.postTypeRow}>
            <Pressable
              testID="post-type-update"
              style={[
                styles.postTypeButton,
                {
                  backgroundColor: postType === 'update' ? colors.primary : colors.surface,
                  borderColor: postType === 'update' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setPostType('update')}
            >
              <ThemedText
                style={{ color: postType === 'update' ? colors.primaryText : colors.text, fontSize: FontSize.sm }}
              >
                Update
              </ThemedText>
            </Pressable>
            <Pressable
              testID="post-type-offer"
              style={[
                styles.postTypeButton,
                {
                  backgroundColor: postType === 'offer' ? colors.primary : colors.surface,
                  borderColor: postType === 'offer' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setPostType('offer')}
            >
              <ThemedText
                style={{ color: postType === 'offer' ? colors.primaryText : colors.text, fontSize: FontSize.sm }}
              >
                Offer
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={styles.modalActionBtn} />
            <Button
              testID="post-submit-button"
              title="Post"
              onPress={handleSubmit}
              loading={loading}
              style={styles.modalActionBtn}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MerchantOwnerScreen
// ---------------------------------------------------------------------------

export default function MerchantOwnerScreen() {
  const colors = useTheme();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile');
  const [showNewPost, setShowNewPost] = useState(false);

  // Resolve own merchant ID first, then fetch full detail (merchant + services + portfolio).
  // useOwnMerchant is lightweight (GET /merchants/me returns MerchantDetail only).
  // useMerchant(id) does Promise.all for all 3 resources once the ID is known.
  const { data: ownMerchant, isLoading: ownLoading, isError, refetch } = useOwnMerchant();
  const { data: fullData, isLoading: fullLoading } = useMerchant(ownMerchant?.id);

  // Use only fullData.merchant (single cache source of truth invalidated by mutations).
  // ownMerchant is only used to obtain the merchant ID for the full query.
  const merchant = fullData?.merchant ?? null;
  const services = fullData?.services ?? [];
  const portfolio = fullData?.portfolio ?? [];

  if (ownLoading || fullLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (isError || merchant == null) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText variant="secondary" style={styles.errorText}>
          Failed to load your merchant profile
        </ThemedText>
        <Button title="Retry" onPress={() => refetch()} style={{ marginTop: Spacing.md }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView testID="merchant-profile-screen" style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={styles.backText}>← Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>My Business</ThemedText>
        <Pressable
          testID="new-post-button"
          style={[styles.newPostButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewPost(true)}
        >
          <ThemedText style={[styles.newPostButtonText, { color: colors.primaryText }]}>+ Post</ThemedText>
        </Pressable>
      </View>

      {/* Section tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <SectionTab
          label="Profile"
          active={activeSection === 'profile'}
          onPress={() => setActiveSection('profile')}
        />
        <SectionTab
          label="Services"
          active={activeSection === 'services'}
          onPress={() => setActiveSection('services')}
        />
        <SectionTab
          label="Portfolio"
          active={activeSection === 'portfolio'}
          onPress={() => setActiveSection('portfolio')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeSection === 'profile' && (
          <EditProfileSection
            merchantId={merchant.id}
            initialName={merchant.name}
            initialCategory={merchant.category}
            initialDescription={merchant.description ?? ''}
            initialAddress={merchant.address_text ?? ''}
          />
        )}

        {activeSection === 'services' && (
          <ServicesManageSection merchantId={merchant.id} services={services} />
        )}

        {activeSection === 'portfolio' && (
          <PortfolioManageSection merchantId={merchant.id} portfolio={portfolio} />
        )}
      </ScrollView>

      <NewPostModal
        visible={showNewPost}
        merchantId={merchant.id}
        onClose={() => setShowNewPost(false)}
        onSuccess={() => {
          setShowNewPost(false);
          router.push(`/merchant/${merchant.id}` as any);
        }}
      />
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  backText: {
    fontSize: FontSize.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 50,
  },
  newPostButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  newPostButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  postTypeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  postTypeButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  sectionTabText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },

  scrollContent: {
    paddingBottom: Spacing.xl,
  },

  sectionContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  // Fields
  fieldLabel: {
    fontSize: FontSize.sm,
    marginBottom: 2,
    marginTop: Spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Category button
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  saveButton: {
    marginTop: Spacing.md,
  },

  // Services
  serviceItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  serviceItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceItemName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  serviceItemPrice: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  serviceItemDesc: {
    fontSize: FontSize.sm,
  },
  serviceItemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    justifyContent: 'flex-end',
  },
  serviceActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },

  addButton: {
    marginTop: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    paddingVertical: Spacing.md,
  },

  // Portfolio
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  portfolioItem: {
    position: 'relative',
  },
  portfolioThumb: {
    borderRadius: BorderRadius.sm,
  },
  deleteImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteImageText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  categoryOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  categoryOptionText: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalActionBtn: {
    flex: 1,
  },
});
