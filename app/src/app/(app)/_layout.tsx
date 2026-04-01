import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useChatStore } from '@/stores/chat-store';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export default function AppLayout() {
  const colors = useTheme();
  const totalUnread = useChatStore((s) => s.totalUnread);

  usePushNotifications();

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
      {/* Feed tab */}
      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'Near Me',
          tabBarButtonTestID: 'tab-feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Search tab */}
      <Tabs.Screen
        name="search/index"
        options={{
          title: 'Search',
          tabBarButtonTestID: 'tab-search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Chat tab */}
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Chat',
          tabBarButtonTestID: 'tab-chat',
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Profile tab */}
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Hidden routes — not shown in tab bar */}
      <Tabs.Screen
        name="chat/[threadId]"
        options={{
          href: null,
          headerShown: true,
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="merchant/[id]"
        options={{
          href: null,
          headerShown: true,
          title: '',
        }}
      />
      <Tabs.Screen
        name="merchant/create"
        options={{
          href: null,
          headerShown: true,
          title: 'Become a Merchant',
        }}
      />
      <Tabs.Screen
        name="profile/merchant"
        options={{
          href: null,
          headerShown: true,
          title: 'My Merchant Profile',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
