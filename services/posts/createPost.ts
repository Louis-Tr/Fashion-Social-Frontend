// src/services/createPost.ts
import { z } from 'zod'
import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'
import { uploadToS3 } from '@/services/media'

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
  // IMPORTANT: per your requirement, "items" is attached item IDs (NOT media URIs)
  items: z.array(z.string()).optional(),
})

export const CreatePostReq = z.object({
  caption: z.string().max(2200).optional(),
  visibility: Visibility.default('public'),
  medias: z.array(PostMedia).optional(),
})

// What the UI calls:
export type CreatePostInput = {
  caption?: string
  visibility?: 'public' | 'followers' | 'private'
  // [{ [mediaUri]: AttachItemProps[] }, ...]
  medias: Record<string, AttachItemProps[]>[]
}

// --- internal helpers ---
function inferMimeFromExt(uri: string): Allowed | null {
  const p = uri.toLowerCase()
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.mp4')) return 'video/mp4'
  return null
}

function makeIdempotencyKey(): string {
  // RN may or may not have crypto.randomUUID()
  const c: any = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now()}-${Math.random()}`
}

/**
 * Flattens:
 *   [{ uriA: [a1,a2] }, { uriB: [] }]
 * into:
 *   [{ uri: uriA, attached: [...]}, { uri: uriB, attached: [] }]
 */
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

// --- service ---
export async function createPost(input: CreatePostInput) {
  const token = getToken()

  const flat = flattenInputMedias(input.medias).slice(0, 10) // backend max 10 media entries
  if (flat.length === 0) {
    throw new Error('No media provided.')
  }

  // Build CreatePostReq.medias: one PostMedia per mediaUri
  const medias = flat.map(({ uri, attached }) => {
    const mime = inferMimeFromExt(uri)
    if (!mime) {
      throw new Error(
        `Unsupported media. Only JPG/PNG/WEBP images or MP4 video are allowed. Got: ${uri}`
      )
    }

    // items = attached item IDs for this media
    const itemIds = attached
      .map((x) => x?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    console.log(mime, itemIds)

    return {
      mediaMimeTypes: mime,
      ...(itemIds.length ? { items: itemIds } : {}),
    }
  })

  const payload = {
    caption: input.caption ?? undefined,
    visibility: input.visibility ?? 'public',
    medias,
  }

  // Zod validation against CreatePostReq
  const parsed = CreatePostReq.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid create post payload: ${msg}`)
  }

  const res = await fetch(`${BASE_URL}/post`, {
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
  for (const t of data.uploadTargets) {
    const file = flat[t.index].uri

    try {
      await uploadToS3(t.presignedUrl, file)
    } catch (err) {
      throw new Error(`Failed to upload media at index ${t.index}: ${err}`)
    }
  }
}
