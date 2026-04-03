// app/(user)/[id].tsx
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import { fetchProfile, UserProfile } from '@/services/users/fetchProfile'
import { urlFromKey } from '@/services/media/urlFromKey'
import {
  fetchUserPostsList,
  FetchUserPostRes,
} from '@/services/users/fetchUserPost'

// friendship services (you already defined these)
import {
  getFriendshipStatus,
  addFriendRequest,
  acceptFriendRequest,
  blockRequest,
  unblockRequest,
  unfriendRequest,
} from '@/services/users/relationship'
import PostItem from '@/components/Post'
import { SafeAreaView } from 'react-native-safe-area-context'

const LIMIT = 18

const AVATAR_PLACEHOLDER =
  'https://avatar.iran.liara.run/public/boy?username=placeholder'

type FriendshipStatus =
  | 'self'
  | 'blocked'
  | 'blocked_by_them'
  | 'friend'
  | 'incoming_request'
  | 'outgoing_request'
  | 'none'

// ===== Masonry layout constants (2 columns) =====
const SCREEN_W = Dimensions.get('window').width
const GAP = 2
const NUM_COLS = 2
const COL_W = (SCREEN_W - GAP * (NUM_COLS - 1)) / NUM_COLS

type PostGridItemProps = {
  mediaUrl?: string
  ratio?: number // width/height
  onPress?: () => void
}

/**
 * One masonry tile:
 * - width fixed to column width
 * - height computed from ratio to preserve aspect ratio
 */
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

export default function UserProfileScreen() {
  const { id, userInfo } = useLocalSearchParams<{
    id?: string
    userInfo?: string
  }>()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [activeTab, setActiveTab] = useState<'posts' | 'tagged'>('posts')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [posts, setPosts] = useState<FetchUserPostRes>([])
  const [isPostsLoading, setIsPostsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Cache media ratios by url so we only call Image.getSize once per unique url
  const [ratioByUrl, setRatioByUrl] = useState<Record<string, number>>({})
  const inflight = useRef<Set<string>>(new Set())

  // friendship state
  const [friendshipStatus, setFriendshipStatus] =
    useState<FriendshipStatus>('none')
  const [isStatusLoading, setIsStatusLoading] = useState(true)

  // UI state for dropdowns / modals
  const [isFriendMenuVisible, setIsFriendMenuVisible] = useState(false)
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false)

  const isSelf = friendshipStatus === 'self'
  const hasPublicPosts = posts.length > 0

  // If user has any posts at all, treat them as public & show them
  const canSeePosts = isSelf || friendshipStatus === 'friend' || hasPublicPosts

  // ─────────────────────  LOADERS  ─────────────────────
  const loadProfile = async () => {
    if (!id) return
    try {
      setIsProfileLoading(true)
      const data = await fetchProfile(id as string)
      setProfile(data)
    } catch (err) {
      console.error(err)
      setProfile(null)
    } finally {
      setIsProfileLoading(false)
    }
  }

  const loadInitialPosts = async () => {
    if (!id) return
    try {
      setIsPostsLoading(true)
      const res = await fetchUserPostsList(id as string, LIMIT, 0)
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
    if (!id || isLoadingMore || !hasMore || activeTab !== 'posts') return
    if (!canSeePosts) return

    try {
      setIsLoadingMore(true)
      const res = await fetchUserPostsList(id as string, LIMIT, posts.length)

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

  const loadFriendshipStatus = async () => {
    if (!id) return
    try {
      setIsStatusLoading(true)
      const status = await getFriendshipStatus(id as string)
      setFriendshipStatus(status as FriendshipStatus)
    } catch (e) {
      console.error(e)
      setFriendshipStatus('none')
    } finally {
      setIsStatusLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!id) return
    try {
      setIsRefreshing(true)
      setHasMore(true)
      await Promise.all([
        loadProfile(),
        loadInitialPosts(),
        loadFriendshipStatus(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleOpenPost = (postId: string) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return

    router.push({
      pathname: '../(post)/[id]',
      params: {
        id: postId,
        post: JSON.stringify(post),
        userInfo: userInfo,
      },
    })
  }

  // ───────────────────── FRIENDSHIP ACTION HANDLERS ─────────────────────
  const handleAddFriend = async () => {
    if (!id) return
    try {
      await addFriendRequest(id as string)
      setFriendshipStatus('outgoing_request')
    } catch (e: any) {
      console.error(e)
      Alert.alert('Error', e?.message || 'Failed to send friend request')
    }
  }

  const handleAcceptFriend = async () => {
    if (!id) return
    try {
      await acceptFriendRequest(id as string)
      setFriendshipStatus('friend')
    } catch (e: any) {
      console.error(e)
      Alert.alert('Error', e?.message || 'Failed to accept friend request')
    }
  }

  const handleBlock = async () => {
    if (!id) return
    try {
      await blockRequest(id as string)
      setFriendshipStatus('blocked')
      setIsFriendMenuVisible(false)
      setIsOptionsModalVisible(false)
    } catch (e: any) {
      console.error(e)
      Alert.alert('Error', e?.message || 'Failed to block user')
    }
  }

  const handleUnblock = async () => {
    if (!id) return
    try {
      await unblockRequest(id as string)
      setFriendshipStatus('none')
      setIsFriendMenuVisible(false)
      setIsOptionsModalVisible(false)
    } catch (e: any) {
      console.error(e)
      Alert.alert('Error', e?.message || 'Failed to unblock user')
    }
  }

  const handleUnfriend = async () => {
    if (!id) return
    try {
      await unfriendRequest(id as string)
      setFriendshipStatus('none')
      setIsFriendMenuVisible(false)
    } catch (e: any) {
      console.error(e)
      Alert.alert('Error', e?.message || 'Failed to unfriend')
    }
  }

  const handleReportUser = () => {
    Alert.alert('Report', 'Report user (placeholder)')
    setIsFriendMenuVisible(false)
    setIsOptionsModalVisible(false)
  }

  const handleCopyProfileCode = () => {
    Alert.alert('Copy', 'Profile code copied (placeholder)')
    setIsOptionsModalVisible(false)
  }

  const handleMessage = () => {
    if (!id) return
    router.push({ pathname: '../(message)/message', params: { id } })
  }

  const onPressActionButton = () => {
    if (isSelf) {
      Alert.alert('Edit Profile', 'Edit profile (placeholder)')
      return
    }

    if (friendshipStatus === 'friend') {
      setIsFriendMenuVisible(true)
      return
    }

    if (friendshipStatus === 'none') {
      handleAddFriend()
      return
    }

    if (friendshipStatus === 'incoming_request') {
      handleAcceptFriend()
      return
    }

    if (friendshipStatus === 'outgoing_request') {
      Alert.alert('Friend request', 'Request already sent')
      return
    }

    if (friendshipStatus === 'blocked') {
      handleUnblock()
      return
    }

    if (friendshipStatus === 'blocked_by_them') {
      Alert.alert('User blocked', 'You cannot interact with this user.')
      return
    }
  }

  const renderActionButtonLabel = () => {
    if (isStatusLoading) return '...'
    if (isSelf) return 'Edit Profile'

    switch (friendshipStatus) {
      case 'friend':
        return 'Friends ▾'
      case 'incoming_request':
        return 'Accept Request'
      case 'outgoing_request':
        return 'Requested'
      case 'blocked':
        return 'Unblock'
      case 'blocked_by_them':
        return 'Blocked'
      case 'none':
      default:
        return 'Add Friend'
    }
  }

  // ───────────────────── EFFECTS ─────────────────────
  useEffect(() => {
    if (!id) return
    loadProfile()
    loadInitialPosts()
    loadFriendshipStatus()
  }, [id])

  useEffect(() => {
    const loadAvatar = async () => {
      if (!profile?.avatarKey) {
        setAvatarUrl(null)
        return
      }
      try {
        const url = await urlFromKey(profile.avatarKey)
        setAvatarUrl(url)
      } catch (e) {
        console.error(e)
        setAvatarUrl(null)
      }
    }
    loadAvatar()
  }, [profile])

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
    // Only do this when posts are visible (saves work for private profiles / tagged tab)
    const showPostsGrid = canSeePosts && activeTab === 'posts'
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
  }, [visibleMediaUrls, ratioByUrl, canSeePosts, activeTab])

  // ───────────────────── RENDER HELPERS ─────────────────────
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

  const showPostsGrid = canSeePosts && activeTab === 'posts'

  // ───────────────────── TOP-LEVEL STATES ─────────────────────
  if (isProfileLoading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>Profile not found.</Text>
      </View>
    )
  }

  // ───────────────────── MAIN RENDER ─────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {profile.handle}
        </Text>
        <TouchableOpacity onPress={() => setIsOptionsModalVisible(true)}>
          <Text style={styles.topBarMenu}>⋯</Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={showPostsGrid ? posts : []}
        keyExtractor={(item: any) => item.id}
        renderItem={renderPostItem}
        // Masonry layout (v2)
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
              <Image
                source={{ uri: avatarUrl ?? AVATAR_PLACEHOLDER }}
                style={styles.avatar}
              />

              {/* Name + bio */}
              <View style={styles.bioSection}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.displayName}>{profile.displayName}</Text>
                  <Text style={{}}>@{profile.handle}</Text>
                </View>

                {profile.bio ? (
                  <Text style={styles.bioText}>{profile.bio}</Text>
                ) : null}
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profile.postsCount}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {profile.followersCount}
                  </Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>0</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>
            </View>

            {/* Action row */}
            {!isSelf && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onPressActionButton}
                >
                  <Text style={styles.actionButtonText}>
                    {renderActionButtonLabel()}
                  </Text>
                </TouchableOpacity>

                {friendshipStatus !== 'blocked_by_them' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.messageButton]}
                    onPress={handleMessage}
                  >
                    <Text style={styles.actionButtonText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isSelf && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onPressActionButton}
                >
                  <Text style={styles.actionButtonText}>
                    {renderActionButtonLabel()}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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

            {/* Visibility message */}
            {!canSeePosts && activeTab === 'posts' && !isPostsLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Only friends can see this user's posts.
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={() => {
          if (isPostsLoading || !canSeePosts || activeTab !== 'posts')
            return null
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {activeTab === 'posts'
                  ? 'No posts yet.'
                  : 'No tagged posts yet.'}
              </Text>
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

      {/* Friend dropdown (when friend) */}
      <Modal
        visible={isFriendMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFriendMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPressOut={() => setIsFriendMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleUnfriend}>
              <Text style={styles.menuItemText}>Unfriend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
              <Text style={styles.menuItemText}>Block</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReportUser}
            >
              <Text style={styles.menuItemText}>Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            <TouchableOpacity style={styles.optionsItem} onPress={handleBlock}>
              <Text style={styles.optionsItemText}>Block</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionsItem}
              onPress={handleReportUser}
            >
              <Text style={styles.optionsItemText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionsItem}
              onPress={handleCopyProfileCode}
            >
              <Text style={styles.optionsItemText}>Copy profile code</Text>
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
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
    width: 24,
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
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginRight: 24,
    backgroundColor: '#eee',
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
  bioText: {
    fontSize: 13,
    color: '#222',
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
  messageButton: { flex: 1 },
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 10 },
  menuItemText: { fontSize: 14, fontWeight: '500' },

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
