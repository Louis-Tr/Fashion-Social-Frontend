import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react-native'
import { ItemSchema, Post, MediaSchema } from '@/types/schemas/post'
import { urlFromKey } from '@/services/media/urlFromKey'
import { reactToPost } from '@/services/posts/reaction'
import { z } from 'zod'
import { Image } from 'expo-image'
import { getUser } from '@/utils/getUser'
import { deletePost } from '@/services/posts/deletePost'
import { FashionTheme } from '@/constants/Theme'

const { width } = Dimensions.get('window')
const ITEM_ROW_H = 64

type Item = z.infer<typeof ItemSchema>
type Media = z.infer<typeof MediaSchema>

function ItemCard({ item }: { item: Item }) {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: './(app)/(item)/[id]',
          params: { id: item.id },
        })
      }
      style={styles.itemCard}
    >
      {item.mediaUrl ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.itemCardIcon} />
      ) : (
        <View style={styles.itemCardIcon} />
      )}
      <Text>{item.name}</Text>
    </TouchableOpacity>
  )
}

type Visibility = 'public' | 'followers' | 'private'

function OptionsSheet(props: {
  visible: boolean
  isOwner: boolean
  visibility: Visibility
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void> | void
  onChangeVisibility: (v: Visibility) => Promise<void> | void
}) {
  const {
    visible,
    isOwner,
    visibility,
    onClose,
    onEdit,
    onDelete,
    onChangeVisibility,
  } = props

  const slide = useMemo(() => new Animated.Value(0), [])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.timing(slide, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    } else if (mounted) {
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false)
      })
    }
  }, [visible, mounted, slide])

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [320, 0],
  })

  if (!mounted) return null

  const VisibilityLabel: Record<Visibility, string> = {
    public: 'Public',
    followers: 'Followers',
    private: 'Private',
  }

  const otherVisibilities = (
    ['public', 'followers', 'private'] as Visibility[]
  ).filter((v) => v !== visibility)

  const confirmDelete = () => {
    Alert.alert(
      'Delete post?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await onDelete()
            onClose()
          },
        },
      ],
      { cancelable: true }
    )
  }

  const notSupported = () => Alert.alert('Not supported yet')

  const Item = ({
    label,
    destructive,
    onPress,
    disabled,
  }: {
    label: string
    destructive?: boolean
    disabled?: boolean
    onPress: () => void
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[sheetStyles.item, disabled && sheetStyles.itemDisabled]}
      hitSlop={10}
    >
      <Text
        style={[
          sheetStyles.itemText,
          destructive && sheetStyles.itemTextDestructive,
          disabled && sheetStyles.itemTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={sheetStyles.kbWrap}
      >
        <Animated.View
          style={[sheetStyles.sheet, { transform: [{ translateY }] }]}
        >
          <View style={sheetStyles.grabber} />

          {/* Owner-only actions */}
          {isOwner ? (
            <>
              <Item
                label="Edit post"
                onPress={() => {
                  onClose()
                  onEdit()
                }}
              />
              <Item label="Delete post" destructive onPress={confirmDelete} />
              <View style={sheetStyles.divider} />
              {/* Visibility group */}
              <Text style={sheetStyles.sectionTitle}>
                Visibility: {VisibilityLabel[visibility]}
              </Text>

              {otherVisibilities.map((v) => (
                <Item
                  key={v}
                  label={`Make ${VisibilityLabel[v]}`}
                  onPress={async () => {
                    await onChangeVisibility(v)
                    onClose()
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <Item
                label="Hide post"
                onPress={() => {
                  onClose()
                  notSupported()
                }}
              />
              <Item
                label="Report post"
                destructive
                onPress={() => {
                  onClose()
                  notSupported()
                }}
              />
              <View style={sheetStyles.divider} />
            </>
          )}

          <View style={sheetStyles.divider} />
          <Item label="Cancel" onPress={onClose} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  kbWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d4d4d8',
    alignSelf: 'center',
    marginBottom: 10,
  },
  item: {
    paddingVertical: 12,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  itemTextDestructive: {
    color: '#dc2626',
  },
  itemTextDisabled: {
    color: '#6b7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})

function PostItem(props: Post & { setFocusPost: () => void }) {
  const {
    id,
    userInfo,
    caption,
    isReacted,
    reactionsCount,
    medias,
    created_at,
    setFocusPost,
  } = props

  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(isReacted)
  const [likes, setLikes] = useState(reactionsCount)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [localVisibility, setLocalVisibility] = useState(props.visibility) // <-- from Post type
  useEffect(() => setLocalVisibility(props.visibility), [props.visibility])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    async function loadUser() {
      try {
        const user = getUser()
        if (alive) {
          setCurrentUserId(user?.sub ?? null)
        }
      } catch {
        if (alive) setCurrentUserId(null)
      }
    }

    loadUser()

    return () => {
      alive = false
    }
  }, [])

  const isOwner = currentUserId === userInfo.userId

  useEffect(() => setIsLiked(isReacted), [isReacted])
  useEffect(() => setLikes(reactionsCount), [reactionsCount])

  const toggleLike = async () => {
    try {
      const res = await reactToPost(id)
      if (res.ok === true) {
        setIsLiked(true)
        setLikes((n) => n + 1)
      } else if (res.ok === false) {
        setIsLiked(false)
        setLikes((n) => Math.max(0, n - 1))
      }
    } catch (err) {
      console.error('Failed to react:', err)
    }
  }

  useEffect(() => {
    let alive = true
    async function loadAvatar() {
      const key = userInfo.avatarKey
      if (!key) {
        if (alive) setAvatarUrl(null)
        return
      }
      try {
        const url = await urlFromKey(key)
        if (alive) setAvatarUrl(url)
      } catch {
        if (alive) setAvatarUrl(null)
      }
    }
    loadAvatar()
    return () => {
      alive = false
    }
  }, [userInfo.avatarKey])

  const handleOpenProfile = () => {
    router.push({
      pathname: '/(app)/(user)/[id]',
      params: { id: userInfo.userId, userInfo: JSON.stringify(userInfo) },
    })
  }

  const safeMedias: Media[] = useMemo(() => medias ?? [], [medias])

  return (
    <View style={styles.postWrap}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.profilePress}
          onPress={handleOpenProfile}
        >
          {avatarUrl ? (
            <Image
              source={avatarUrl ?? undefined}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.avatarFallback} />
          )}

          <View>
            <Text style={styles.displayName}>{userInfo.displayName}</Text>
            <Text style={styles.handle}>@{userInfo.handle}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMoreOpen(true)}
          style={styles.moreBtn}
          hitSlop={10}
        >
          <View style={styles.moreDot} />
          <View style={styles.moreDot} />
          <View style={styles.moreDot} />
        </TouchableOpacity>
      </View>

      {/* Media carousel */}
      <FlatList
        data={safeMedias}
        keyExtractor={(m) => m.mediaId}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width, height: width + ITEM_ROW_H }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width)
          setActiveIndex(index)
        }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => {
          const attached: Item[] = Array.isArray(item.items) ? item.items : []

          return (
            <View style={{ width, height: width + ITEM_ROW_H }}>
              <View style={styles.mediaBox}>
                <Image
                  source={item.mediaUrl}
                  style={styles.media}
                  contentFit="contain"
                  transition={150}
                  cachePolicy="disk"
                />
              </View>

              {attached.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.itemsRow}
                >
                  {attached.map((it, idx) => (
                    <ItemCard key={`${it.id}-${idx}`} item={it} />
                  ))}
                </ScrollView>
              )}
            </View>
          )
        }}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {safeMedias.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Footer icons */}
      <View style={styles.iconRow}>
        <View style={styles.leftIcons}>
          <TouchableOpacity onPress={toggleLike}>
            <Heart
              size={24}
              color={isLiked ? 'red' : 'black'}
              fill={isLiked ? 'red' : 'none'}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={setFocusPost}>
            <MessageCircle size={24} />
          </TouchableOpacity>

          <TouchableOpacity>
            <Send size={24} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity>
          <Bookmark size={24} />
        </TouchableOpacity>
      </View>

      {/* Likes & caption */}
      <Text style={styles.likesText}>{likes} likes</Text>

      {caption ? (
        <Text style={styles.caption}>
          <Text style={styles.captionName}>{userInfo.displayName} </Text>
          {caption}
        </Text>
      ) : null}

      <Text style={styles.timeText}>
        {new Date(created_at).toLocaleString()}
      </Text>

      <OptionsSheet
        visible={moreOpen}
        isOwner={isOwner}
        visibility={localVisibility}
        onClose={() => setMoreOpen(false)}
        onEdit={() => {
          Alert.alert(
            'Edit post?',
            'This is not supported yet. Please delete and re-create the post.',
            [{ text: 'Cancel', style: 'cancel' }],
            { cancelable: true }
          )
        }}
        onDelete={async () => {
          try {
            await deletePost(id)

            // If you're on a post detail page:
            router.replace('/(tabs)/home')

            // Or if you're in a list and just need to refresh:
            // refetchPosts()
          } catch (error: any) {
            console.error('Delete failed:', error)

            Alert.alert(
              'Delete Failed',
              error?.message ?? 'Something went wrong while deleting this post.'
            )
          }
        }}
        onChangeVisibility={async (v) => {
          setLocalVisibility(v)

          try {
            // await updatePost(id, { visibility: v })
          } catch {
            setLocalVisibility(props.visibility)
          }
        }}
      />
    </View>
  )
}

export default React.memo(PostItem)

const styles = StyleSheet.create({
  postWrap: {
    width: '100%',
    paddingBottom: FashionTheme.spacing.lg,
    backgroundColor: FashionTheme.colors.background,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: FashionTheme.spacing.lg,
    marginBottom: FashionTheme.spacing.sm,
    justifyContent: 'space-between',
  },
  profilePress: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },

  avatar: { width: 40, height: 40, borderRadius: 999 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: FashionTheme.colors.surface,
  },

  displayName: { fontSize: 14, fontWeight: '600', color: FashionTheme.colors.textPrimary },
  handle: { fontSize: 12, color: FashionTheme.colors.textMuted },

  moreBtn: {
    flexDirection: 'row',
    width: 32,
    height: 32,
    alignItems: 'center',
    gap: 2,
  },
  moreDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: FashionTheme.colors.surfaceStrong,
    marginVertical: 1.5,
  },
  mediaBox: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: { width: '98%', height: '98%', borderRadius: FashionTheme.radius.lg },

  itemsRow: {
    paddingHorizontal: FashionTheme.spacing.lg,
    paddingTop: FashionTheme.spacing.sm,
    columnGap: FashionTheme.spacing.sm,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 999, marginHorizontal: 2 },
  dotActive: { backgroundColor: FashionTheme.colors.surfaceStrong, opacity: 1 },
  dotInactive: { backgroundColor: FashionTheme.colors.surfaceStrong, opacity: 0.3 },

  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: FashionTheme.spacing.lg,
    paddingVertical: FashionTheme.spacing.sm,
  },
  leftIcons: { flexDirection: 'row', columnGap: 16 },

  likesText: { paddingHorizontal: FashionTheme.spacing.lg, fontWeight: '600' },
  caption: { paddingHorizontal: FashionTheme.spacing.lg, marginTop: 2 },
  captionName: { fontWeight: '600' },

  timeText: {
    marginTop: 4,
    paddingHorizontal: FashionTheme.spacing.lg,
    fontSize: 12,
    color: FashionTheme.colors.textMuted,
    textTransform: 'uppercase',
  },

  itemCard: {
    padding: 10,
    backgroundColor: FashionTheme.colors.surface,
    borderRadius: 20,
  },
  itemCardIcon: { width: 24, height: 24 },
})
