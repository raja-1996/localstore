import { View, ViewProps } from 'react-native';
import { useTheme } from '../hooks/use-theme';

export function ThemedView({ style, ...rest }: ViewProps) {
  const colors = useTheme();
  return <View style={[{ backgroundColor: colors.background }, style]} {...rest} />;
}
