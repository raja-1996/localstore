import React from 'react';
import { ScrollView, Pressable, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { MerchantCategory } from '@/types/feed';

interface CategoryChip {
  label: string;
  value: MerchantCategory | null;
}

const CATEGORIES: CategoryChip[] = [
  { label: 'All', value: null },
  { label: 'Food', value: 'Food' },
  { label: 'Beauty', value: 'Beauty' },
  { label: 'Tailoring', value: 'Tailoring' },
  { label: 'Home Services', value: 'HomeServices' },
  { label: 'Events', value: 'Events' },
  { label: 'Other', value: 'Other' },
];

interface CategoryFilterBarProps {
  selected: MerchantCategory | null;
  onSelect: (category: MerchantCategory | null) => void;
}

export function CategoryFilterBar({ selected, onSelect }: CategoryFilterBarProps) {
  const colors = useTheme();

  return (
    <View>
      <ScrollView
        testID="category-filter-bar"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map((chip, index) => {
          const isActive = selected === chip.value;

          return (
            <Pressable
              key={chip.label}
              testID={`category-chip-${index}`}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(chip.value)}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: isActive ? colors.primaryText : colors.text },
                ]}
              >
                {chip.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
