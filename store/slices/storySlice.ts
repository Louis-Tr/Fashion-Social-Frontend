import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { z } from 'zod'

const User = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarKey: z.string().nullable(),
})

export const StorySchema = z.object({
  id: z.string(),
  user: User,
  tags: z.array(z.string()),
  contentType: z.enum(['image/jpeg', 'video/mp4']),
  createdAt: z.string(),
  presignUrl: z.string().nullable().optional(),
  impression: z.boolean().default(false),
})

export type StoryType = z.infer<typeof StorySchema>

interface StoryState {
  stories: StoryType[]
}

const initialState: StoryState = {
  stories: [],
}

const storySlice = createSlice({
  name: 'story',
  initialState,
  reducers: {
    setStory: (state, action: PayloadAction<StoryType[]>) => {
      state.stories = action.payload
    },

    setSingleStory: (state, action: PayloadAction<StoryType>) => {
      const incoming = action.payload
      const index = state.stories.findIndex((s) => s.id === incoming.id)

      if (index !== -1) {
        state.stories[index] = incoming
      } else {
        state.stories.push(incoming)
      }
    },

    setSeenStory: (state, action: PayloadAction<string>) => {
      const story = state.stories.find((s) => s.id === action.payload)
      if (story) {
        story.impression = true
      }
    },
  },
})

export const { setStory, setSingleStory, setSeenStory } = storySlice.actions
export default storySlice.reducer
