import { useMemo } from 'react';
import { TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '../hooks/use-theme';
import { BorderRadius, Spacing, FontSize } from '../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  const colors = useTheme();

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: colors.background,
        borderColor: error ? colors.danger : colors.border,
        color: colors.text,
      },
    ],
    [colors.background, colors.danger, colors.border, colors.text, error]
  );

  return (
    <View style={styles.container}>
      {label && <ThemedText style={styles.label}>{label}</ThemedText>}
      <TextInput
        style={[inputStyle, style]}
        placeholderTextColor={colors.textSecondary}
        {...rest}
      />
      {error && (
        <ThemedText style={[styles.error, { color: colors.danger }]}>{error}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.lg,
    minHeight: 44,
  },
  error: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});
