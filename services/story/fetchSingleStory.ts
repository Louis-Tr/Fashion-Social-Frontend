// src/services/story/fetchSingleStory.ts
import { AppDispatch, RootState } from '@/store/store'
import { setSingleStory, StorySchema } from '@/store/slices/storySlice'
import { API_BASE_URL } from '@/constants/Url'
import { z } from 'zod'

const SingleStoryRes = z.object({
  ok: z.boolean(),
  story: StorySchema,
})

export type SingleStoryResType = z.infer<typeof SingleStoryRes>

export const fetchSingleStory =
  (id: string) => async (dispatch: AppDispatch, getState: () => RootState) => {
    const { token } = getState().auth

    try {
      const resp = await fetch(`${API_BASE_URL}/story/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const data = await resp.json()
      const parsed = SingleStoryRes.parse(data)

      dispatch(setSingleStory(parsed.story))

      return parsed
    } catch (err) {
      console.error('[Story] Fetch single error:', (err as Error).message)
      throw err
    }
  }
