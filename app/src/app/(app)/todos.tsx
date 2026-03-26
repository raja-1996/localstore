import { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Pressable, View, Alert, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { TodoCard } from '../../components/todo-card';
import { useTodos, useUpdateTodo, useDeleteTodo } from '../../hooks/use-todos';
import { useTheme } from '../../hooks/use-theme';
import { Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function TodosScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { data: todos, isLoading, refetch } = useTodos();
  const { mutate: updateTodo } = useUpdateTodo();
  const { mutate: deleteTodo } = useDeleteTodo();
  const [refreshing, setRefreshing] = useState(false);

  const fabStyle = useMemo(
    () => [styles.fab, { backgroundColor: colors.primary }],
    [colors.primary]
  );

  const fabTextStyle = useMemo(
    () => [styles.fabText, { color: colors.primaryText }],
    [colors.primaryText]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePress = useCallback((id: string) => {
    router.push({ pathname: '/(app)/todo-detail', params: { id } });
  }, [router]);

  const handleToggle = useCallback((id: string, isCompleted: boolean) => {
    updateTodo({ id, data: { is_completed: !isCompleted } });
  }, [updateTodo]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Todo', 'Are you sure you want to delete this todo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTodo(id) },
    ]);
  }, [deleteTodo]);

  const renderItem = useCallback(({ item }: { item: { id: string; title: string; description?: string; is_completed: boolean } }) => (
    <TodoCard
      id={item.id}
      title={item.title}
      description={item.description}
      isCompleted={item.is_completed}
      onPress={handlePress}
      onToggle={handleToggle}
      onLongPress={handleDelete}
    />
  ), [handlePress, handleToggle, handleDelete]);

  return (
    <ThemedView style={styles.container}>
      <FlashList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        estimatedItemSize={72}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyIcon}>☑</ThemedText>
              <ThemedText style={styles.emptyTitle}>No todos yet</ThemedText>
              <ThemedText variant="secondary" style={styles.emptyCaption}>Tap + to create your first one</ThemedText>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <Pressable
        testID="fab-button"
        onPress={() => router.push({ pathname: '/(app)/todo-detail' })}
        style={({ pressed }) => [fabStyle, pressed && styles.fabPressed]}
      >
        <ThemedText style={fabTextStyle}>+</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingBottom: Spacing.xxl * 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: FontSize.xxl,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptyCaption: {
    fontSize: FontSize.md,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
  },
  fabText: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  fabPressed: {
    opacity: 0.7,
  },
});
