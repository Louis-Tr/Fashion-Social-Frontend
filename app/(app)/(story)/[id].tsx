// app/(story)/[id].tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Video, ResizeMode } from 'expo-av'
import { z } from 'zod'
import { InteractionManager } from 'react-native'
import { urlFromKey } from '@/services/media/urlFromKey'

// ===== Schema / Types (as provided) =====
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
  presignUrl: z.string(),
  impression: z.boolean().default(false),
})

export type StoryType = z.infer<typeof StorySchema>

function toStringParam(v: string | string[] | undefined) {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0]
  return undefined
}

/**
 * IMPORTANT FOR SHARED TRANSITION:
 * - This screen MUST render the shared element on first paint (no loader gate).
 * - For video, we animate a poster image (shared element), then mount <Video/> after interactions.
 */
export default function StoryScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()

  const id = toStringParam(params.id as any)
  const storyParam = toStringParam(params.story as any)

  const story = useMemo<StoryType | null>(() => {
    if (!storyParam) return null
    try {
      const raw = JSON.parse(storyParam)
      const res = StorySchema.safeParse(raw)
      return res.success ? res.data : null
    } catch {
      return null
    }
  }, [storyParam])

  // Mount heavy video AFTER shared transition finishes
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    if (!story) return
    if (story.contentType !== 'video/mp4') return

    const task = InteractionManager.runAfterInteractions(() => {
      setShowVideo(true)
    })

    return () => task.cancel()
  }, [story])

  // If opened via deep-link without story param, render a black shell
  if (!story) {
    return (
      <SafeAreaView style={styles.safeAreaBlack}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closePill}
          >
            <Text style={styles.whiteText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>
            Story data missing. Open from the story bar (passing params), or
            implement fetch-by-id for deep links.
          </Text>
          {id ? <Text style={styles.missingId}>id: {id}</Text> : null}
        </View>
      </SafeAreaView>
    )
  }

  const avatarUrl = story.user.avatarKey
    ? urlFromKey(story.user.avatarKey)
    : null

  return (
    <SafeAreaView style={styles.safeAreaBlack}>
      {/* Tap anywhere to close (optional). Remove if you want tap-to-advance later. */}
      <Pressable style={styles.pressableFill} onPress={() => router.back()}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.userRow}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
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

        {/* Tags */}
        {story.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {story.tags.map((t) => (
              <View key={t} style={styles.tagPill}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Content */}
        <View style={styles.content}>
          {/* Shared element MUST always exist on first render */}
          <Image
            source={{ uri: story.presignUrl }} // ideally poster thumbnail for video
            style={styles.storyMedia}
            resizeMode="contain"
          />

          {/* If it's video, mount video on top AFTER transition */}
          {story.contentType === 'video/mp4' && showVideo ? (
            <View style={styles.videoOverlay} pointerEvents="none">
              <Video
                source={{ uri: story.presignUrl }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls={false}
                shouldPlay
                isLooping
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeAreaBlack: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pressableFill: {
    flex: 1,
  },

  // Tailwind: flex-row items-center justify-between px-4 pb-3 pt-2
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Tailwind: h-10 w-10 overflow-hidden rounded-full bg-white/10
  avatarWrap: {
    height: 40,
    width: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  avatarImg: {
    height: '100%',
    width: '100%',
  },

  // Tailwind: ml-3
  userMeta: {
    marginLeft: 12,
  },

  // Tailwind: font-semibold text-white
  userName: {
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Tailwind: text-xs text-white/60
  userTime: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.60)',
  },

  // Tailwind: rounded-xl bg-white/10 px-3 py-2
  closePill: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whiteText: {
    color: '#FFFFFF',
  },

  // Tailwind: flex-row flex-wrap gap-2 px-4 pb-3
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    // RN doesn't support "gap" reliably everywhere; use margins on pills instead.
  },
  // Tailwind: rounded-full bg-white/10 px-3 py-1
  tagPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  // Tailwind: text-xs text-white/80
  tagText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
  },

  // Tailwind: flex-1 items-center justify-center
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyMedia: {
    width: '100%',
    height: '100%',
  },

  videoOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },

  // Missing story shell
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
