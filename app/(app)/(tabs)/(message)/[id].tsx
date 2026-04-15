// app/message/[id].tsx
import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  memo,
  useRef,
} from 'react'
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
  Image,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useSelector, useDispatch } from 'react-redux'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import type { RootState, AppDispatch } from '@/store/store'
import { fetchMessages } from '@/services/message/fetchMessages'
import type { Message } from '@/types/schemas/conversation'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { hideTabBar, showTabBar } from '@/store/slices/tabBarSlice'

type MessageRow =
  | { type: 'time'; id: string; label: string }
  | { type: 'message'; id: string; message: Message }

/* ---------------------- Memoized Message Bubble ---------------------- */
const TIME_BREAK_MINUTES = 30

function parseCreatedAt(value: string): Date {
  if (!value) return new Date(NaN)

  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2})(?::?(\d{2}))?$/
  )

  if (!match) return new Date(NaN)

  const [, y, m, d, hh, mm, ss, frac, sign, offsetHours, offsetMinutes] = match
  const ms = frac ? Number(frac.slice(0, 3)) : 0

  const utcMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    ms
  )
  const offsetMs =
    (Number(offsetHours) * 60 + Number(offsetMinutes ?? '0')) *
    60 *
    1000 *
    (sign === '+' ? 1 : -1)

  return new Date(utcMs - offsetMs)
}

function isTimeBreakNeeded(newer: Message, older: Message) {
  const newerDate = parseCreatedAt(newer.createdAt)
  const olderDate = parseCreatedAt(older.createdAt)

  if (Number.isNaN(newerDate.getTime()) || Number.isNaN(olderDate.getTime())) {
    return false
  }

  const diffMs = Math.abs(newerDate.getTime() - olderDate.getTime())
  const diffMinutes = diffMs / (1000 * 60)

  const isDifferentDay =
    newerDate.getFullYear() !== olderDate.getFullYear() ||
    newerDate.getMonth() !== olderDate.getMonth() ||
    newerDate.getDate() !== olderDate.getDate()

  return isDifferentDay || diffMinutes >= TIME_BREAK_MINUTES
}

function formatTimeBreak(value: string) {
  const date = parseCreatedAt(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildMessageRows(messages: Message[]): MessageRow[] {
  if (messages.length === 0) return []

  // messages must already be DESC: newest -> oldest
  const rows: MessageRow[] = []

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i]
    const newer = messages[i - 1]

    if (newer && isTimeBreakNeeded(newer, current)) {
      // Insert a time row before the current message if there is a large gap
      // between the newer message and the current older message.
      rows.push({
        type: 'time',
        id: `time-${current.id}`,
        label: formatTimeBreak(current.createdAt),
      })
    }

    rows.push({
      type: 'message',
      id: current.id,
      message: current,
    })
  }

  const oldest = messages[messages.length - 1]
  rows.push({
    type: 'time',
    id: `time-oldest-${oldest.id}`,
    label: formatTimeBreak(oldest.createdAt),
  })

  return rows
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
  const showAvatar = !isMe && isBeforeMe

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
  bottomInset?: number
}

const MessageInputBar = memo(function MessageInputBar({
  conversationId,
  isReady,
  onSend,
  bottomInset = 0,
}: InputBarProps) {
  const [text, setText] = useState('')

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || !conversationId || !isReady) return
    onSend(conversationId, trimmed)
    setText('')
  }, [text, conversationId, isReady, onSend])

  return (
    <View style={[styles.inputContainer, { paddingBottom: Math.max(bottomInset, 8) }]}>
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

const TimeBreak = memo(function TimeBreak({ label }: { label: string }) {
  if (!label) return null

  return (
    <View style={styles.timeBreakRow}>
      <View style={styles.timeBreakLine} />
      <Text style={styles.timeBreakText}>{label}</Text>
      <View style={styles.timeBreakLine} />
    </View>
  )
})

/* -------------------------- Screen Component ------------------------- */

export default function ConversationScreen() {
  const { id, avatarUri, displayName } = useLocalSearchParams<{
    id: string
    avatarUri: string
    displayName: string
  }>()
  const conversationId = id as string

  const listRef = useRef<FlatList<MessageRow>>(null)
  const pendingScrollToLatestRef = useRef(false)
  const previousTopMessageIdRef = useRef<string | undefined>(undefined)

  const dispatch = useDispatch<AppDispatch>()
  const insets = useSafeAreaInsets()
  const { conversations, isLoadingConversation } = useSelector(
    (state: RootState) => state.conversation
  )
  // auth.user?.sub is the user id used by backend
  const meId = useSelector((state: RootState) => state.auth.user?.sub)
  useEffect(() => {
    if (id) {
      dispatch(hideTabBar())
    } else {
      dispatch(showTabBar())
    }
    return () => {
      dispatch(showTabBar())
    }
  }, [id, dispatch])

  const { subscribe, unsubscribe, sendMessage, conversationReady } =
    useWebSocket()

  const conversation = conversations.find((c) => c.id === conversationId)
  const messages: Message[] = conversation?.messages ?? []

  // Sort newest → oldest, then use `inverted` so newest is at the bottom
  const displayMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTs = parseCreatedAt(a.createdAt).getTime()
      const bTs = parseCreatedAt(b.createdAt).getTime()
      if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) return bTs - aTs
      if (!Number.isNaN(aTs)) return -1
      if (!Number.isNaN(bTs)) return 1
      return b.id.localeCompare(a.id)
    })
  }, [messages])

  const rows = useMemo(() => {
    return buildMessageRows(displayMessages)
  }, [displayMessages])

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

  useEffect(() => {
    const newestId = displayMessages[0]?.id

    if (
      pendingScrollToLatestRef.current &&
      newestId &&
      newestId !== previousTopMessageIdRef.current
    ) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true })
        pendingScrollToLatestRef.current = false
      })
    }

    previousTopMessageIdRef.current = newestId
  }, [displayMessages])

  // load more (older) messages when user scrolls up
    const isFetchingMoreRef = useRef(false)
    const onEndReachedCalledDuringMomentum = useRef(true)
    const handleLoadMore = useCallback(async () => {
      if (!conversationId) return
      if (isLoadingConversation) return
      if (isFetchingMoreRef.current) return
      if (onEndReachedCalledDuringMomentum.current) return

      try {
        isFetchingMoreRef.current = true
        onEndReachedCalledDuringMomentum.current = true

        console.log('[ConversationScreen] handleLoadMore', {
          conversationId,
          isLoadingConversation,
        })

        await dispatch(fetchMessages(conversationId))
      } finally {
        isFetchingMoreRef.current = false
      }
    }, [conversationId, isLoadingConversation, dispatch])

  const renderItem = useCallback(
    ({ item, index }: { item: MessageRow; index: number }) => {
      if (item.type === 'time') {
        return <TimeBreak label={item.label} />
      }

      const message = item.message
      const isMe = message.senderId === meId

      // Find neighboring message rows only
      let newerMessage: Message | undefined
      for (let i = index - 1; i >= 0; i--) {
        const row = rows[i]
        if (row.type === 'message') {
          newerMessage = row.message
          break
        }
      }

      const isBeforeMe = newerMessage?.senderId === meId

      return (
        <MessageBubble
          item={message}
          isMe={isMe}
          isBeforeMe={isBeforeMe}
          avatarUri={avatarUri}
        />
      )
    },
    [meId, rows, avatarUri]
  )

  const handleSend = useCallback(
    (convId: string, text: string) => {
      pendingScrollToLatestRef.current = true

      sendMessage(convId, text)

      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true })
      })
    },
    [sendMessage]
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
          <>
                <Stack.Screen
                  options={{
                    headerShown: true,
                    title: displayName || 'Conversation',
                      headerBackTitleVisible: false,
                  }}
                />
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.container}>
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={{ paddingVertical: 8 }}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            onMomentumScrollBegin={() => {
              onEndReachedCalledDuringMomentum.current = false
            }}
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
            bottomInset={insets.bottom}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
          </>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
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
    paddingBottom: 32,
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

  timeBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginVertical: 10,
  },
  timeBreakLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  timeBreakText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#777',
  },
})
