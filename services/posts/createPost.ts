// src/services/createPost.ts
import { z } from 'zod'
import { getToken } from '@/utils/token'
import { API_BASE_URL } from '@/constants/Url'
import { uploadToS3 } from '@/services/media'
import * as ImageManipulator from 'expo-image-manipulator'

// ==============================
// 🧩 TYPES
// ==============================
type AttachItemProps = {
  id: string
  name: string
  brand: string | null
  color: string | null
  size: string | null
  material: string | null
  season: string | null
  notes: string | null
  visibility: boolean
  presignedUrls: string[] | null
  createdAt: string
  updatedAt: string
}

export const Visibility = z.enum(['public', 'followers', 'private'])

const AllowedMime = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
])
export type Allowed = z.infer<typeof AllowedMime>

export const PostMedia = z.object({
  mediaMimeTypes: AllowedMime,
  items: z.array(z.string()).optional(),
})

export const CreatePostReq = z.object({
  caption: z.string().max(2200).optional(),
  visibility: Visibility.default('public'),
  medias: z.array(PostMedia).optional(),
})

export type CreatePostInput = {
  caption?: string
  visibility?: 'public' | 'followers' | 'private'
  medias: Record<string, AttachItemProps[]>[]
}

// ==============================
// 🔧 HELPERS
// ==============================
function inferMimeFromExt(uri: string): Allowed | null {
  const p = uri.toLowerCase()
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.mp4')) return 'video/mp4'
  return null
}

function makeIdempotencyKey(): string {
  const c: any = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now()}-${Math.random()}`
}

function flattenInputMedias(
  medias: CreatePostInput['medias']
): Array<{ uri: string; attached: AttachItemProps[] }> {
  const out: Array<{ uri: string; attached: AttachItemProps[] }> = []

  for (const rec of medias ?? []) {
    if (!rec || typeof rec !== 'object') continue

    for (const [uri, attached] of Object.entries(rec)) {
      if (!uri || typeof uri !== 'string') continue

      out.push({
        uri,
        attached: Array.isArray(attached) ? attached : [],
      })
    }
  }

  return out
}

// ==============================
// 🖼️ NORMALIZE IMAGE (HEIC → JPG)
// ==============================
async function normalizeImage(uri: string): Promise<string> {
  const lower = uri.toLowerCase()

  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    )

    return result.uri
  }

  return uri
}

// ==============================
// 🚀 MAIN SERVICE
// ==============================
export async function createPost(input: CreatePostInput) {
  const token = getToken()

  const flat = flattenInputMedias(input.medias).slice(0, 10)

  if (flat.length === 0) {
    throw new Error('No media provided.')
  }

  // 🔥 Normalize + build payload (async-safe)
  const processed = await Promise.all(
    flat.map(async ({ uri, attached }) => {
      const normalizedUri = await normalizeImage(uri)

      const mime = inferMimeFromExt(normalizedUri)
      if (!mime) {
        throw new Error(
          `Unsupported media. Only JPG/PNG/WEBP images or MP4 video are allowed. Got: ${uri}`
        )
      }

      const itemIds = attached
        .map((x) => x?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      return {
        mediaMimeTypes: mime,
        ...(itemIds.length ? { items: itemIds } : {}),
        __uri: normalizedUri, // 👈 used later for upload
      }
    })
  )

  const payload = {
    caption: input.caption ?? undefined,
    visibility: input.visibility ?? 'public',
    medias: processed.map(({ __uri, ...rest }) => rest),
  }

  // ✅ Validate
  const parsed = CreatePostReq.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid create post payload: ${msg}`)
  }

  // ==============================
  // 📡 CREATE POST
  // ==============================
  const res = await fetch(`${API_BASE_URL}/post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': makeIdempotencyKey(),
    },
    body: JSON.stringify(parsed.data),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `POST /post/create failed (${res.status}): ${text || res.statusText}`
    )
  }

  const data = await res.json()

  // ==============================
  // ☁️ UPLOAD TO S3
  // ==============================
  for (const t of data.uploadTargets) {
    const file = processed[t.index].__uri

    try {
      await uploadToS3(t.presignedUrl, file)
    } catch (err) {
      throw new Error(
        `Failed to upload media at index ${t.index}: ${err}`
      )
    }
  }

  return data
}
