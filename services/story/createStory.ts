import { API_BASE_URL } from '@/constants/Url'
import { getToken } from '@/utils/token'
import { z } from 'zod'
import { ImagePickerAsset } from 'expo-image-picker'
import { prepareFileForUpload, uploadToS3 } from '@/services/story/helpers'

const url = API_BASE_URL + '/story'

export const CreateStorySchema = z.object({
  tags: z.array(z.string()),
  contentType: z.enum(['image/jpeg', 'video/mp4']),
})

export type CreateStoryType = z.infer<typeof CreateStorySchema>

type StoryInput = CreateStoryType & { file: ImagePickerAsset }

function getIdempotencyKey() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export async function createStory(input: StoryInput) {
  const token = getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const { file, ...metadata } = input
  const processedFile = await prepareFileForUpload(file)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': getIdempotencyKey(),
    },
    body: JSON.stringify(metadata),
  })

  // Try to parse JSON once (no double-reading body)
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      res.statusText ||
      'Unknown error'
    throw new Error(`Story creation failed (${res.status}): ${message}`)
  }

  const uploadUrl = data?.uploadUrl
  if (!uploadUrl) {
    throw new Error('Story created but uploadUrl is missing from response')
  }

  try {
    await uploadToS3(uploadUrl, processedFile)
  } catch (err) {
    console.error('Failed to upload story to S3', err)
    // optional: rethrow or report to backend
  }

  return data
}
