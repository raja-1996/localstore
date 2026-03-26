import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { Button } from '../../components/button';
import { useAuthStore } from '../../stores/auth-store';
import { useTheme } from '../../hooks/use-theme';
import { supabase } from '../../lib/supabase';
import { Spacing, BorderRadius, FontSize } from '../../constants/theme';

interface LogEntry {
  id: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  title: string;
  timestamp: string;
}

const CHANNEL_NAME = 'realtime-playground';
const LOG_CAP = 50;

export default function RealtimeScreen() {
  const colors = useTheme();
  const user = useAuthStore((s) => s.user);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [presenceCount, setPresenceCount] = useState(0);
  const [counter, setCounter] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const cardStyle = useMemo(
    () => [styles.card, { backgroundColor: colors.background, borderBottomColor: colors.border }],
    [colors.background, colors.border]
  );

  const channelRef = useRef<RealtimeChannel | null>(null);

  const setupChannel = useCallback(() => {
    if (channelRef.current) {
      return;
    }

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: true } },
    });

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'todos' },
      (payload) => {
        const record = (payload.new && Object.keys(payload.new).length > 0
          ? payload.new
          : payload.old) as Record<string, unknown>;

        const entry: LogEntry = {
          id: `${Date.now()}-${Math.random()}`,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          title: record?.title != null ? String(record.title) : '(untitled)',
          timestamp: new Date().toLocaleTimeString(),
        };

        setLog((prev) => [entry, ...prev].slice(0, LOG_CAP));
      }
    );

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setPresenceCount(Object.keys(state).length);
    });

    channel.on('broadcast', { event: 'counter' }, (payload) => {
      if (typeof payload.payload?.value === 'number') {
        setCounter(payload.payload.value);
      }
    });

    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) supabase.realtime.setAuth(accessToken);

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        channel.track({ user_id: user?.id ?? 'anonymous' });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
        if (channelRef.current) {
          channelRef.current = null;
          supabase.removeChannel(channel);
        }
      }
    });
  }, [user?.id]);

  useEffect(() => {
    setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [setupChannel]);

  const handleToggleConnection = () => {
    if (isConnected) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    } else {
      setupChannel();
    }
  };

  const handleIncrement = () => {
    const nextValue = counter + 1;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'counter',
      payload: { value: nextValue },
    });
  };

  const getBadgeColor = useCallback((eventType: LogEntry['eventType']) => {
    if (eventType === 'INSERT') return colors.success;
    if (eventType === 'UPDATE') return colors.primary;
    return colors.danger;
  }, [colors.success, colors.primary, colors.danger]);

  const renderLogEntry = useCallback(({ item }: { item: LogEntry }) => (
    <View style={styles.logEntry}>
      <View style={[styles.badge, { backgroundColor: getBadgeColor(item.eventType) }]}>
        <ThemedText style={styles.badgeText}>{item.eventType}</ThemedText>
      </View>
      <ThemedText style={styles.logTitle} numberOfLines={1}>{item.title}</ThemedText>
      <ThemedText variant="secondary" style={styles.logTimestamp}>{item.timestamp}</ThemedText>
    </View>
  ), [getBadgeColor]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Connection toggle */}
        <View style={styles.connectionRow}>
          <Button
            title={isConnected ? 'Disconnect' : 'Reconnect'}
            variant={isConnected ? 'danger' : 'primary'}
            onPress={handleToggleConnection}
            testID="disconnect-button"
          />
        </View>

        {/* Card 1: Live Todos Feed */}
        <View style={cardStyle}>
          <ThemedText style={styles.cardTitle}>Live Todos Feed</ThemedText>
          <View style={styles.logContainer}>
            <FlashList
              data={log}
              keyExtractor={(item) => item.id}
              renderItem={renderLogEntry}
              estimatedItemSize={36}
              testID="log-list"
              scrollEnabled={false}
              ListEmptyComponent={
                <ThemedText variant="secondary" style={styles.emptyText}>
                  Waiting for todo changes…
                </ThemedText>
              }
            />
          </View>
        </View>

        {/* Card 2: Presence */}
        <View style={cardStyle}>
          <ThemedText style={styles.cardTitle}>Presence</ThemedText>
          <ThemedText
            testID="presence-count"
            style={styles.presenceText}
          >
            {presenceCount} user(s) on this screen
          </ThemedText>
        </View>

        {/* Card 3: Broadcast Counter */}
        <View style={cardStyle}>
          <ThemedText style={styles.cardTitle}>Broadcast Counter</ThemedText>
          <ThemedText testID="counter-value" style={styles.counterValue}>
            {counter}
          </ThemedText>
          <Button
            title="Increment"
            variant="primary"
            onPress={handleIncrement}
            testID="increment-button"
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md },
  connectionRow: {
    marginBottom: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  logContainer: {
    height: 200,
    overflow: 'hidden',
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  logTitle: {
    flex: 1,
    fontSize: FontSize.md,
  },
  logTimestamp: {
    fontSize: FontSize.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  presenceText: {
    fontSize: FontSize.lg,
  },
  counterValue: {
    fontSize: FontSize.title,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
