// src/services/feed/fetchFeed.ts
import { AppDispatch, RootState } from '@/store/store'
import {
  appendConversatation,
  setConversation,
  setIsLoadingFeed,
} from '@/store/slices/conversationSlice'
import { z } from 'zod'
import { API_BASE_URL } from '@/constants/Url'
import { ConversationSchema } from '@/types/schemas/conversation'

export const fetchConversations =
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
        `${API_BASE_URL}/message/conversations?${query}`, // ✅ append query
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
      const parsed = z.array(ConversationSchema).parse(data)

      if (offset === 0) dispatch(setConversation(parsed))
      else dispatch(appendConversatation(parsed))

      return parsed
    } catch (err) {
      console.error('[Feed] Fetch error:', (err as any).message)
      throw err
    } finally {
      dispatch(setIsLoadingFeed(false))
    }
  }
