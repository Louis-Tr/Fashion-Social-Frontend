// src/services/feed/fetchFeed.ts
import { AppDispatch, RootState } from '@/store/store'
import {
  setConversation,
  appendConversatation,
  setIsLoadingConversation,
} from '@/store/slices/conversationSlice'
import { z } from 'zod'
import { BASE_URL } from '@/constants/Url'
import { ConversationSchema } from '@/types/schemas/conversation'

export const fetchConversations =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    const { token } = getState().auth
    const { beforeId, isLoadingConversation } = getState().conversation

    if (isLoadingConversation) return

    dispatch(setIsLoadingConversation(true))

    // Build query
    const query = new URLSearchParams()
    if (beforeId) query.set('beforeId', beforeId)

    try {
      const resp = await fetch(
        `${BASE_URL}/message/conversations?${query.toString()}`,
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
      const parsed = z.array(ConversationSchema).parse(data.conversations)

      if (parsed.length === 0) {
        // optional: set hasMore=false in your slice
        // dispatch(setHasMore(false))
        return parsed
      }

      // if first page (no beforeId) → replace
      if (!beforeId) dispatch(setConversation(parsed))
      // else append
      else dispatch(appendConversatation(parsed))

      return parsed
    } catch (err) {
      console.error('[Conversation] Fetch error 123:', (err as any).message)
      throw err
    } finally {
      dispatch(setIsLoadingConversation(false))
    }
  }
