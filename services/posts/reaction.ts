import { getToken } from '@/utils/token'
import { API_BASE_URL } from '@/constants/Url'

export async function reactToPost(postId: string) {
  const token = getToken()

  const res = await fetch(`${API_BASE_URL}/post/${postId}/reaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key':
        crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    },
  })

  const data = await res.json()

  if (!res.ok) throw new Error(data.message || 'Failed to react')

  return data
}

export async function toggleCommentReaction(
  postId: string,
  commentId: string
): Promise<{ ok: boolean; isLiked?: boolean }> {
  const token = getToken()

  const res = await fetch(
    `${API_BASE_URL}/post/${postId}/comment/${commentId}/reaction`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key':
          crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      },
    }
  )

  const data = await res.json()

  if (!res.ok) throw new Error(data.message || 'Failed to toggle reaction')

  return data
}
