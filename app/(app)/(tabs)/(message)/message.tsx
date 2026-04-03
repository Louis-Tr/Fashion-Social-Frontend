import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  RefreshControl,
  SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'

import { fetchConversations } from '@/services/message/fetchConversation'

import { AppDispatch, RootState, store } from '@/store/store'
import { fetchFeed } from '@/services/feed'
import { useDispatch, useSelector } from 'react-redux'
//import { Conversation } from '@/types/schemas/conversation'
import { urlFromKey } from '@/services/media/urlFromKey'
import { z } from 'zod'
import { BASE_URL } from '@/constants/Url'
import { getToken } from '@/utils/token'
import { setConversation } from '@/store/slices/conversationSlice'
import { Conversation } from '@/types/schemas/conversation'
import { options } from 'prettier-plugin-tailwindcss'

export default function MessageListScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const dispatch = useDispatch<AppDispatch>()

  const { conversations, isLoadingConversation } = useSelector(
    (state: RootState) => state.conversation
  )
  const me = useSelector((state: RootState) => state.auth.user)

  const meId = me?.sub

  useEffect(() => {
    console.log('Load Conversations')
    dispatch(fetchConversations())
  }, [])

  function onRefresh() {}

  function renderItem({ item }: { item: Conversation }) {
    const isDirect = item.type === 'dm'

    // other participant for DM
    const other =
      isDirect && meId
        ? item.participants.find((p) => p.id !== meId)
        : undefined

    const title = isDirect
      ? (other?.displayName ?? 'Direct message')
      : 'Group chat' // later: real group name

    const avatarUri =
      isDirect && other?.avatarKey ? urlFromKey(other.avatarKey) : undefined

    const lastMessageText = item.lastMessage?.content ?? 'No messages yet' // adjust to .content if your schema uses that

    const time = item.lastMessage?.createdAt
      ? new Date(item.lastMessage.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          router.push({
            pathname: './[id]',
            params: {
              id: item.id,
              avatarUri: avatarUri,
            },
          })
        }
      >
        <View style={styles.avatarWrapper}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {title?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.time}>{time}</Text>
          </View>

          <View style={styles.rowFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMessageText}
            </Text>
            {/* if you still have unread_count on this type, keep this */}
            {/* {item.unread_count > 0 && ... } */}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (isLoadingConversation) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View style={styles.container}>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No conversations yet.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 72,
  },
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 18, fontWeight: '600', color: '#555' },
  rowContent: { flex: 1 },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '600', maxWidth: '75%' },
  time: { fontSize: 12, color: '#999' },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: { flex: 1, color: '#555', fontSize: 14, marginRight: 8 },
  badge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 14, color: '#666' },
})
