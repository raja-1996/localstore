import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/use-theme';
import {
  registerForPushNotifications,
  addNotificationListener,
  addNotificationResponseListener,
} from '../../lib/notifications';

export default function AppLayout() {
  const colors = useTheme();
  const router = useRouter();
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    registerForPushNotifications().catch(() => {
      // permission denied or simulator — silently ignore
    });

    notificationListener.current = addNotificationListener((_notification) => {
      // no-op: notification received in foreground
    });

    responseListener.current = addNotificationResponseListener((response) => {
      const todoId = response.notification.request.content.data?.todoId;
      if (todoId) {
        router.push({ pathname: '/(app)/todo-detail', params: { id: todoId } });
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="todos"
        options={{
          title: 'Todos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="realtime"
        options={{
          title: 'Realtime',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="todo-detail"
        options={{
          href: null,
          title: 'Todo',
        }}
      />
    </Tabs>
  );
}
