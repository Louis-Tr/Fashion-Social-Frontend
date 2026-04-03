import { z } from 'zod'
import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'

// Schema (unchanged)
export const FetchUserPostResSchema = z.array(
  z.object({
    id: z.string(),
    mediaUrl: z.string(),
  })
)
export type FetchUserPostRes = z.infer<typeof FetchUserPostResSchema>

export async function fetchUserPostsList(
  userId: string,
  limit?: number,
  offset?: number
): Promise<FetchUserPostRes> {
  const token = getToken()
  if (!token) throw new Error('Missing access token')

  const query = new URLSearchParams()
  if (typeof limit === 'number') query.set('limit', String(limit))
  if (typeof offset === 'number') query.set('offset', String(offset))

  const url = query.toString()
    ? `${BASE_URL}/user/${userId}/posts?${query.toString()}`
    : `${BASE_URL}/user/${userId}/posts`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(
      `Failed to load posts (${res.status}): ${
        typeof body === 'string' ? body : JSON.stringify(body)
      }`
    )
  }

  // ✅ Return parsed response body only
  return FetchUserPostResSchema.parse(body)
}
