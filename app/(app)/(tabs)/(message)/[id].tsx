// app/message/[id].tsx
import React, { useEffect, useCallback, useMemo, useState, memo } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSelector, useDispatch } from 'react-redux'

import type { RootState, AppDispatch } from '@/store/store'
import { fetchMessages } from '@/services/message/fetchMessages'
import type { Message } from '@/types/schemas/conversation'
import { useWebSocket } from '@/contexts/WebSocketContext'

/* ---------------------- Memoized Message Bubble ---------------------- */
function parseCreatedAt(value: string): Date {
  if (!value) return new Date(NaN)

  // First, try native parsing (in case backend changes to ISO later)
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  // Expecting: "YYYY-MM-DD HH:mm:ss.SSSSSS+00"
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\+(\d{2})$/
  )

  if (!match) {
    console.warn('[parseCreatedAt] Unhandled format:', value)
    return new Date(NaN)
  }

  const [, y, m, d, hh, mm, ss, frac] = match
  const ms = frac ? Number(frac.slice(0, 3)) : 0 // truncate to ms

  // +00 → UTC
  const date = new Date(
    Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
      ms
    )
  )

  console.log('[parseCreatedAt] parsed', { value, iso: date.toISOString() })
  return date
}

const MessageBubble = memo(function MessageBubble({
  item,
  avatarUri,
  isMe,
  isBeforeMe = false,
}: {
  item: Message
  isMe: boolean
  avatarUri?: string
  isBeforeMe?: boolean
}) {
  const createdAtDate = parseCreatedAt(item.createdAt)
  const isValid = !Number.isNaN(createdAtDate.getTime())

  const showAvatar = !isMe && isBeforeMe

  console.log('[MessageBubble] render', {
    id: item.id,
    rawCreatedAt: item.createdAt,
    isMe,
    isBeforeMe,
    showAvatar,
  })

  return (
    <View
      style={[
        styles.messageRow,
        isMe ? styles.messageRowMe : styles.messageRowOther,
      ]}
    >
      {/* Avatar slot for friend messages */}
      {!isMe ? (
        <View style={styles.avatarSlot}>
          {showAvatar && avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.bubbleWrapper,
          isMe ? styles.bubbleWrapperMe : styles.bubbleWrapperOther,
        ]}
      >
        <View
          style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
        >
          {!!item.content && (
            <Text style={isMe ? styles.textMe : styles.textOther}>
              {item.content}
            </Text>
          )}
          <Text style={styles.timeBubble}>
            {isValid
              ? createdAtDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </Text>
        </View>
      </View>
    </View>
  )
})

/* ---------------------- Memoized Input Bar ---------------------- */

type InputBarProps = {
  conversationId: string
  isReady: boolean
  onSend: (conversationId: string, text: string) => void
}

const MessageInputBar = memo(function MessageInputBar({
  conversationId,
  isReady,
  onSend,
}: InputBarProps) {
  const [text, setText] = useState('')

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || !conversationId || !isReady) return
    onSend(conversationId, trimmed)
    setText('')
  }, [text, conversationId, isReady, onSend])

  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        multiline
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!text.trim() || !isReady) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!text.trim() || !isReady}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  )
})

/* -------------------------- Screen Component ------------------------- */

export default function ConversationScreen() {
  const { id, avatarUri } = useLocalSearchParams<{
    id: string
    avatarUri: string
  }>()
  const conversationId = id as string

  const dispatch = useDispatch<AppDispatch>()
  const { conversations, isLoadingConversation } = useSelector(
    (state: RootState) => state.conversation
  )
  // auth.user?.sub is the user id used by backend
  const meId = useSelector((state: RootState) => state.auth.user?.sub)

  const { subscribe, unsubscribe, sendMessage, conversationReady } =
    useWebSocket()

  const conversation = conversations.find((c) => c.id === conversationId)
  const messages: Message[] = conversation?.messages ?? []

  // Sort oldest → newest, then use `inverted` so newest is at the bottom
  const displayMessages = useMemo(() => {
    const sorted = [...messages].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )

    console.log('[ConversationScreen] displayMessages sorted DESC', {
      conversationId,
      count: sorted.length,
      ids: sorted.map((m) => m.id),
    })

    return sorted
  }, [messages, conversationId])

  useEffect(() => {
    console.log('[ConversationScreen] mount', { conversationId, meId })
  }, [conversationId, meId])

  // initial load
  useEffect(() => {
    if (!conversationId) return
    console.log('[ConversationScreen] fetchMessages initial', {
      conversationId,
    })
    dispatch(fetchMessages(conversationId))
  }, [conversationId, dispatch])

  // subscribe to live updates for this conversation
  useEffect(() => {
    if (!conversationId) return
    console.log('[ConversationScreen] subscribe', { conversationId })
    subscribe(conversationId)
    return () => {
      console.log('[ConversationScreen] unsubscribe', { conversationId })
      unsubscribe(conversationId)
    }
  }, [conversationId, subscribe, unsubscribe])

  // log whenever messages change
  useEffect(() => {
    console.log('[ConversationScreen] messages updated', {
      conversationId,
      count: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        createdAt: m.createdAt,
      })),
    })
  }, [conversationId, messages])

  // load more (older) messages when user scrolls up
  const handleLoadMore = useCallback(() => {
    if (!conversationId || isLoadingConversation) return
    console.log('[ConversationScreen] handleLoadMore', {
      conversationId,
      isLoadingConversation,
    })
    dispatch(fetchMessages(conversationId))
  }, [conversationId, isLoadingConversation, dispatch])

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isMe = item.senderId === meId

      // Access next item (messages sorted DESC because inverted)
      const before = displayMessages[index - 1]

      const isBeforeMe = before?.senderId === meId

      return (
        <MessageBubble
          item={item}
          isMe={isMe}
          isBeforeMe={isBeforeMe}
          avatarUri={avatarUri}
        />
      )
    },
    [meId, displayMessages, avatarUri]
  )

  const handleSend = useCallback(
    (convId: string, text: string) => {
      console.log('[ConversationScreen] sendMessage', {
        conversationId: convId,
        text,
        meId,
      })
      sendMessage(convId, text)
    },
    [sendMessage, meId]
  )

  if (!conversationId) {
    return (
      <View style={styles.center}>
        <Text>Missing conversation id</Text>
      </View>
    )
  }

  if (!conversation && isLoadingConversation) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!conversation && !isLoadingConversation) {
    return (
      <View style={styles.center}>
        <Text>Conversation not found</Text>
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.container}>
          <FlatList
            data={displayMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={{ paddingVertical: 8 }}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onEndReached={handleLoadMore}
            ListFooterComponent={
              isLoadingConversation ? (
                <View style={styles.footer}>
                  <ActivityIndicator size="small" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              !isLoadingConversation ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No messages yet.</Text>
                </View>
              ) : null
            }
          />

          <MessageInputBar
            conversationId={conversationId}
            isReady={conversationReady}
            onSend={handleSend}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingVertical: 8 },
  empty: { paddingVertical: 16, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 14 },

  messageRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },

  avatarSlot: {
    width: 32,
    alignItems: 'center',
    marginRight: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  bubbleWrapper: {
    maxWidth: '80%',
  },
  bubbleWrapperMe: {
    marginLeft: 'auto',
  },
  bubbleWrapperOther: {},

  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMe: { backgroundColor: '#007AFF', borderTopRightRadius: 4 },
  bubbleOther: { backgroundColor: '#eee', borderTopLeftRadius: 4 },

  textMe: { color: '#fff', fontSize: 14 },
  textOther: { color: '#111', fontSize: 14 },

  timeBubble: {
    alignSelf: 'flex-end',
    fontSize: 10,
    marginTop: 4,
    color: '#ccc',
  },

  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
})
