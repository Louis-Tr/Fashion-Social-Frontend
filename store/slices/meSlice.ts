// src/store/slices/meSlice.ts
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchMe } from '@/services/users/fetchMe'
import { z } from 'zod'
import { BASE_URL } from '@/constants/Url'
import { StoryType } from '@/components/StoryBar'
import { RootState } from '@/store/store'

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

type MeState = {
  me: UserProfile | null
  stories: StoryType[] | null
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error?: string
}

const initialState: MeState = { me: null, stories: null, status: 'idle' }

export const loadMe = createAsyncThunk<UserProfile, void, { state: RootState }>(
  'me/load',
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth
    try {
      const res = await fetch(`${BASE_URL}/user/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      return UserProfileSchema.parse(data)
    } catch (e: any) {
      return rejectWithValue(e.message ?? 'Failed to load profile')
    }
  }
)

const meSlice = createSlice({
  name: 'me',
  initialState,
  reducers: {
    setMe(state, action: { payload: UserProfile | null }) {
      state.me = action.payload
      state.status = 'succeeded'
    },
    clearMe(state) {
      state.me = null
      state.status = 'idle'
      state.error = undefined
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMe.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loadMe.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.me = action.payload
      })
      .addCase(loadMe.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

export const { setMe, clearMe } = meSlice.actions
export default meSlice.reducer
