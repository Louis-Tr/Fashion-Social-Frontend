import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarKey: z.string().optional(),
  bio: z.string().optional().nullable(),
  isPrivate: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type User = z.infer<typeof UserSchema>
