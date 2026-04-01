import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { registerForPushNotifications, Notifications } from '@/lib/notifications';
import { userService } from '@/services/user-service';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Hook: registers push token on mount (after auth), handles notification taps.
 * Call once in the authenticated layout.
 */
export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tokenRegistered = useRef(false);

  // Register push token after login
  useEffect(() => {
    if (!isAuthenticated || tokenRegistered.current) return;

    (async () => {
      const token = await registerForPushNotifications();
      if (!token) return;

      try {
        await userService.registerPushToken(token);
        tokenRegistered.current = true;
      } catch (e) {
        console.warn('Failed to register push token:', e);
      }
    })();
  }, [isAuthenticated]);

  // Handle notification tap (warm start — app in background)
  useEffect(() => {
    if (!Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.screen === 'chat' && data?.threadId) {
          router.push(`/chat/${data.threadId}`);
        } else if (data?.screen === 'merchant' && data?.merchantId) {
          router.push(`/merchant/${data.merchantId}`);
        }
      },
    );

    return () => subscription.remove();
  }, []);

  // Handle cold-start notification (app was killed)
  useEffect(() => {
    if (!isAuthenticated || !Notifications) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;

      if (data?.screen === 'chat' && data?.threadId) {
        router.push(`/chat/${data.threadId}`);
      } else if (data?.screen === 'merchant' && data?.merchantId) {
        router.push(`/merchant/${data.merchantId}`);
      }
    });
  }, [isAuthenticated]);
}
