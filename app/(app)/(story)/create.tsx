// app/(story)/create.tsx

import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'

import { createStory } from '@/services/story/createStory'
// If you have a StoryInput type, import it instead of `any` below.

type StoryVisibility = 'PUBLIC' | 'PRIVATE'
type StoryContentType = 'IMAGE' | 'VIDEO'

export default function CreateStoryScreen() {
  const router = useRouter()

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visibility, setVisibility] = useState<StoryVisibility>('PUBLIC')
  const [tagInput, setTagInput] = useState('') // "tag1, tag2"

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your gallery.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAsset(result.assets[0])
    }
  }

  const parseTags = (input: string): string[] =>
    input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

  const handleSubmit = async () => {
    if (!asset) {
      Alert.alert('No media', 'Please select a photo or video first.')
      return
    }

    setIsSubmitting(true)
    try {
      const isVideo =
        asset.type === 'video' ||
        asset.mimeType?.startsWith('video/') ||
        asset.uri.toLowerCase().endsWith('.mp4')

      const contentType = isVideo ? 'video/mp4' : 'image/jpeg'
      const tags = parseTags(tagInput)

      await createStory({
        file: asset,
        contentType, // << MIME type
        visibility,
        tags,
      } as any)

      Alert.alert('Success', 'Story created.')
      router.back()
    } catch (err: any) {
      console.error('Create story failed', err)
      Alert.alert('Error', err?.message ?? 'Failed to create story')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = !!asset && !isSubmitting

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Story</Text>

      {/* Media picker */}
      <TouchableOpacity style={styles.mediaBox} onPress={handlePickMedia}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={styles.preview} />
        ) : (
          <Text style={styles.mediaPlaceholder}>
            Tap to select photo or video
          </Text>
        )}
      </TouchableOpacity>

      {/* Tags input */}
      <View style={styles.section}>
        <Text style={styles.label}>Tags</Text>
        <TextInput
          style={styles.input}
          placeholder="tag1, tag2, tag3"
          placeholderTextColor="#666"
          value={tagInput}
          onChangeText={setTagInput}
          autoCapitalize="none"
        />
        <Text style={styles.helperText}>
          Separate tags with commas. Example: food, travel, cat
        </Text>
      </View>

      {/* Visibility selector */}
      <View style={styles.section}>
        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityRow}>
          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'PUBLIC' && styles.visibilityButtonActive,
            ]}
            onPress={() => setVisibility('PUBLIC')}
          >
            <Text
              style={[
                styles.visibilityText,
                visibility === 'PUBLIC' && styles.visibilityTextActive,
              ]}
            >
              Public
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'PRIVATE' && styles.visibilityButtonActive,
            ]}
            onPress={() => setVisibility('PRIVATE')}
          >
            <Text
              style={[
                styles.visibilityText,
                visibility === 'PRIVATE' && styles.visibilityTextActive,
              ]}
            >
              Private
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.buttonText}>Post Story</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  mediaBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  mediaPlaceholder: {
    color: '#aaa',
    fontSize: 16,
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  section: {
    marginBottom: 12,
  },
  label: {
    color: '#fff',
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#fff',
  },
  helperText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  visibilityButtonActive: {
    backgroundColor: '#1e90ff22',
    borderColor: '#1e90ff',
  },
  visibilityText: {
    color: '#ccc',
    fontWeight: '500',
  },
  visibilityTextActive: {
    color: '#fff',
  },
  footer: {
    paddingTop: 12,
  },
  button: {
    backgroundColor: '#1e90ff',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
})
