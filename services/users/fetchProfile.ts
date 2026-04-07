// src/services/user/fetchProfile.ts
import { z } from 'zod'
import { getToken } from '@/utils/token'
import { API_BASE_URL } from '@/constants/Url'

// ⬇️ Must match backend UserProfileRes shape EXACTLY
export const UserProfileSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarKey: z.string().nullable(),
  bio: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
  followersCount: z.number().nonnegative(),
  followingCount: z.number().nonnegative(),
  postsCount: z.number().nonnegative(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

export async function fetchProfile(userId: string): Promise<UserProfile> {
  const token = await getToken() // ⬅️ Your utility to get access token
  if (!token) {
    throw new Error('Missing access token')
  }

  const res = await fetch(`${API_BASE_URL}/user/${userId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to load profile (${res.status}): ${text}`)
  }

  const json = await res.json()

  // Validate with Zod to ensure strict consistency
  return UserProfileSchema.parse(json)
}
