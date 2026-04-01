import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
}));

// ---------------------------------------------------------------------------
// Mock expo-image-picker
// ---------------------------------------------------------------------------
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

// ---------------------------------------------------------------------------
// Mock expo-image
// ---------------------------------------------------------------------------
jest.mock('expo-image', () => ({ Image: 'Image' }));

// ---------------------------------------------------------------------------
// Mock storageService
// ---------------------------------------------------------------------------
jest.mock('../services/storage-service', () => ({
  __esModule: true,
  default: {
    upload: jest.fn().mockResolvedValue({ data: { url: 'https://example.com/avatar.jpg' } }),
  },
}));

// ---------------------------------------------------------------------------
// Mock merchantService
// ---------------------------------------------------------------------------
const mockCreateMerchant = jest.fn().mockResolvedValue({
  data: {
    id: 'new-merchant-id',
    name: 'Test Merchant',
    category: 'Beauty',
    lat: 12.9716,
    lng: 77.5946,
    is_active: true,
  },
});

const mockCreateService = jest.fn().mockResolvedValue({ data: { id: 'service-1' } });
const mockAddPortfolioImage = jest.fn().mockResolvedValue({ data: { id: 'portfolio-1' } });
const mockUpdateMerchant = jest.fn().mockResolvedValue({ data: {} });

jest.mock('../services/merchant-service', () => ({
  merchantService: {
    createMerchant: (...args: any[]) => mockCreateMerchant(...args),
    createService: (...args: any[]) => mockCreateService(...args),
    addPortfolioImage: (...args: any[]) => mockAddPortfolioImage(...args),
    updateMerchant: (...args: any[]) => mockUpdateMerchant(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock useLocationStore
// ---------------------------------------------------------------------------
const mockCoords = { latitude: 12.9716, longitude: 77.5946 };

jest.mock('../stores/location-store', () => ({
  useLocationStore: jest.fn((selector: any) =>
    selector({ coords: mockCoords })
  ),
}));

// ---------------------------------------------------------------------------
// Mock constants/categories
// ---------------------------------------------------------------------------
jest.mock('../constants/categories', () => ({
  CATEGORIES: ['Beauty', 'Food', 'Tailoring'],
  CATEGORY_LABELS: {
    Beauty: 'Beauty',
    Food: 'Food',
    Tailoring: 'Tailoring',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import MerchantCreateScreen from '../app/(app)/merchant/create';
import { useLocationStore } from '../stores/location-store';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MerchantCreateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocationStore as jest.Mock).mockImplementation((selector: any) =>
      selector({ coords: mockCoords })
    );
  });

  it('step 1 renders name input with testID merchant-name-input', () => {
    renderWithQueryClient(<MerchantCreateScreen />);
    expect(screen.getByTestId('merchant-create-step-1')).toBeTruthy();
    expect(screen.getByTestId('merchant-name-input')).toBeTruthy();
  });

  it('step 1 "Next" button shows error when name is empty', () => {
    renderWithQueryClient(<MerchantCreateScreen />);

    fireEvent.press(screen.getByTestId('step-next-button'));

    expect(screen.getByText('Business name is required')).toBeTruthy();
    // Still on step 1
    expect(screen.getByTestId('merchant-create-step-1')).toBeTruthy();
  });

  it('step 1 validates category required', () => {
    renderWithQueryClient(<MerchantCreateScreen />);

    // Fill in name but leave category empty
    fireEvent.changeText(screen.getByTestId('merchant-name-input'), 'My Business');
    fireEvent.press(screen.getByTestId('step-next-button'));

    expect(screen.getByText('Please select a category')).toBeTruthy();
    // Still on step 1
    expect(screen.getByTestId('merchant-create-step-1')).toBeTruthy();
  });

  it('step 1 "Next" advances to step 2 with valid name and category', async () => {
    renderWithQueryClient(<MerchantCreateScreen />);

    // Fill name
    fireEvent.changeText(screen.getByTestId('merchant-name-input'), 'My Business');

    // Open and select category (press the category-option-0 in the modal)
    fireEvent.press(screen.getByTestId('merchant-category-selector'));
    await waitFor(() => {
      expect(screen.getByTestId('category-option-0')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('category-option-0'));

    fireEvent.press(screen.getByTestId('step-next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('merchant-create-step-2')).toBeTruthy();
    });
  });

  it('step 3 skip button sets hasServiceData=false and advances to step 4', async () => {
    renderWithQueryClient(<MerchantCreateScreen />);

    // Navigate to step 2
    fireEvent.changeText(screen.getByTestId('merchant-name-input'), 'My Business');
    fireEvent.press(screen.getByTestId('merchant-category-selector'));
    await waitFor(() => expect(screen.getByTestId('category-option-0')).toBeTruthy());
    fireEvent.press(screen.getByTestId('category-option-0'));
    fireEvent.press(screen.getByTestId('step-next-button'));

    // Navigate to step 3
    await waitFor(() => expect(screen.getByTestId('merchant-create-step-2')).toBeTruthy());
    fireEvent.press(screen.getByTestId('step-next-button'));

    // Now on step 3, press skip
    await waitFor(() => expect(screen.getByTestId('merchant-create-step-3')).toBeTruthy());
    fireEvent.press(screen.getByTestId('step-skip-button'));

    // Should advance to step 4
    await waitFor(() => {
      expect(screen.getByTestId('merchant-create-step-4')).toBeTruthy();
    });
  });

  it('step 4 skip button calls createMerchant and shows success screen', async () => {
    renderWithQueryClient(<MerchantCreateScreen />);

    // Step 1 → 2
    fireEvent.changeText(screen.getByTestId('merchant-name-input'), 'My Business');
    fireEvent.press(screen.getByTestId('merchant-category-selector'));
    await waitFor(() => expect(screen.getByTestId('category-option-0')).toBeTruthy());
    fireEvent.press(screen.getByTestId('category-option-0'));
    fireEvent.press(screen.getByTestId('step-next-button'));

    // Step 2 → 3
    await waitFor(() => expect(screen.getByTestId('merchant-create-step-2')).toBeTruthy());
    fireEvent.press(screen.getByTestId('step-next-button'));

    // Step 3 → 4 via skip
    await waitFor(() => expect(screen.getByTestId('merchant-create-step-3')).toBeTruthy());
    fireEvent.press(screen.getByTestId('step-skip-button'));

    // Step 4: press skip (triggers submit with no portfolio)
    await waitFor(() => expect(screen.getByTestId('merchant-create-step-4')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('step-skip-button'));
    });

    // createMerchant should have been called
    await waitFor(() => {
      expect(mockCreateMerchant).toHaveBeenCalledTimes(1);
      expect(mockCreateMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Business',
          lat: mockCoords.latitude,
          lng: mockCoords.longitude,
        })
      );
    });

    // Success screen should appear
    await waitFor(() => {
      expect(screen.getByTestId('merchant-create-success')).toBeTruthy();
    });
  });
});
