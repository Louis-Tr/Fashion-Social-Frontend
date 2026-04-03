import { z } from 'zod'

import { getToken } from '@/utils/token'
import { BASE_URL } from '@/constants/Url'
import {
  Conversation,
  ConversationSchema,
  Message,
  MessageSchema,
} from '@/types/schemas/conversation'

async function loadConversations(): Promise<Conversation[]> {
  const token = getToken()
  const rep = await fetch(`${BASE_URL}/message/conversations`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await rep.json()

  return z.array(ConversationSchema).parse(data)
}

async function loadMessages(conversationId: string): Promise<Message[]> {
  const token = getToken()
  const rep = await fetch(
    `${BASE_URL}/message/conversations/${conversationId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  const data = await rep.json()

  return z.array(MessageSchema).parse(data)
}
