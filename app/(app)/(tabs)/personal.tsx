// app/(me)/index.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Modal,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useDispatch, useSelector } from 'react-redux'

import { loadMe, UserProfile } from '@/store/slices/meSlice'
import { urlFromKey } from '@/services/media/urlFromKey'
import {
  fetchUserPostsList,
  FetchUserPostRes,
} from '@/services/users/fetchUserPost'
import { SafeAreaView } from 'react-native-safe-area-context'

const LIMIT = 18

const AVATAR_PLACEHOLDER =
  'https://avatar.iran.liara.run/public/boy?username=placeholder'

// ===== Masonry layout constants (2 columns) =====
const SCREEN_W = Dimensions.get('window').width
const GAP = 2
const NUM_COLS = 2
const COL_W = (SCREEN_W - GAP * (NUM_COLS - 1)) / NUM_COLS

type RootState = any // replace with your store RootState if you have it

type PostGridItemProps = {
  mediaUrl?: string
  ratio?: number // width/height
  onPress?: () => void
}

const PostGridItem: React.FC<PostGridItemProps> = ({
  mediaUrl,
  ratio,
  onPress,
}) => {
  const safeRatio = ratio && ratio > 0 ? ratio : 1
  const tileH = Math.max(80, Math.round(COL_W / safeRatio))

  return (
    <TouchableOpacity
      style={{ marginBottom: GAP }}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: mediaUrl }}
        style={{ width: COL_W, height: tileH, backgroundColor: '#eee' }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  )
}

export default function MeProfileScreen() {
  const router = useRouter()
  const dispatch = useDispatch<any>()

  const me = useSelector((s: RootState) => s.me.me) as UserProfile | null
  const meStatus = useSelector((s: RootState) => s.me.status) as
    | 'idle'
    | 'loading'
    | 'succeeded'
    | 'failed'
  const meError = useSelector((s: RootState) => s.me.error) as
    | string
    | undefined

  const [activeTab, setActiveTab] = useState<'posts' | 'tagged'>('posts')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [posts, setPosts] = useState<FetchUserPostRes>([])
  const [isPostsLoading, setIsPostsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Cache media ratios by url so we only call Image.getSize once per unique url
  const [ratioByUrl, setRatioByUrl] = useState<Record<string, number>>({})
  const inflight = useRef<Set<string>>(new Set())

  // UI state for modals
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false)

  const loadInitialPosts = async (userId: string) => {
    try {
      setIsPostsLoading(true)
      const res = await fetchUserPostsList(userId, LIMIT, 0)
      setPosts(() => [...res])
      setHasMore(res.length === LIMIT)
    } catch (e) {
      console.error(e)
      setPosts([])
      setHasMore(false)
    } finally {
      setIsPostsLoading(false)
    }
  }

  const loadMorePosts = async () => {
    if (!me?.id || isLoadingMore || !hasMore || activeTab !== 'posts') return
    try {
      setIsLoadingMore(true)
      const res = await fetchUserPostsList(me.id, LIMIT, posts.length)

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newUnique = res.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newUnique]
      })

      setHasMore(res.length === LIMIT)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setHasMore(true)
      const profile = await dispatch(loadMe()).unwrap()
      await loadInitialPosts(profile.id)
      if (me?.id) {
        await loadInitialPosts(me.id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleOpenPost = (postId: string) => {
    router.push({
      pathname: '../(post)/[id]',
      params: {
        id: postId,
      },
    })
  }

  const onPressActionButton = () => {
    Alert.alert('Edit Profile', 'Edit profile (placeholder)')
  }

  // Load me on mount
  useEffect(() => {
    if (meStatus === 'idle') {
      dispatch(loadMe())
    }
  }, [meStatus, dispatch])

  // When me loads, load avatar + posts
  useEffect(() => {
    const run = async () => {
      if (!me?.id) return

      // avatar
      if (me.avatarKey) {
        try {
          const url = await urlFromKey(me.avatarKey)
          setAvatarUrl(url)
        } catch (e) {
          console.error(e)
          setAvatarUrl(null)
        }
      } else {
        setAvatarUrl(null)
      }

      // posts
      await loadInitialPosts(me.id)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.avatarKey])

  // ===== Precompute ratios for visible post thumbnails =====
  const visibleMediaUrls = useMemo(() => {
    if (!posts?.length) return []
    const urls: string[] = []
    for (const p of posts) {
      const u = p.mediaUrl
      if (u) urls.push(u)
    }
    return Array.from(new Set(urls))
  }, [posts])

  useEffect(() => {
    const showPostsGrid = activeTab === 'posts'
    if (!showPostsGrid) return

    for (const url of visibleMediaUrls) {
      if (ratioByUrl[url]) continue
      if (inflight.current.has(url)) continue

      inflight.current.add(url)
      Image.getSize(
        url,
        (w, h) => {
          inflight.current.delete(url)
          const ratio = w > 0 && h > 0 ? w / h : 1
          setRatioByUrl((prev) =>
            prev[url] ? prev : { ...prev, [url]: ratio }
          )
        },
        () => {
          inflight.current.delete(url)
          setRatioByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: 1 }))
        }
      )
    }
  }, [visibleMediaUrls, ratioByUrl, activeTab])

  const renderPostItem = useCallback(
    ({ item }: { item: { id: string; mediaUrl: string } }) => {
      const mediaUrl = item.mediaUrl
      if (!mediaUrl) return null

      return (
        <PostGridItem
          mediaUrl={mediaUrl}
          ratio={ratioByUrl[mediaUrl] ?? 1}
          onPress={() => handleOpenPost(item.id)}
        />
      )
    },
    [ratioByUrl, posts]
  )

  // ───────────────────── TOP-LEVEL STATES ─────────────────────
  if (meStatus === 'loading' && !me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!me) {
    return (
      <View style={styles.center}>
        <Text>Could not load your profile.</Text>
        {meError ? (
          <Text style={{ marginTop: 8, color: '#666' }}>{meError}</Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.actionButton,
            { marginTop: 16, paddingHorizontal: 16 },
          ]}
          onPress={() => dispatch(loadMe())}
        >
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ───────────────────── MAIN RENDER ─────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar (no back button for "me") */}
      <View style={styles.topBar}>
        <View style={{ width: 24 }} />
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {me.handle}
        </Text>
        <TouchableOpacity onPress={() => setIsOptionsModalVisible(true)}>
          <Text style={styles.topBarMenu}>⋯</Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={activeTab === 'posts' ? posts : []}
        keyExtractor={(item: any) => item.id}
        renderItem={renderPostItem}
        masonry
        numColumns={2}
        onEndReachedThreshold={0.1}
        onEndReached={loadMorePosts}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <>
            {/* Avatar + stats */}
            <View style={styles.header}>
              <View style={styles.avatarStack}>
                <Image
                  source={{ uri: avatarUrl ?? AVATAR_PLACEHOLDER }}
                  style={[styles.avatar, styles.avatarBackLeft]}
                />

                <Image
                  source={{ uri: avatarUrl ?? AVATAR_PLACEHOLDER }}
                  style={[styles.avatar, styles.avatarBackRight]}
                />

                <Image
                  source={{ uri: avatarUrl ?? AVATAR_PLACEHOLDER }}
                  style={[styles.avatar, styles.avatarFront]}
                />
              </View>

              {/* Name + bio */}
              <View style={styles.bioSection}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.displayName}>{me.displayName}</Text>
                  <Text style={styles.handleName}>@{me.handle}</Text>
                </View>

                {me.bio ? <Text style={styles.bioText}>{me.bio}</Text> : null}
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{me.postsCount}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{me.followersCount}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{me.followingCount}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>
            </View>

            {/* Action row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onPressActionButton}
              >
                <Text style={styles.actionButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === 'posts' && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab('posts')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'posts' && styles.tabTextActive,
                  ]}
                >
                  Posts
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === 'tagged' && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab('tagged')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'tagged' && styles.tabTextActive,
                  ]}
                >
                  Tagged
                </Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={() => {
          if (isPostsLoading || activeTab !== 'posts') return null
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No posts yet.</Text>
            </View>
          )
        }}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      {/* Top-right options modal */}
      <Modal
        visible={isOptionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionsBackdrop}
          activeOpacity={1}
          onPressOut={() => setIsOptionsModalVisible(false)}
        >
          <View style={styles.optionsSheet}>
            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() =>
                Alert.alert('Settings', 'Open settings (placeholder)')
              }
            >
              <Text style={styles.optionsItemText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() =>
                Alert.alert('Share', 'Share profile (placeholder)')
              }
            >
              <Text style={styles.optionsItemText}>Share profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionsItem, styles.optionsCancel]}
              onPress={() => setIsOptionsModalVisible(false)}
            >
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  topBarMenu: {
    width: 24,
    textAlign: 'right',
    fontSize: 20,
    fontWeight: '700',
  },

  header: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  avatarStack: {
    width: 168,
    height: 168,
    position: 'relative',
  },
  avatar: {
    width: 144,
    height: 144,
    borderRadius: 44,
    backgroundColor: '#eee',
    position: 'absolute',
  },

  avatarBackLeft: {
    top: 0,
    left: -80,
    transform: [{ rotate: '-24deg' }],
    zIndex: 1,
  },

  avatarBackRight: {
    top: 0,
    left: 80,
    transform: [{ rotate: '8deg' }],
    zIndex: 2,
  },

  avatarFront: {
    top: 20,
    left: 0,
    zIndex: 3,
  },
  statsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#666' },

  bioSection: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  displayName: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  handleName: {
    fontSize: 12,
    color: '#666',
  },
  bioText: {
    fontSize: 13,
    color: '#222',
    textAlign: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  actionButtonText: { fontWeight: '600', fontSize: 14 },

  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    marginTop: 12,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#000' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#000' },

  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyStateText: { color: '#666', textAlign: 'center' },

  optionsBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  optionsSheet: {
    backgroundColor: '#fff',
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  optionsItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  optionsItemText: { fontSize: 15 },
  optionsCancel: { borderBottomWidth: 0, marginTop: 4 },
  optionsCancelText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
})
