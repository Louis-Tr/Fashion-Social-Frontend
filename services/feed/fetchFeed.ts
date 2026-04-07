// src/services/feed/fetchFeed.ts
import { AppDispatch, RootState } from '@/store/store'
import {
  appendPosts,
  setIsLoadingFeed,
  setOffset,
  setPosts,
} from '@/store/slices/postSlice'
import { FeedRes } from './schemas'
import { API_BASE_URL } from '@/constants/Url'
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

type Post = z.infer<typeof PostSchema>

export const fetchFeed =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    const { token } = getState().auth
    const { offset, isLoadingFeed } = getState().post

    if (isLoadingFeed) return

    const reqData = { limit: 20, offset }
    const query = new URLSearchParams({
      limit: String(reqData.limit),
      offset: String(reqData.offset),
    }).toString()

    try {
      const resp = await fetch(
        `${API_BASE_URL}/feed?${query}`, // ✅ append query
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      const parsed = FeedRes.parse(data)

      if (offset === 0) dispatch(setPosts(parsed.posts))
      else dispatch(appendPosts(parsed.posts))

      if (parsed.nextOffset !== undefined)
        dispatch(setOffset(parsed.nextOffset))

      return parsed
    } catch (err) {
      console.error('[Feed] Fetch error:', (err as any).message)
      throw err
    } finally {
      dispatch(setIsLoadingFeed(false))
    }
  }
