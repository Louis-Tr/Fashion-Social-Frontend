import { API_BASE_URL } from '@/constants/Url'
import { getToken } from '@/utils/token'
import type { GetCommentResponse } from '@/types/schemas/comment'

export async function fetchComment(
  postId: string,
  limit: number = 10,
  cursor?: string
): Promise<GetCommentResponse> {
  const token = getToken()

  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(
    `${API_BASE_URL}/post/${postId}/comment?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await res.json()

  if (!res.ok) throw new Error(data.message || 'Failed to fetch comments')

  return data
}

export async function fetchCommentReplies(
  postId: string,
  commentId: string,
  limit: number = 10,
  cursor?: string
): Promise<GetCommentResponse> {
  const token = getToken()

  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(
    `${API_BASE_URL}/post/${postId}/comment/${commentId}/reply?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await res.json()

  if (!res.ok) throw new Error(data.message || 'Failed to fetch replies')

  return data
}
