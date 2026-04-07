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
} from 'react-native'
import { useRouter } from 'expo-router'
import { useDispatch, useSelector } from 'react-redux'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchConversations } from '@/services/message/fetchConversation'
import type { AppDispatch, RootState } from '@/store/store'
import { urlFromKey } from '@/services/media/urlFromKey'
import type { Conversation } from '@/types/schemas/conversation'

function parseDate(value?: string | null): number {
  if (!value) return Number.NaN
  const parsed = new Date(value).getTime()
  if (!Number.isNaN(parsed)) return parsed

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2})(?::?(\d{2}))?$/
  )
  if (!match) return Number.NaN

  const [, y, m, d, hh, mm, ss, frac, sign, offsetHours, offsetMinutes] = match
  const baseUtc = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    frac ? Number(frac.slice(0, 3)) : 0
  )
  const offsetMs =
    (Number(offsetHours) * 60 + Number(offsetMinutes ?? '0')) *
    60 *
    1000 *
    (sign === '+' ? 1 : -1)

  return baseUtc - offsetMs
}

export default function MessageListScreen() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  const { conversations, isLoadingConversation } = useSelector(
    (state: RootState) => state.conversation
  )
  const me = useSelector((state: RootState) => state.auth.user)
  const meId = me?.sub ?? null

  const [refreshing, setRefreshing] = useState(false)

  // initial load
  useEffect(() => {
    console.log('Load Conversations')
    dispatch(fetchConversations())
  }, [dispatch])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    dispatch(fetchConversations()).finally(() => {
      setRefreshing(false)
    })
  }, [dispatch])

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const isDirect = item.type === 'dm'

      const other =
        isDirect && meId
          ? item.participants.find((p) => p.id !== meId)
          : undefined

      const title = isDirect
        ? (other?.displayName ?? 'Direct message')
        : 'Group chat' // later: real group name

      const avatarUri =
        isDirect && other?.avatarKey ? urlFromKey(other.avatarKey) : undefined

      const lastMessageText = item.lastMessage?.content ?? 'No messages yet'

      const parsedTs = parseDate(item.lastMessage?.createdAt)
      const time = !Number.isNaN(parsedTs)
        ? new Date(parsedTs).toLocaleTimeString([], {
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
            </View>
          </View>
        </TouchableOpacity>
      )
    },
    [router, meId]
  )

  if (isLoadingConversation && !refreshing) {
    return (
      <SafeAreaView edges={['top']} style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Text style={styles.headerTitle}>Fashion Talks</Text>
      <FlatList
        data={[...conversations].sort((a, b) => {
          const aTs = parseDate(a.lastMessage?.createdAt)
          const bTs = parseDate(b.lastMessage?.createdAt)
          if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) return bTs - aTs
          if (!Number.isNaN(aTs)) return -1
          if (!Number.isNaN(bTs)) return 1
          return a.id.localeCompare(b.id)
        })}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 24, // text-2xl
    fontWeight: '600', // font-semibold
    letterSpacing: 0.5, // tracking-wide (approx)
    color: '#DB2777', // text-pink-600
    paddingHorizontal: 16, // optional: aligns with list padding
    paddingBottom: 8, // optional: breathing room
  },
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
  empty: { fontSize: 14, color: '#666' },
})
