import { useMemo } from 'react';
import { Pressable, PressableProps, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '../hooks/use-theme';
import { BorderRadius, Spacing, FontSize } from '../constants/theme';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: 'primary' | 'danger' | 'outline';
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const colors = useTheme();

  const bgColor = variant === 'primary'
    ? colors.primary
    : variant === 'danger'
    ? colors.danger
    : 'transparent';

  const textColor = variant === 'outline' ? colors.primary : colors.primaryText;

  const buttonBaseStyle = useMemo(
    () => [
      styles.button,
      { backgroundColor: bgColor },
      variant === 'outline' && { borderWidth: 1, borderColor: colors.primary },
      disabled && styles.disabled,
    ],
    [bgColor, variant, colors.primary, disabled]
  );

  return (
    <Pressable
      style={({ pressed }) => [buttonBaseStyle, pressed && styles.buttonPressed, style as any]}
      disabled={loading || disabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText style={[styles.text, { color: textColor }]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  text: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
