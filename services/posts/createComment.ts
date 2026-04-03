import { CreateCommentRequest } from '@/types/schemas/comment'
import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'
import { Comment } from '@/types/comment'

async function createComment(
  postId: string,
  content: string,
  parentId?: string
): Promise<{ ok: boolean; comment: Comment }> {
  const token = getToken()
  const body = { content, parentId }
  const res = await fetch(`${BASE_URL}/post/${postId}/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key':
        crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default createComment
