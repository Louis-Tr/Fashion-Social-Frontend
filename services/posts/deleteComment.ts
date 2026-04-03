import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'
import { Comment } from '@/types/comment'

async function deleteComment(
  postId: string,
  commentId: string
): Promise<{ ok: boolean; comment: Comment }> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}/post/${postId}/comment/${commentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key':
        crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    },
  })
  return res.json()
}

export default deleteComment
