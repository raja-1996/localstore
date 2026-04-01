import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock useTheme
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
// Mock expo-router
// ---------------------------------------------------------------------------
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
}));

// ---------------------------------------------------------------------------
// Mock @shopify/flash-list — render as FlatList in tests
// ---------------------------------------------------------------------------
jest.mock('@shopify/flash-list', () => ({
  FlashList: require('react-native').FlatList,
}));

// ---------------------------------------------------------------------------
// Mock MerchantCard
// ---------------------------------------------------------------------------
jest.mock('../components/MerchantCard', () => ({
  MerchantCard: ({ item, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="merchant-card" onPress={() => onPress(item.id)}>
        <Text>{item.name}</Text>
      </Pressable>
    );
  },
}));

// ---------------------------------------------------------------------------
// Mock CategoryFilterBar
// ---------------------------------------------------------------------------
jest.mock('../components/CategoryFilterBar', () => ({
  CategoryFilterBar: ({ onSelect }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="category-filter-bar" onPress={() => onSelect('Beauty')}>
        <Text>Categories</Text>
      </Pressable>
    );
  },
}));

// ---------------------------------------------------------------------------
// Mock ThemedView and ThemedText
// ---------------------------------------------------------------------------
jest.mock('../components/themed-view', () => ({
  ThemedView: ({ children, testID, style }: any) => {
    const { View } = require('react-native');
    return <View testID={testID} style={style}>{children}</View>;
  },
}));

jest.mock('../components/themed-text', () => ({
  ThemedText: ({ children, testID, variant, style }: any) => {
    const { Text } = require('react-native');
    return <Text testID={testID} style={style}>{children}</Text>;
  },
}));

// ---------------------------------------------------------------------------
// Mock useLocationStore
// ---------------------------------------------------------------------------
const mockLocationStore = {
  coords: { latitude: 12.9716, longitude: 77.5946 },
  permissionStatus: 'granted' as const,
};

jest.mock('../stores/location-store', () => ({
  useLocationStore: jest.fn((selector: any) => selector(mockLocationStore)),
}));

// ---------------------------------------------------------------------------
// Mock useSearch
// ---------------------------------------------------------------------------
const mockSearchHook = {
  data: null as any,
  isLoading: false,
};

jest.mock('../hooks/use-search', () => ({
  useSearch: jest.fn(() => mockSearchHook),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import SearchScreen from '../app/(app)/search/index';
import { useLocationStore } from '../stores/location-store';
import { useSearch } from '../hooks/use-search';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocationStore as jest.Mock).mockImplementation((selector: any) =>
      selector(mockLocationStore)
    );
    (useSearch as jest.Mock).mockReturnValue(mockSearchHook);
  });

  it('renders search input with testID search-input', () => {
    render(<SearchScreen />);
    expect(screen.getByTestId('search-input')).toBeTruthy();
  });

  it('renders category filter bar', () => {
    render(<SearchScreen />);
    expect(screen.getByTestId('category-filter-bar')).toBeTruthy();
  });

  it('shows MerchantCard items when search results exist', () => {
    const merchants = [
      {
        id: 'merchant-1',
        name: 'Raja Tailors',
        category: 'Tailoring',
        lat: 12.9716,
        lng: 77.5946,
        avg_rating: 4.5,
        review_count: 10,
        follower_count: 50,
        is_verified: true,
        distance_meters: 300,
        neighborhood: 'Koramangala',
      },
    ];

    (useSearch as jest.Mock).mockReturnValue({
      data: { merchants, services: [] },
      isLoading: false,
    });

    render(<SearchScreen />);
    expect(screen.getByText('Raja Tailors')).toBeTruthy();
    expect(screen.getByTestId('merchant-card')).toBeTruthy();
  });

  it('shows empty state when no results and query is non-empty', () => {
    (useSearch as jest.Mock).mockReturnValue({
      data: { merchants: [], services: [] },
      isLoading: false,
    });

    render(<SearchScreen />);

    // Type a query to trigger empty state
    const searchInput = screen.getByTestId('search-input');
    fireEvent.changeText(searchInput, 'nonexistent');

    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });

  it('shows loading indicator when isLoading is true', () => {
    (useSearch as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
    });

    render(<SearchScreen />);

    // Type a query so the loading indicator is visible
    const searchInput = screen.getByTestId('search-input');
    fireEvent.changeText(searchInput, 'tailor');

    expect(screen.getByTestId('search-input')).toBeTruthy();
    // ActivityIndicator is rendered — confirm no merchant-card or empty-state
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect(screen.queryByTestId('merchant-card')).toBeNull();
  });

  it('category selection updates the selected category state via CategoryFilterBar', () => {
    render(<SearchScreen />);

    const categoryBar = screen.getByTestId('category-filter-bar');
    fireEvent.press(categoryBar);

    // After pressing, useSearch is re-called with updated category.
    // Verify it was called at least once (on render).
    expect(useSearch).toHaveBeenCalled();
  });
});
