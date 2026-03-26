import { memo, useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '../hooks/use-theme';
import { BorderRadius, Spacing, FontSize } from '../constants/theme';

interface TodoCardProps {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  onPress: (id: string) => void;
  onToggle: (id: string, isCompleted: boolean) => void;
  onLongPress?: (id: string) => void;
}

export const TodoCard = memo(function TodoCard({ id, title, description, isCompleted, onPress, onToggle, onLongPress }: TodoCardProps) {
  const colors = useTheme();

  const cardStyle = useMemo(
    () => ({ backgroundColor: colors.background, borderBottomColor: colors.border }),
    [colors.background, colors.border]
  );

  const checkboxInnerStyle = useMemo(
    () => [
      styles.checkboxInner,
      {
        borderColor: isCompleted ? colors.success : colors.border,
        backgroundColor: isCompleted ? colors.success : 'transparent',
      },
    ],
    [isCompleted, colors.success, colors.border]
  );

  return (
    <Pressable
      onPress={() => onPress(id)}
      onLongPress={() => onLongPress?.(id)}
      style={({ pressed }) => [styles.card, cardStyle, pressed && styles.cardPressed]}
    >
      <Pressable onPress={() => onToggle(id, isCompleted)} style={styles.checkbox} testID={`checkbox-${title.replace(/\s+/g, '-').toLowerCase()}`}>
        <View style={checkboxInnerStyle}>
          {isCompleted && <ThemedText style={styles.checkmark}>✓</ThemedText>}
        </View>
      </Pressable>
      <View style={styles.content}>
        <ThemedText
          style={[
            styles.title,
            isCompleted && { textDecorationLine: 'line-through', opacity: 0.6 },
          ]}
        >
          {title}
        </ThemedText>
        {description ? (
          <ThemedText variant="secondary" numberOfLines={2} style={styles.description}>
            {description}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardPressed: {
    opacity: 0.8,
  },
  checkbox: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderCurve: 'continuous',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '500',
  },
  description: {
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
});
