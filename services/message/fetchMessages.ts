// src/services/feed/fetchFeed.ts
import { AppDispatch, RootState } from '@/store/store'
import {
  appendMessages,
  setIsLoadingConversation,
  setMessages,
} from '@/store/slices/conversationSlice'
import { z } from 'zod'
import { API_BASE_URL } from '@/constants/Url'
import { MessageSchema } from '@/types/schemas/conversation'

export const fetchMessages =
  (conversationId: string) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    const { token } = getState().auth
    const { conversations, isLoadingConversation } = getState().conversation

    const conversation = conversations.find(
      (conversation) => conversation.id === conversationId
    )
    const beforeId = conversation?.messages?.[0]?.id

    if (isLoadingConversation) return

    dispatch(setIsLoadingConversation(true))

    // Build query
    const query = new URLSearchParams()
    if (beforeId) query.set('beforeId', beforeId)

    try {
      const resp = await fetch(
        `${API_BASE_URL}/message/${conversationId}?${query.toString()}`,
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
      const parsed = z.array(MessageSchema).parse(data.messages)

      // if first page (no beforeId) → replace
      if (!beforeId) dispatch(setMessages(parsed))
      // else append
      else dispatch(appendMessages(parsed))

      return parsed
    } catch (err) {
      console.error('[Messages] Fetch error:', (err as any).message)
      throw err
    } finally {
      dispatch(setIsLoadingConversation(false))
    }
  }
