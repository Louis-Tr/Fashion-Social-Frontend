// app/(story)/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { z } from 'zod'
import { urlFromKey } from '@/services/media/urlFromKey'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store/store'
import { fetchSingleStory } from '@/services/story/fetchSingleStory'

const User = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarKey: z.string().nullable(),
})

export const StorySchema = z.object({
  id: z.string(),
  user: User,
  tags: z.array(z.string()),
  contentType: z.enum(['image/jpeg', 'video/mp4']),
  createdAt: z.string(),
  presignUrl: z.string().nullable().optional(),
  impression: z.boolean().default(false),
})

export type StoryType = z.infer<typeof StorySchema>

function toStringParam(v: string | string[] | undefined) {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0]
  return undefined
}

export default function StoryScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const dispatch = useDispatch<AppDispatch>()
  const { stories } = useSelector((state: RootState) => state.story)

  const id = toStringParam(params.id as string | string[] | undefined)
  const [currentId, setCurrentId] = useState(id)

  const [story, setStory] = useState<StoryType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const translateX = useRef(new Animated.Value(0)).current
  const isTransitioningRef = useRef(false)
  const screenWidth = Dimensions.get('window').width
  const swipeThreshold = screenWidth * 0.22

  useEffect(() => {
    if (id) setCurrentId(id)
  }, [id])

  const currentIndex = useMemo(
    () => stories.findIndex((item) => item.id === currentId),
    [stories, currentId]
  )

  const animateBackToCenter = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start()
  }

  const handleStoryShift = (direction: 1 | -1) => {
    if (isTransitioningRef.current) return

    const target = stories[currentIndex + direction]
    if (!target) {
      animateBackToCenter()
      return
    }

    isTransitioningRef.current = true
    setError(null)

    Animated.timing(translateX, {
      toValue: -direction * screenWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setStory(target)
      setCurrentId(target.id)
      router.replace({
        pathname: '/(app)/(story)/[id]',
        params: { id: target.id },
      })

      translateX.setValue(direction * screenWidth)
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        isTransitioningRef.current = false
      })
    })
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10,
        onPanResponderMove: (_, gestureState) => {
          if (isTransitioningRef.current) return
          translateX.setValue(gestureState.dx)
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isTransitioningRef.current) return
          if (gestureState.dx < -swipeThreshold) {
            handleStoryShift(1)
            return
          }

          if (gestureState.dx > swipeThreshold) {
            handleStoryShift(-1)
            return
          }

          animateBackToCenter()
        },
        onPanResponderTerminate: () => {
          if (!isTransitioningRef.current) animateBackToCenter()
        },
      }),
    [swipeThreshold, translateX, currentIndex, stories]
  )

  useEffect(() => {
    let active = true

    async function loadStory() {
      if (!currentId) {
        setError('Missing story id')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const res = await dispatch(fetchSingleStory(currentId))
        const payload = ('payload' in res ? res.payload : res) as {
          story: unknown
        }
        const parsed = StorySchema.safeParse(payload.story)

        if (!active) return

        if (!parsed.success) {
          setError('Invalid story response')
          return
        }

        setStory(parsed.data)
      } catch (err) {
        if (!active) return
        setError((err as Error).message || 'Failed to load story')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStory()

    return () => {
      active = false
    }
  }, [dispatch, currentId])

  if (loading) {
    return (
      <SafeAreaView style={styles.safeAreaBlack}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading story...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !story) {
    return (
      <SafeAreaView style={styles.safeAreaBlack}>
        <View style={styles.screen}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closePill}
              accessibilityLabel="Close story"
            >
              <Text style={styles.whiteText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.missingWrap}>
            <Text style={styles.missingText}>
              {error ?? 'Story data missing.'}
            </Text>
            {id ? <Text style={styles.missingId}>id: {id}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const avatarUrl = story.user.avatarKey
    ? urlFromKey(story.user.avatarKey)
    : null

  return (
    <SafeAreaView style={styles.safeAreaBlack}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.userRow}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image
                  source={avatarUrl}
                  style={styles.avatarImg}
                  contentFit="cover"
                />
              ) : null}
            </View>

            <View style={styles.userMeta}>
              <Text style={styles.userName}>{story.user.displayName}</Text>
              <Text style={styles.userTime}>{story.createdAt}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closePill}
            accessibilityLabel="Close story"
          >
            <Text style={styles.whiteText}>Close</Text>
          </TouchableOpacity>
        </View>

        {story.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {story.tags.map((t) => (
              <View key={t} style={styles.tagPill}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateX }] },
          ]}
          {...panResponder.panHandlers}
        >
          {story.presignUrl ? (
            <Image
              source={story.presignUrl}
              style={styles.storyMedia}
              contentFit="contain"
              cachePolicy="none"
              transition={0}
              onLoad={() => console.log('story image loaded')}
              onError={(imgError) =>
                console.log('story image error', imgError)
              }
            />
          ) : (
            <View style={styles.centerWrap}>
              <Text style={styles.missingText}>Story image unavailable.</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeAreaBlack: {
    flex: 1,
    backgroundColor: '#000',
  },

  screen: {
    flex: 1,
    backgroundColor: '#000',
  },

  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.7)',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },

  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  avatarImg: {
    width: '100%',
    height: '100%',
  },

  userMeta: {
    marginLeft: 12,
    flexShrink: 1,
  },

  userName: {
    color: '#fff',
    fontWeight: '600',
  },

  userTime: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.60)',
  },

  closePill: {
    marginLeft: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  whiteText: {
    color: '#fff',
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  tagPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },

  tagText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
  },

  content: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },

  storyMedia: {
    width: '100%',
    height: '100%',
  },

  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  missingText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.70)',
  },

  missingId: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.40)',
  },
})
