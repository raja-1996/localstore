import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/button';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { useUser, useUpdateUser } from '@/hooks/use-user';
import storageService from '@/services/storage-service';
import { Spacing, BorderRadius, FontSize } from '@/constants/theme';

/**
 * Masks a phone string: "+919876543210" → "+91 ****3210"
 * Falls back to raw value when format is unexpected.
 */
function maskPhone(phone: string): string {
  // E.164 format: +CountryCode followed by number
  const match = phone.match(/^(\+\d{1,3})(.+)$/);
  if (!match) return phone;
  const countryCode = match[1];
  const local = match[2];
  if (local.length <= 4) return phone;
  const last4 = local.slice(-4);
  return `${countryCode} ****${last4}`;
}

export default function ProfileScreen() {
  const colors = useTheme();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);

  const { data: profile, isLoading } = useUser();
  const { mutateAsync: updateUser } = useUpdateUser();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/phone-login');
        },
      },
    ]);
  };

  const handleNameTap = () => {
    setNameValue(profile?.full_name ?? '');
    setIsEditingName(true);
  };

  const handleNameBlur = async () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== profile?.full_name) {
      try {
        await updateUser({ full_name: trimmed });
      } catch {
        Alert.alert('Error', 'Could not update name');
      }
    }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: 'avatar.jpg',
      } as any);
      formData.append('path', `user-avatars/${authUser?.id}/avatar.jpg`);

      setIsUploadingAvatar(true);
      try {
        const { data } = await storageService.upload(formData);
        setAvatarUri(data.url);
        await updateUser({ avatar_url: data.url });
      } catch (error: any) {
        Alert.alert('Upload Failed', error.response?.data?.detail || 'Could not upload avatar');
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const displayAvatarUrl = avatarUri ?? profile?.avatar_url ?? null;
  const initial = (
    profile?.full_name?.[0] ??
    authUser?.email?.[0] ??
    authUser?.phone?.[0] ??
    '?'
  ).toUpperCase();

  // maskPhone is applied client-side. This assumes /users/me returns raw E.164 phone.
  // If the backend starts masking, remove this call.
  const rawPhone = profile?.phone ?? authUser?.phone ?? null;
  const maskedPhone = rawPhone ? maskPhone(rawPhone) : null;

  if (isLoading) {
    return (
      <ThemedView testID="profile-screen-loading" style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView testID="profile-screen" style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable
            testID="avatar-picker"
            onPress={handlePickAvatar}
            style={styles.avatarWrapper}
            disabled={isUploadingAvatar}
          >
            {displayAvatarUrl ? (
              <Image
                source={{ uri: displayAvatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <ThemedText style={[styles.avatarInitial, { color: colors.primaryText }]}>
                  {initial}
                </ThemedText>
              </View>
            )}
            {isUploadingAvatar ? (
              <ActivityIndicator style={StyleSheet.absoluteFillObject} color={colors.primary} />
            ) : null}
          </Pressable>
          <ThemedText variant="secondary" style={styles.avatarHint}>
            Tap to change photo
          </ThemedText>
        </View>

        {/* Name — tap to edit */}
        <View style={[styles.card, { borderBottomColor: colors.border }]}>
          <ThemedText variant="secondary" style={styles.fieldLabel}>Name</ThemedText>
          {isEditingName ? (
            <TextInput
              testID="profile-name"
              value={nameValue}
              onChangeText={setNameValue}
              onBlur={handleNameBlur}
              autoFocus
              style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.primary }]}
              returnKeyType="done"
              onSubmitEditing={handleNameBlur}
            />
          ) : (
            <Pressable testID="profile-name" onPress={handleNameTap}>
              <ThemedText style={styles.fieldValue}>
                {profile?.full_name || 'Tap to add name'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* Phone — masked, read-only */}
        {maskedPhone ? (
          <View style={[styles.card, { borderBottomColor: colors.border }]}>
            <ThemedText variant="secondary" style={styles.fieldLabel}>Phone</ThemedText>
            <ThemedText testID="profile-phone" style={styles.fieldValue}>
              {maskedPhone}
            </ThemedText>
          </View>
        ) : null}

        {/* Merchant CTA — different message based on merchant status */}
        {profile && !profile.is_merchant ? (
          <Pressable
            testID="become-merchant-cta"
            style={[styles.merchantCTA, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/merchant/create' as any)}
          >
            <ThemedText style={[styles.merchantCTAText, { color: colors.primaryText }]}>
              Become a Merchant
            </ThemedText>
            <ThemedText style={[styles.merchantCTASubtext, { color: colors.primaryText }]}>
              List your services and reach nearby customers
            </ThemedText>
          </Pressable>
        ) : profile?.is_merchant ? (
          <Pressable
            testID="merchant-profile-link"
            style={[styles.merchantCTA, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push('/profile/merchant' as any)}
          >
            <ThemedText style={[styles.merchantCTAText, { color: colors.text }]}>
              Manage My Business
            </ThemedText>
            <ThemedText style={[styles.merchantCTASubtext, { color: colors.textSecondary }]}>
              Edit profile, services, and portfolio
            </ThemedText>
          </Pressable>
        ) : null}

        {/* Logout */}
        <View style={styles.actionsSection}>
          <Button
            testID="logout-button"
            title="Sign Out"
            variant="outline"
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  avatarWrapper: {
    // position: 'relative' is the default in RN — omitted intentionally
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  avatarHint: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  card: {
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  fieldValue: {
    fontSize: FontSize.lg,
  },
  nameInput: {
    fontSize: FontSize.lg,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  merchantCTA: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  merchantCTAText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  merchantCTASubtext: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    opacity: 0.85,
  },
  actionsSection: {
    marginTop: Spacing.lg,
  },
});
