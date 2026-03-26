import { useState, useMemo } from 'react';
import { StyleSheet, Alert, ScrollView, View, TextInput, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { Button } from '../../components/button';
import { useAuthStore } from '../../stores/auth-store';
import { useTheme } from '../../hooks/use-theme';
import storageService from '../../services/storage-service';
import { Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function SettingsScreen() {
  const colors = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const cardStyle = useMemo(
    () => [styles.card, { backgroundColor: colors.background, borderBottomColor: colors.border }],
    [colors.background, colors.border]
  );

  const avatarPlaceholderStyle = useMemo(
    () => [styles.avatarPlaceholder, { backgroundColor: colors.primary }],
    [colors.primary]
  );

  const infoRowStyle = useMemo(
    () => [styles.infoRow, { borderTopColor: colors.border }],
    [colors.border]
  );

  const dangerZoneStyle = useMemo(
    () => [styles.dangerZone, { borderTopColor: colors.border }],
    [colors.border]
  );

  const dangerTitleStyle = useMemo(
    () => [styles.dangerTitle, { color: colors.danger }],
    [colors.danger]
  );

  const deleteInputStyle = useMemo(
    () => [
      styles.deleteInput,
      {
        borderColor: colors.danger,
        color: colors.text,
        backgroundColor: colors.background,
      },
    ],
    [colors.danger, colors.text, colors.background]
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    if (deleteConfirm !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm');
      return;
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { setShowDeleteConfirm(false); setDeleteConfirm(''); } },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete account');
            }
          },
        },
      ]
    );
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
      formData.append('path', `avatars/${user?.id}/avatar.jpg`);

      try {
        const { data } = await storageService.upload(formData);
        setAvatarUrl(data.url);
      } catch (error: any) {
        Alert.alert('Upload Failed', error.response?.data?.detail || 'Could not upload avatar');
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        <View style={cardStyle}>
          <ThemedText style={styles.cardTitle}>Profile</ThemedText>

          <Pressable onPress={handlePickAvatar} style={styles.avatarContainer} testID="avatar-pressable">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" testID="avatar-image" />
            ) : (
              <View style={avatarPlaceholderStyle}>
                <ThemedText style={styles.avatarInitial} testID="avatar-initial">
                  {(user?.email?.[0] || user?.phone?.[0] || '?').toUpperCase()}
                </ThemedText>
              </View>
            )}
            <ThemedText variant="secondary" style={styles.avatarHint}>
              Tap to change avatar
            </ThemedText>
          </Pressable>

          <View style={infoRowStyle}>
            <ThemedText variant="secondary">{user?.email ? 'Email' : 'Phone'}</ThemedText>
            <ThemedText>{user?.email || user?.phone || 'Unknown'}</ThemedText>
          </View>
        </View>

        {/* Actions */}
        <View style={cardStyle}>
          <Button title="Sign Out" variant="outline" onPress={handleLogout} />

          <View style={dangerZoneStyle}>
            <ThemedText style={dangerTitleStyle}>
              Danger Zone
            </ThemedText>

            {showDeleteConfirm && (
              <View style={styles.deleteConfirmContainer}>
                <ThemedText variant="secondary" style={styles.deleteHint}>
                  Type DELETE to confirm account deletion
                </ThemedText>
                <TextInput
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  placeholder="Type DELETE"
                  style={deleteInputStyle}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
              </View>
            )}

            <Button
              title="Delete Account"
              variant="danger"
              onPress={handleDeleteAccount}
              style={styles.deleteButton}
            />
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
  },
  avatarHint: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dangerZone: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dangerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  deleteConfirmContainer: {
    marginBottom: Spacing.md,
  },
  deleteHint: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  deleteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.lg,
  },
  deleteButton: {
    marginTop: Spacing.xs,
  },
});
