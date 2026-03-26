import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/use-theme';

interface ThemedTextProps extends TextProps {
  variant?: 'default' | 'secondary' | 'title';
}

export function ThemedText({ style, variant = 'default', ...rest }: ThemedTextProps) {
  const colors = useTheme();

  return (
    <Text
      style={[
        styles.base,
        { color: colors.text },
        variant === 'secondary' && { color: colors.textSecondary },
        variant === 'title' && styles.title,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});
