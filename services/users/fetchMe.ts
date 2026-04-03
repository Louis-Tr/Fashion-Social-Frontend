// src/services/user/fetchProfile.ts
import { z } from 'zod'
import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'
import { AppDispatch, RootState } from '@/store/store'
import { setMe } from '@/store/slices/meSlice'

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

export const fetchMe =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    const { token } = getState().auth

    try {
      const res = await fetch(`${BASE_URL}/user/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to load me profile (${res.status}): ${text}`)
      }

      const data = await res.json()
      const parsed = UserProfileSchema.parse(data)

      dispatch(setMe(parsed))
    } catch (err) {
      console.error('[Me] Fetch error:', (err as any).message)
      throw err
    }
  }
