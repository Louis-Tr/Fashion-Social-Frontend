// src/store/slices/postSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Post } from '@/types/schemas/post'
import { z } from 'zod'

const UserInfoSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  handle: z.string(),
  avatarKey: z.string().nullable(),
})

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  mediaUrl: z.string().nullable(),
})

const MediaSchema = z.object({
  mediaId: z.string(),
  mediaUrl: z.string(), // backend type says string (not nullable)
  index: z.number(),
  items: z.array(ItemSchema).nullable().optional(),
})

const PostSchema = z.object({
  id: z.string(),
  userInfo: UserInfoSchema,
  caption: z.string().nullable(),
  isReacted: z.boolean(),
  reactionsCount: z.number(),
  commentsCount: z.number(),
  visibility: z.enum(['public', 'followers', 'private']),
  created_at: z.string(),
  updated_at: z.string(),
  medias: z.array(MediaSchema),
})

interface PostState {
  posts: Post[]
  seen: string[] // post ids you've seen
  offset: number
  isLoadingFeed: boolean
}

const initialState: PostState = {
  posts: [],
  seen: [],
  offset: 0,
  isLoadingFeed: false,
}

function dedupeById(posts: Post[]): Post[] {
  const seen = new Set<string>()
  const out: Post[] = []
  for (const p of posts) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

const postSlice = createSlice({
  name: 'post',
  initialState,
  reducers: {
    setPosts: (state, action: PayloadAction<Post[]>) => {
      // keep only unique ids (server sometimes duplicates)
      state.posts = dedupeById(action.payload)
    },

    appendPosts: (state, action: PayloadAction<Post[]>) => {
      // append + de-dupe
      state.posts = dedupeById([...state.posts, ...action.payload])
    },

    markSeen: (state, action: PayloadAction<string>) => {
      const id = action.payload
      if (!state.seen.includes(id)) state.seen.push(id)
    },

    setOffset: (state, action: PayloadAction<number>) => {
      state.offset = action.payload
    },

    setIsLoadingFeed: (state, action: PayloadAction<boolean>) => {
      state.isLoadingFeed = action.payload
    },

    resetFeed: () => initialState,
  },
})

export const {
  setPosts,
  appendPosts,
  markSeen,
  setOffset,
  setIsLoadingFeed,
  resetFeed,
} = postSlice.actions

export default postSlice.reducer
