import { z } from 'zod'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { FashionTheme } from '@/constants/Theme'

export const CreateStorySchema = z.object({
  tags: z.array(z.string()),
  contentType: z.enum(['image/jpeg', 'video/mp4']),
})

export type CreateStoryType = z.infer<typeof CreateStorySchema>

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

export function StoryCircle({ story }: { story: StoryType }) {
  const router = useRouter()

  const handleStoryPress = useCallback(() => {
    router.push({
      pathname: '/(app)/(story)/[id]',
      params: { id: story.id, story: JSON.stringify(story) },
    })
  }, [router, story])

  const ringStyle = story.impression ? styles.ringSeen : styles.ringUnseen

  return (
    <TouchableOpacity
      style={styles.storyCircleTouch}
      onPress={handleStoryPress}
      activeOpacity={0.8}
    >
      {/* Outer ring */}
      <View style={[styles.outerRing, ringStyle]}>
        {/* Inner white buffer ring */}
        <View style={styles.innerBuffer}>
          {/* Avatar / thumbnail */}
          <Image
            source={{ uri: story.presignUrl }} // ideally thumbnail
            style={styles.avatar}
            resizeMode="cover"
          />
        </View>
      </View>

      <Text numberOfLines={1} style={styles.storyName}>
        {story.user.displayName}
      </Text>
    </TouchableOpacity>
  )
}

type StoryBarProps = {
  stories: StoryType[]
}

export default function StoryBar({ stories }: StoryBarProps) {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Create Story circle */}
        <TouchableOpacity
          style={styles.createTouch}
          onPress={() => router.push('/(story)/create')}
          activeOpacity={0.8}
        >
          <View style={styles.createOuter}>
            <View style={styles.createInner}>
              <Text style={styles.createPlus}>+</Text>
            </View>
          </View>

          <Text numberOfLines={1} style={styles.createLabel}>
            Your story
          </Text>
        </TouchableOpacity>

        {/* Story circles */}
        {stories.map((story) => (
          <View key={story.id} style={styles.storyItemWrap}>
            <StoryCircle story={story} />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const OUTER_SIZE = 72
const BUFFER_SIZE = 64
const AVATAR_SIZE = 56

const styles = StyleSheet.create({
  container: {
    height: 112, // h-28
    marginBottom: FashionTheme.spacing.sm,
  },

  scrollContent: {
    paddingHorizontal: FashionTheme.spacing.sm,
    paddingVertical: 8, // py-2
    alignItems: 'center',
  },

  // StoryCircle
  storyCircleTouch: {
    marginHorizontal: 8, // mx-2
    alignItems: 'center',
  },

  outerRing: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringSeen: {
    borderColor: FashionTheme.colors.borderStrong,
  },

  ringUnseen: {
    borderColor: FashionTheme.colors.surfaceStrong,
  },

  innerBuffer: {
    width: BUFFER_SIZE,
    height: BUFFER_SIZE,
    borderRadius: BUFFER_SIZE / 2,
    backgroundColor: FashionTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },

  storyName: {
    marginTop: 4, // mt-1
    width: 64, // w-16
    textAlign: 'center',
    fontSize: 12, // text-xs
    color: FashionTheme.colors.textPrimary,
  },

  // Create story
  createTouch: {
    marginRight: 12, // mr-3
    alignItems: 'center',
  },

  createOuter: {
    width: OUTER_SIZE, // close to w-18/h-18 intent
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    borderWidth: 2,
    borderColor: FashionTheme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createInner: {
    width: BUFFER_SIZE, // h-16 w-16
    height: BUFFER_SIZE,
    borderRadius: BUFFER_SIZE / 2,
    backgroundColor: FashionTheme.colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createPlus: {
    fontSize: 30, // text-3xl-ish
    lineHeight: 30, // leading-none
    color: FashionTheme.colors.inverseText,
  },

  createLabel: {
    marginTop: 4,
    width: 64,
    textAlign: 'center',
    fontSize: 12,
    color: FashionTheme.colors.textPrimary,
  },

  storyItemWrap: {
    marginRight: 12, // mr-3
  },
})
