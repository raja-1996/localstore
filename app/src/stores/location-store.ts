import { create } from 'zustand';

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

type PermissionStatus = 'undetermined' | 'granted' | 'denied';

interface Coords {
  latitude: number;
  longitude: number;
}

interface LocationState {
  coords: Coords | null;
  lastUpdated: number | null;
  permissionStatus: PermissionStatus;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<PermissionStatus>;
  setCoords: (latitude: number, longitude: number) => void;
  refreshLocation: () => Promise<void>;
  isStale: () => boolean;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  coords: null,
  lastUpdated: null,
  permissionStatus: 'undetermined',
  isLoading: false,
  error: null,

  requestPermission: async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Location = require('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    const permissionStatus: PermissionStatus =
      status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
    set({ permissionStatus });
    return permissionStatus;
  },

  setCoords: (latitude, longitude) => {
    set({
      coords: { latitude, longitude },
      lastUpdated: Date.now(),
      error: null,
    });
  },

  refreshLocation: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');

      if (get().permissionStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          set({
            isLoading: false,
            permissionStatus: status === 'denied' ? 'denied' : 'undetermined',
            error: 'Location permission denied',
          });
          return;
        }

        set({ permissionStatus: 'granted' });
      }

      // Try last known position first (instant on emulator/cached devices),
      // fall back to a fresh fix with Balanced accuracy (faster than High/GPS).
      const lastKnown = await Location.getLastKnownPositionAsync({});
      const result = lastKnown ?? await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!result) {
        set({ isLoading: false, error: 'Could not determine location' });
        return;
      }
      set({
        coords: {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        },
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err != null && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to get location';
      set({ isLoading: false, error: message });
    }
  },

  isStale: () => {
    const { lastUpdated } = get();
    if (lastUpdated === null) return true;
    return Date.now() - lastUpdated > STALE_THRESHOLD_MS;
  },
}));
