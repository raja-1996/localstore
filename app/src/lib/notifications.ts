import * as Device from 'expo-device';
import notificationsService from '../services/notifications-service';

// expo-notifications remote push was removed from Expo Go in SDK 53.
// Use require() so the throw is catchable (static imports throw before any code runs).
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
  // Not available in Expo Go SDK 53+ — silently skip
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) {
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    try {
      await notificationsService.registerToken(token);
    } catch {
      // Silently fail — token registration is not critical
    }

    return token;
  } catch {
    return null;
  }
}

export function addNotificationListener(
  handler: (notification: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  try {
    return Notifications.addNotificationReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
}

export function addNotificationResponseListener(
  handler: (response: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  try {
    return Notifications.addNotificationResponseReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
}
