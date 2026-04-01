import { useLocationStore } from '../stores/location-store';

// Mock expo-location via dynamic import interception
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: mockRequestForegroundPermissionsAsync,
  getCurrentPositionAsync: mockGetCurrentPositionAsync,
  getLastKnownPositionAsync: mockGetLastKnownPositionAsync,
  Accuracy: { Balanced: 3 },
}));

function getState() {
  return useLocationStore.getState();
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

describe('useLocationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.setState({
      coords: null,
      lastUpdated: null,
      permissionStatus: 'undetermined',
      isLoading: false,
      error: null,
    });
  });

  describe('setCoords', () => {
    it('updates coords with given latitude and longitude', () => {
      getState().setCoords(12.9716, 77.5946);
      expect(getState().coords).toEqual({ latitude: 12.9716, longitude: 77.5946 });
    });

    it('sets lastUpdated to current timestamp', () => {
      const before = Date.now();
      getState().setCoords(12.9716, 77.5946);
      const after = Date.now();
      const { lastUpdated } = getState();
      expect(lastUpdated).not.toBeNull();
      expect(lastUpdated!).toBeGreaterThanOrEqual(before);
      expect(lastUpdated!).toBeLessThanOrEqual(after);
    });

    it('clears error when setting coords', () => {
      useLocationStore.setState({ error: 'previous error' });
      getState().setCoords(12.9716, 77.5946);
      expect(getState().error).toBeNull();
    });
  });

  describe('isStale', () => {
    it('returns true when lastUpdated is null', () => {
      expect(getState().isStale()).toBe(true);
    });

    it('returns false for freshly set coords', () => {
      getState().setCoords(12.9716, 77.5946);
      expect(getState().isStale()).toBe(false);
    });

    it('returns true for coords older than 11 minutes', () => {
      const elevenMinutesAgo = Date.now() - STALE_THRESHOLD_MS - 60_000;
      useLocationStore.setState({ lastUpdated: elevenMinutesAgo });
      expect(getState().isStale()).toBe(true);
    });

    it('returns false for coords set 9 minutes ago', () => {
      const nineMinutesAgo = Date.now() - 9 * 60 * 1000;
      useLocationStore.setState({ lastUpdated: nineMinutesAgo });
      expect(getState().isStale()).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('returns granted and updates permissionStatus when granted', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      const result = await getState().requestPermission();
      expect(result).toBe('granted');
      expect(getState().permissionStatus).toBe('granted');
    });

    it('returns denied and updates permissionStatus when denied', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      const result = await getState().requestPermission();
      expect(result).toBe('denied');
      expect(getState().permissionStatus).toBe('denied');
    });
  });

  describe('refreshLocation', () => {
    it('fetches GPS and updates coords on success', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockGetLastKnownPositionAsync.mockResolvedValueOnce(null);
      mockGetCurrentPositionAsync.mockResolvedValueOnce({
        coords: { latitude: 12.9716, longitude: 77.5946 },
      });

      await getState().refreshLocation();

      const state = getState();
      expect(state.coords).toEqual({ latitude: 12.9716, longitude: 77.5946 });
      expect(state.lastUpdated).not.toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.permissionStatus).toBe('granted');
    });

    it('sets error and permissionStatus denied when permission denied', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      await getState().refreshLocation();

      const state = getState();
      expect(state.isLoading).toBe(false);
      expect(state.permissionStatus).toBe('denied');
      expect(state.error).toBe('Location permission denied');
      expect(state.coords).toBeNull();
    });

    it('sets error when GPS throws', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockGetLastKnownPositionAsync.mockResolvedValueOnce(null);
      mockGetCurrentPositionAsync.mockRejectedValueOnce(new Error('GPS unavailable'));

      await getState().refreshLocation();

      const state = getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('GPS unavailable');
      expect(state.coords).toBeNull();
    });

    it('does not start a second fetch when isLoading is true', async () => {
      useLocationStore.setState({ isLoading: true });

      await getState().refreshLocation();

      expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('sets lastUpdated after successful location fetch', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockGetLastKnownPositionAsync.mockResolvedValueOnce(null);
      mockGetCurrentPositionAsync.mockResolvedValueOnce({
        coords: { latitude: 1.0, longitude: 2.0 },
      });

      const before = Date.now();
      await getState().refreshLocation();
      const after = Date.now();

      const { lastUpdated } = getState();
      expect(lastUpdated!).toBeGreaterThanOrEqual(before);
      expect(lastUpdated!).toBeLessThanOrEqual(after);
    });
  });
});
