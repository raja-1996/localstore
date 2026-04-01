import * as Device from 'expo-device';
import { Platform } from 'react-native';

let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  console.warn('expo-notifications not available (Expo Go SDK 53+)');
}

/**
 * Request notification permissions (iOS) and get Expo push token.
 * Returns token string or null if permissions denied / not a device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '52d0c1e4-b023-4322-8426-a078b32f403a',
  });

  return tokenData.data;
}

export { Notifications };
