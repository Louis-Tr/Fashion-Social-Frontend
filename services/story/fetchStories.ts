// src/services/story/fetchStories.ts
import { AppDispatch, RootState } from '@/store/store'
import { setStory, StorySchema } from '@/store/slices/storySlice' // or wherever StorySchema lives
import { API_BASE_URL } from '@/constants/Url'
import { z } from 'zod'

const StoriesRes = z.object({
  ok: z.boolean(),
  stories: z.array(StorySchema),
})

export type StoriesResType = z.infer<typeof StoriesRes>

export const fetchStories =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    const { token } = getState().auth

    try {
      const resp = await fetch(`${API_BASE_URL}/story`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const data = await resp.json()
      const parsed = StoriesRes.parse(data)

      dispatch(setStory(parsed.stories))

      return parsed
    } catch (err) {
      console.error('[Story] Fetch error:', (err as any).message)
      throw err
    }
  }
