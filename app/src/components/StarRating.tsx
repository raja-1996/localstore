import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const STAR_COUNT = 5;
const COLOR_FILLED = '#F59E0B';
const COLOR_EMPTY = '#D1D5DB';

const SIZE_MAP = {
  small: 14,
  large: 28,
} as const;

interface StarRatingProps {
  rating: number;
  size?: 'small' | 'large';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}

function getStarType(index: number, rating: number): 'filled' | 'empty' {
  const threshold = index + 1;
  if (rating >= threshold) return 'filled';
  if (rating >= threshold - 0.5) return 'filled';
  return 'empty';
}

export function StarRating({
  rating,
  size = 'small',
  interactive = false,
  onRatingChange,
}: StarRatingProps) {
  const fontSize = SIZE_MAP[size];

  const handlePress = useCallback(
    (starIndex: number) => {
      if (interactive && onRatingChange) {
        onRatingChange(starIndex + 1);
      }
    },
    [interactive, onRatingChange],
  );

  return (
    <View style={styles.row} accessibilityRole="none">
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const isFilled = getStarType(i, rating) === 'filled';
        const label = `${i + 1} star${i + 1 > 1 ? 's' : ''}`;

        if (interactive) {
          return (
            <Pressable
              key={i}
              onPress={() => handlePress(i)}
              accessibilityLabel={label}
              accessibilityRole="button"
              hitSlop={4}
            >
              <Text style={{ fontSize, color: isFilled ? COLOR_FILLED : COLOR_EMPTY }}>
                {isFilled ? '★' : '☆'}
              </Text>
            </Pressable>
          );
        }

        return (
          <Text
            key={i}
            style={{ fontSize, color: isFilled ? COLOR_FILLED : COLOR_EMPTY }}
            accessibilityElementsHidden
          >
            {isFilled ? '★' : '☆'}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
});
