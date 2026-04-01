import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useMessages, useSendMessage, useMarkRead, useChatRealtime, activeChatThreadRef } from '@/hooks/use-chat';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/types/chat';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------
interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
}

function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const colors = useTheme();

  return (
    <View
      testID={`message-bubble-${message.id}`}
      style={[
        styles.bubbleWrapper,
        isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs,
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.primary : colors.surface,
            borderColor: isMine ? colors.primary : colors.border,
          },
        ]}
      >
        <ThemedText
          style={[
            styles.bubbleText,
            { color: isMine ? colors.primaryText : colors.text },
          ]}
        >
          {message.content}
        </ThemedText>
        <ThemedText
          style={[
            styles.bubbleTime,
            { color: isMine ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
          ]}
        >
          {new Date(message.created_at).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </ThemedText>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChatDetailScreen
// ---------------------------------------------------------------------------
export default function ChatDetailScreen() {
  const { threadId, merchantName } = useLocalSearchParams<{
    threadId: string;
    merchantName: string;
  }>();

  const navigation = useNavigation();
  const colors = useTheme();
  const userId = useAuthStore((s) => s.user?.id);

  const [inputText, setInputText] = useState('');
  const textInputRef = useRef<TextInput>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(threadId);

  const { mutate: sendMutate, isPending: isSendPending } = useSendMessage();
  const { mutate: markReadMutate } = useMarkRead();

  // Track message count for auto mark-read on new messages
  const prevMessageCountRef = useRef(0);

  // Set header title
  useEffect(() => {
    if (merchantName) {
      navigation.setOptions({ title: merchantName });
    }
  }, [navigation, merchantName]);

  // Set active thread on mount, clear on unmount
  useEffect(() => {
    activeChatThreadRef.current = threadId;
    return () => {
      activeChatThreadRef.current = null;
    };
  }, [threadId]);

  // Mark read on mount
  useEffect(() => {
    if (threadId) {
      markReadMutate({ threadId });
    }
  }, [threadId, markReadMutate]);

  const allMessages: ChatMessage[] = data?.pages.flatMap((p) => p.data) ?? [];

  // Mark read when message count increases while this screen is focused
  useEffect(() => {
    const count = allMessages.length;
    if (count > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      markReadMutate({ threadId });
    }
    prevMessageCountRef.current = count;
  }, [allMessages.length, threadId, markReadMutate]);

  // Realtime subscription
  useChatRealtime(threadId);

  const handleSend = useCallback(() => {
    const content = inputText.trim();
    if (!content) return;
    setInputText('');
    textInputRef.current?.clear();
    sendMutate({ threadId, content });
  }, [inputText, threadId, sendMutate]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble message={item} isMine={item.sender_id === userId} />
    ),
    [userId]
  );

  if (isLoading) {
    return (
      <ThemedView testID="chat-detail-screen" style={styles.container}>
        <SkeletonCard count={5} />
      </ThemedView>
    );
  }

  return (
    <ThemedView testID="chat-detail-screen" style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={allMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <ThemedText variant="secondary" style={styles.emptyText}>
                Say hello to get the conversation started
              </ThemedText>
            </View>
          }
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            ref={textInputRef}
            testID="message-input"
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Message..."
            placeholderTextColor={colors.textSecondary}
            defaultValue=""
            onChangeText={setInputText}
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <Pressable
            testID="send-button"
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim()
                  ? colors.primary
                  : colors.border,
              },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSendPending}
          >
            {isSendPending ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <ThemedText
                style={[styles.sendButtonText, { color: colors.primaryText }]}
              >
                ↑
              </ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  footer: {
    paddingVertical: Spacing.md,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.md,
  },

  // Message bubble
  bubbleWrapper: {
    marginVertical: 3,
    maxWidth: '75%',
  },
  bubbleWrapperMine: {
    alignSelf: 'flex-end',
  },
  bubbleWrapperTheirs: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    gap: 2,
  },
  bubbleText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  bubbleTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
});
