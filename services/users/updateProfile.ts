import { API_BASE_URL } from '@/constants/Url'
import { UserProfileSchema, UserProfile } from '@/store/slices/meSlice'

export type UpdateProfilePayload = {
  displayName: string
  handle: string
  bio?: string
  isPrivate: boolean
}

export async function updateMyProfile(
  token: string,
  payload: UpdateProfilePayload
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/user/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to update profile (${res.status}): ${text}`)
  }

  const data = await res.json()
  return UserProfileSchema.parse(data)
}
