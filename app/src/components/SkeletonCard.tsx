import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

interface SkeletonCardProps {
  count?: number;
}

function SkeletonItem() {
  const colors = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1.0, { duration: 1000 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bgColor = colors.surface;
  const shimmerColor = colors.border;

  return (
    <Animated.View testID="skeleton-card" style={[styles.card, { backgroundColor: bgColor }, animatedStyle]}>
      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: shimmerColor }]} />

      {/* Text bars */}
      <View style={styles.textContainer}>
        <View style={[styles.bar, styles.barName, { backgroundColor: shimmerColor }]} />
        <View style={[styles.bar, styles.barCategory, { backgroundColor: shimmerColor }]} />
        <View style={[styles.bar, styles.barDistance, { backgroundColor: shimmerColor }]} />
      </View>
    </Animated.View>
  );
}

export function SkeletonCard({ count = 3 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={`skeleton-${index}`} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  bar: {
    borderRadius: BorderRadius.sm,
    height: 12,
  },
  barName: {
    width: '60%',
    height: 14,
  },
  barCategory: {
    width: '40%',
  },
  barDistance: {
    width: '30%',
  },
});
