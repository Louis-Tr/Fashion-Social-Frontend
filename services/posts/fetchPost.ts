import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'
import { z } from 'zod'
import { PostSchema, Post } from '@/types/schemas/post'

export type PostWithMediaRow = {
  id: string
  userInfo: {
    userId: string
    displayName: string
    handle: string
    avatarKey: string | null
  }
  caption: string | null
  isReacted: boolean
  reactionsCount: number
  commentsCount: number
  visibility: 'public' | 'followers' | 'private'
  created_at: string
  updated_at: string

  medias: Array<{
    mediaId: string
    mediaUrl: string
    index: number
    items: { id: string; name: string; mediaUrl: string | null }[]
  }>
}

export async function fetchPost(id: string): Promise<Post> {
  const token = await getToken()
  if (!token) throw new Error('Missing access token')

  const url = `${BASE_URL}/post/${id}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const body = await res.json().catch(() => null)
  console.log(body as Post)

  if (!body) {
    throw new Error(
      `Failed to load post here (${res.status}): ${
        typeof body === 'string' ? body : JSON.stringify(body)
      }`
    )
  }

  // ✅ Validate shape at runtime
  console.log(PostSchema.parse(body))
  return PostSchema.parse(body)
}
