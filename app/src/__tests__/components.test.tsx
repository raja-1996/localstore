import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import {
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Text,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// Mock useTheme — returns light palette for all tests
// ---------------------------------------------------------------------------
const mockColors = {
  text: '#0F1419',
  textSecondary: '#536471',
  background: '#FFFFFF',
  surface: '#F7F9F9',
  border: '#EFF3F4',
  primary: '#1D9BF0',
  primaryText: '#FFFFFF',
  danger: '#F4212E',
  dangerText: '#FFFFFF',
  success: '#00BA7C',
};

jest.mock('../hooks/use-theme', () => ({
  useTheme: () => mockColors,
}));

// ---------------------------------------------------------------------------
// Component imports (after mock so useTheme is already replaced)
// ---------------------------------------------------------------------------
import { Button } from '../components/button';
import { Input } from '../components/input';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';

// ---------------------------------------------------------------------------
// Mock react-native-reanimated for SkeletonCard
// ---------------------------------------------------------------------------
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      createAnimatedComponent: (c: any) => c,
    },
    useSharedValue: jest.fn((v: any) => ({ value: v })),
    withRepeat: jest.fn((v: any) => v),
    withTiming: jest.fn((v: any) => v),
    useAnimatedStyle: jest.fn((_cb: any) => ({})),
    Easing: { linear: jest.fn(), ease: jest.fn() },
  };
});

// ---------------------------------------------------------------------------
// Mock @/utils/format-distance for MerchantCard
// ---------------------------------------------------------------------------
jest.mock('@/utils/format-distance', () => ({
  formatDistance: (meters: number) => `${meters}m`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Flatten a React Native style prop (array, object, or StyleSheet id) to a plain object. */
function flatStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as any) ?? {};
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
describe('Button', () => {
  let onPress: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onPress = jest.fn();
  });

  it('renders title text', () => {
    render(<Button title="Save" onPress={onPress} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('shows ActivityIndicator and hides title while loading', () => {
    const { UNSAFE_getByType, queryByText } = render(
      <Button title="Save" loading onPress={onPress} />,
    );
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(queryByText('Save')).toBeNull();
  });

  it('button is not pressable while loading', () => {
    render(<Button testID="btn" title="Save" loading onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    expect(pressable.props.accessibilityState?.disabled).toBe(true);
  });

  it('calls onPress when pressed', () => {
    render(<Button title="Go" onPress={onPress} />);
    fireEvent.press(screen.getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("primary variant uses colors.primary as background", () => {
    render(<Button testID="btn" title="Primary" variant="primary" onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    const flat = flatStyle(pressable.props.style);
    expect(flat.backgroundColor).toBe(mockColors.primary);
  });

  it("danger variant uses colors.danger as background", () => {
    render(<Button testID="btn" title="Delete" variant="danger" onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    const flat = flatStyle(pressable.props.style);
    expect(flat.backgroundColor).toBe(mockColors.danger);
  });

  it("outline variant has transparent background and a border", () => {
    render(<Button testID="btn" title="Cancel" variant="outline" onPress={onPress} />);
    const pressable = screen.getByTestId('btn');
    const flat = flatStyle(pressable.props.style);
    expect(flat.backgroundColor).toBe('transparent');
    expect(flat.borderWidth).toBe(1);
    expect(flat.borderColor).toBe(mockColors.primary);
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
describe('Input', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders label text when label prop is set', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('does not render label when label prop is omitted', () => {
    render(<Input placeholder="Email" />);
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('renders error text when error prop is set', () => {
    render(<Input error="Required field" />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });

  it('does not render error text when no error', () => {
    render(<Input />);
    expect(screen.queryByText('Required field')).toBeNull();
  });

  it('applies danger border color when error is set', () => {
    const { UNSAFE_getByType } = render(<Input error="Bad input" />);
    const input = UNSAFE_getByType(TextInput);
    const flat = flatStyle(input.props.style);
    expect(flat.borderColor).toBe(mockColors.danger);
  });

  it('applies default border color when no error', () => {
    const { UNSAFE_getByType } = render(<Input />);
    const input = UNSAFE_getByType(TextInput);
    const flat = flatStyle(input.props.style);
    expect(flat.borderColor).toBe(mockColors.border);
  });
});

// ---------------------------------------------------------------------------
// ThemedText
// ---------------------------------------------------------------------------
describe('ThemedText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders children', () => {
    render(<ThemedText>Hello world</ThemedText>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it("default variant uses colors.text", () => {
    render(<ThemedText variant="default">Default</ThemedText>);
    const flat = flatStyle(screen.getByText('Default').props.style);
    expect(flat.color).toBe(mockColors.text);
  });

  it("secondary variant uses colors.textSecondary", () => {
    render(<ThemedText variant="secondary">Sub</ThemedText>);
    const flat = flatStyle(screen.getByText('Sub').props.style);
    expect(flat.color).toBe(mockColors.textSecondary);
  });

  it("title variant has large bold text", () => {
    render(<ThemedText variant="title">Big Title</ThemedText>);
    const flat = flatStyle(screen.getByText('Big Title').props.style);
    expect(flat.fontSize).toBe(22);
    expect(flat.fontWeight).toBe('bold');
  });
});

// ---------------------------------------------------------------------------
// ThemedView
// ---------------------------------------------------------------------------
describe('ThemedView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders children', () => {
    render(
      <ThemedView>
        <ThemedText>Child</ThemedText>
      </ThemedView>,
    );
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('applies background color from theme', () => {
    render(<ThemedView testID="themed-view" />);
    const view = screen.getByTestId('themed-view');
    const flat = flatStyle(view.props.style);
    expect(flat.backgroundColor).toBe(mockColors.background);
  });
});

// ---------------------------------------------------------------------------
// New component imports (after all mocks)
// ---------------------------------------------------------------------------
import { MerchantCard } from '../components/MerchantCard';
import { CategoryFilterBar } from '../components/CategoryFilterBar';
import { SkeletonCard } from '../components/SkeletonCard';
import type { NearbyFeedItem, MerchantCategory } from '../types/feed';

// ---------------------------------------------------------------------------
// MerchantCard
// ---------------------------------------------------------------------------
describe('MerchantCard', () => {
  const baseMerchant: NearbyFeedItem = {
    type: 'merchant',
    id: 'merchant-1',
    name: 'Priya Tailors',
    category: 'Tailoring',
    lat: 12.93,
    lng: 77.62,
    avg_rating: 4.5,
    review_count: 12,
    follower_count: 5,
    is_verified: true,
    distance_meters: 350,
    description: 'Expert tailoring services',
    neighborhood: 'Koramangala',
    tags: ['custom', 'alterations'],
  };

  let onPress: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onPress = jest.fn();
  });

  it('renders merchant name', () => {
    render(<MerchantCard item={baseMerchant} onPress={onPress} />);
    expect(screen.getByText('Priya Tailors')).toBeTruthy();
  });

  it('renders category text', () => {
    render(<MerchantCard item={baseMerchant} onPress={onPress} />);
    expect(screen.getByText('Tailoring')).toBeTruthy();
  });

  it('renders formatted distance', () => {
    render(<MerchantCard item={baseMerchant} onPress={onPress} />);
    // formatDistance is mocked to return `${meters}m`
    expect(screen.getByText('350m')).toBeTruthy();
  });

  it('calls onPress with merchant id when tapped', () => {
    render(<MerchantCard item={baseMerchant} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('merchant-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('merchant-1');
  });

  it('renders with null description without crashing', () => {
    const minimalMerchant: NearbyFeedItem = {
      ...baseMerchant,
      id: 'merchant-2',
      description: null,
    };
    render(<MerchantCard item={minimalMerchant} onPress={onPress} />);
    expect(screen.getByText('Priya Tailors')).toBeTruthy();
  });

  it('has testID merchant-card', () => {
    render(<MerchantCard item={baseMerchant} onPress={onPress} />);
    expect(screen.getByTestId('merchant-card')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// CategoryFilterBar
// ---------------------------------------------------------------------------
describe('CategoryFilterBar', () => {
  let onSelect: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onSelect = jest.fn();
  });

  it('renders All chip', () => {
    render(<CategoryFilterBar selected={null} onSelect={onSelect} />);
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('renders all 7 category chips', () => {
    render(<CategoryFilterBar selected={null} onSelect={onSelect} />);
    const chips = screen.getAllByTestId(/^category-chip-\d+$/);
    expect(chips).toHaveLength(7);
  });

  it('calls onSelect(null) when All chip is tapped', () => {
    render(<CategoryFilterBar selected={null} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('category-chip-0'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("calls onSelect('Beauty') when Beauty chip is tapped", () => {
    render(<CategoryFilterBar selected={null} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('category-chip-2'));
    expect(onSelect).toHaveBeenCalledWith('Beauty');
  });

  it('has testID category-filter-bar', () => {
    render(<CategoryFilterBar selected={null} onSelect={onSelect} />);
    expect(screen.getByTestId('category-filter-bar')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SkeletonCard
// ---------------------------------------------------------------------------
describe('SkeletonCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders default 3 skeleton items', () => {
    render(<SkeletonCard />);
    const items = screen.getAllByTestId('skeleton-card');
    expect(items).toHaveLength(3);
  });

  it('renders specified count of skeleton items', () => {
    render(<SkeletonCard count={2} />);
    const items = screen.getAllByTestId('skeleton-card');
    expect(items).toHaveLength(2);
  });

  it('has testID skeleton-card on each item', () => {
    render(<SkeletonCard count={1} />);
    expect(screen.getByTestId('skeleton-card')).toBeTruthy();
  });
});
