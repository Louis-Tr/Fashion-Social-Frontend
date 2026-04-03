import { z } from 'zod'

export const CreateCommentRequest = z.object({
  parentId: z.string().optional(),
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(500, 'Content cannot exceed 500 characters'),
})

export const GetCommentResponse = z.object({
  ok: z.boolean(),
  comments: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      createdAt: z.string(),
      reactions: z.number(),
      replies: z.number(),
      user: z.object({
        id: z.string(),
        displayName: z.string(),
        avatarKey: z.string().nullable(),
      }),
    })
  ),
})

export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>

export type GetCommentResponse = z.infer<typeof GetCommentResponse>
