// src/store/slices/postSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Conversation, Message } from '@/types/schemas/conversation'

interface ConversationState {
  conversations: Conversation[]
  beforeId: string | null
  isLoadingConversation: boolean
}

const initialState: ConversationState = {
  conversations: [],
  beforeId: null,
  isLoadingConversation: false,
}

const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    setConversation: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload
      const last = action.payload.at(-1)
      if (last) state.beforeId = last.id
    },
    appendConversatation: (state, action) => {
      const merged = [...state.conversations, ...action.payload]
      state.conversations = merged
      const last = action.payload.at(-1)
      state.beforeId = last?.id ?? state.beforeId
    },
    setLast: (state, action: PayloadAction<string>) => {
      state.beforeId = action.payload
    },
    setMessages: (state, action: PayloadAction<Message[]>) => {
      const incoming = action.payload
      if (!incoming.length) return

      const byConv: Record<string, Message[]> = {}
      for (const msg of incoming) {
        if (!byConv[msg.conversationId]) byConv[msg.conversationId] = []
        byConv[msg.conversationId].push(msg)
      }

      state.conversations.forEach((conv) => {
        const list = byConv[conv.id]
        if (!list || !list.length) return

        const map = new Map<string, Message>()
        for (const m of list) map.set(m.id, m)

        const sorted = Array.from(map.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        conv.messages = sorted
        conv.lastMessage = sorted[sorted.length - 1] ?? null
      })
    },
    upsertMessage: (state, action: PayloadAction<Message>) => {
      const msg = action.payload
      const conv = state.conversations.find((c) => c.id === msg.conversationId)
      if (!conv) {
        // optional: if conversation not loaded, ignore or create stub
        return
      }

      const existing = conv.messages ?? []
      const map = new Map<string, Message>()
      for (const m of existing) map.set(m.id, m)
      map.set(msg.id, msg) // add/overwrite

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      conv.messages = merged
      conv.lastMessage = merged[merged.length - 1] ?? conv.lastMessage ?? null

      // move this conversation to top (for recent activity)
      state.conversations = [
        conv,
        ...state.conversations.filter((c) => c.id !== conv.id),
      ]
    },
    appendMessages: (state, action: PayloadAction<Message[]>) => {
      const incoming = action.payload
      if (!incoming.length) return

      const byConv: Record<string, Message[]> = {}
      for (const msg of incoming) {
        if (!byConv[msg.conversationId]) byConv[msg.conversationId] = []
        byConv[msg.conversationId].push(msg)
      }

      state.conversations.forEach((conv) => {
        const toAdd = byConv[conv.id]
        if (!toAdd || !toAdd.length) return

        const existing = conv.messages ?? []
        const map = new Map<string, Message>()

        for (const m of existing) map.set(m.id, m) // keep old
        for (const m of toAdd) map.set(m.id, m) // add/overwrite new

        const merged = Array.from(map.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        conv.messages = merged
        conv.lastMessage = merged[merged.length - 1] ?? conv.lastMessage ?? null
      })
    },
    setIsLoadingConversation: (state, action: PayloadAction<boolean>) => {
      state.isLoadingConversation = action.payload
    },
    resetConverstation: () => initialState,
  },
})

export const {
  setConversation,
  appendConversatation,
  setLast,
  setIsLoadingConversation,
  setMessages,
  upsertMessage,
  appendMessages,
  resetConverstation,
} = conversationSlice.actions
export default conversationSlice.reducer
