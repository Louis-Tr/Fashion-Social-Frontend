import { z } from 'zod'

/* ──────────────────────────────────────────────
   Conversation Type
─────────────────────────────────────────────── */
export const ConversationType = z.enum(['dm', 'group'] as const)
export type ConversationType = z.infer<typeof ConversationType>

/* ──────────────────────────────────────────────
   Message Schema
─────────────────────────────────────────────── */
export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string().min(1),
  mediaKey: z.string().optional().nullable(),
  createdAt: z.string(), // ISO timestamp
})

export type Message = z.infer<typeof MessageSchema>

/* ──────────────────────────────────────────────
   Conversation Schema
─────────────────────────────────────────────── */
export const ConversationSchema = z.object({
  id: z.string(),
  type: ConversationType,
  participants: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      avatarKey: z.string().nullable(),
    })
  ),
  lastMessage: MessageSchema.nullable(),
  messages: z.array(MessageSchema).optional().nullable(),
})

export type Conversation = z.infer<typeof ConversationSchema>

/* ──────────────────────────────────────────────
   Status Schemas
─────────────────────────────────────────────── */
export const ConversationStatusSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export const MessageStatusSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type ConversationStatus = z.infer<typeof ConversationStatusSchema>
export type MessageStatus = z.infer<typeof MessageStatusSchema>
