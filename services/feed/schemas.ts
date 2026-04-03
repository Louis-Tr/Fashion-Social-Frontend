// src/modules/feed/schemas.ts
import { z } from 'zod'
import { PostSchema } from '@/types/schemas/post'

export const FeedReq = z.object({
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .default(20),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default(0),
})
export type FeedReq = z.infer<typeof FeedReq>

export const FeedFetchInput = z.object({
  userId: z.string(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
})
export type FeedFetchInput = z.infer<typeof FeedFetchInput>

export const FeedRes = z.object({
  posts: z.array(PostSchema),
  nextOffset: z.number().optional(),
})
export type FeedRes = z.infer<typeof FeedRes>
