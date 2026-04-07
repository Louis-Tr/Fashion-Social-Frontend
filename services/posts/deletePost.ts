import { getToken } from '@/utils/token'
import { API_BASE_URL } from '@/constants/Url'

export async function deletePost(postId: string): Promise<void> {
  const token = getToken()

  const res = await fetch(`${API_BASE_URL}/post/${postId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    // try to read server message (may be empty)
    const text = await res.text().catch(() => '')
    const err = new Error(
      `Delete post failed (${res.status}): ${text || res.statusText}`
    )
    ;(err as any).status = res.status
    throw err
  }
}
