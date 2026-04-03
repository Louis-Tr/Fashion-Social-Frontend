import { z } from 'zod'

export const UserInfoSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  handle: z.string(),
  avatarKey: z.string().nullable(),
})

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  mediaUrl: z.string().nullable(),
})

export const MediaSchema = z.object({
  mediaId: z.string(),
  mediaUrl: z.string(), // backend type says string (not nullable)
  index: z.number(),
  items: z.array(ItemSchema).nullable().optional(),
})

export const PostSchema = z.object({
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

export type Post = z.infer<typeof PostSchema>
