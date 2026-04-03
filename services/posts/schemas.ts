import { z } from 'zod'

export const Visibility = z.enum(['public', 'followers'])
export type Visibility = 'public' | 'followers'

export const MediaTypes = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
])
export type MediaTypes = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4'

export const CreatePostReq = z.object({
  caption: z
    .string()
    .max(2200, 'Caption must be 2200 characters or less')
    .optional(),
  visibility: Visibility.default('public'),
  mediaCount: z
    .number()
    .int()
    .min(0, 'Must have at least 0 media files')
    .max(10, 'Maximum 10 media files'),
  // ⬇️ renamed
  mediaMineTypes: z
    .array(MediaTypes)
    .max(10, 'Maximum 10 media types allowed')
    .default([]),
})
export type CreatePostReq = {
  caption?: string
  visibility: Visibility
  mediaCount: number
  mediaMineTypes: MediaTypes[] // ⬅️ renamed
}

export const PostReactionBody = z.object({
  postId: z.string(),
})

export type PostReactionBody = z.infer<typeof PostReactionBody>
