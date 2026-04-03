// src/contexts/WebSocketContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getToken } from '@/utils/token'
import { WS_URL } from '@/constants/Url'
import { upsertMessage } from '@/store/slices/conversationSlice'
import { store } from '@/store/store'
import { Message, MessageSchema } from '@/types/schemas/conversation'
import { z } from 'zod'

const WsMessageTypes = z.enum([
  'SUBSCRIBE',
  'UNSUBSCRIBE',
  'SEND',
  'CONFIRM_OPEN',
  'CONFIRM_SUBSCRIBE',
  'CONFIRM_MESSAGE',
  'ERROR',
  'MESSAGE',
])

const WsMessageSchema = z.object({
  type: WsMessageTypes,
  conversationId: z.string().optional().nullable(),
  message: MessageSchema.optional().nullable(),
  reason: z.string().optional().nullable(),
})

type WsMessage = z.infer<typeof WsMessageSchema>

type WebSocketContextValue = {
  isConnected: boolean // raw transport connection (TCP/WS)
  isReady: boolean // connection-level READY from backend
  activeConversationId: string | null
  conversationReady: boolean // now = isReady && !!activeConversationId
  subscribe: (conversationId: string) => void
  unsubscribe: (conversationId: string) => void
  sendMessage: (conversationId: string, text: string) => void
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
)

export const WebSocketProvider: React.FC<{
  children: React.ReactNode
  enabled?: boolean
}> = ({ children, enabled = true }) => {
  const wsRef = useRef<WebSocket | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [connectionReady, setConnectionReady] = useState(false) // handshake 1: READY
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null)

  // keep latest active conversation in a ref so WS handler sees fresh value
  const activeConversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  const conversationReady = connectionReady && !!activeConversationId

  // payload here is *client → server*, so don't force WsMessage shape
  const sendJson = useCallback((payload: any) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(payload))
  }, [])

  // --- SERVER → CLIENT handler (parse with WsMessageSchema) ---
  const handleIncomingMessage = useCallback(
    (raw: string) => {
      let msg: WsMessage
      try {
        msg = WsMessageSchema.parse(JSON.parse(raw))
      } catch {
        console.log('[WS] Raw (non-JSON / invalid) message:', raw)
        return
      }

      const type = msg.type

      // CONNECTION-LEVEL ACK (no conversationId needed)
      if (type === 'CONFIRM_OPEN') {
        console.log('[WS] READY (connection handshake) received')
        setConnectionReady(true)

        const convoId = activeConversationIdRef.current
        if (convoId) {
          console.log(
            '[WS] Auto-SUBSCRIBE after READY for conversation',
            convoId
          )
          sendJson({
            type: 'SUBSCRIBE',
            conversationId: convoId,
          })
        }
        return
      }

      // SUBSCRIBE ACK
      if (type === 'CONFIRM_SUBSCRIBE') {
        console.log('[WS] SUBSCRIBED to conversation', msg.conversationId)
        return
      }

      // (UNSUBSCRIBE ACK not modeled in enum; you can piggyback on ERROR or ignore)

      // MESSAGE ACK
      if (type === 'CONFIRM_MESSAGE') {
        console.log('[WS] MESSAGE_ACK:', msg)
        if (msg.message) {
          store.dispatch(upsertMessage(msg.message))
        }
        return
      }

      // ACTUAL LIVE MESSAGE
      if (type === 'MESSAGE') {
        const message = msg.message
        if (message) {
          console.log('[WS] Live message:', message)
          store.dispatch(upsertMessage(message))
        }
        return
      }

      if (type === 'ERROR') {
        console.log('[WS] ERROR frame:', msg)
        return
      }

      console.log('[WS] Unhandled message type:', msg)
    },
    [sendJson]
  )

  // --- INITIAL CONNECTION / TEARDOWN (depends only on `enabled`) ---
  useEffect(() => {
    let isCancelled = false

    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
      setConnectionReady(false)
      setActiveConversationId(null)
      return
    }

    const connect = async () => {
      try {
        const token = getToken()
        if (!token) {
          console.log('[WS] No access token – not connecting')
          return
        }
        if (isCancelled) return

        const url = `${WS_URL}?token=${encodeURIComponent(token)}`
        console.log('[WS] Connecting to', url)

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          console.log(
            '[WS] Connected (transport), waiting for READY handshake…'
          )
          setIsConnected(true)
          setConnectionReady(false) // wait for CONFIRM_OPEN
        }

        ws.onmessage = (event) => {
          handleIncomingMessage(event.data)
        }

        ws.onerror = (event: any) => {
          console.log('[WS] Error:', event?.message ?? event)
        }

        ws.onclose = (event) => {
          console.log(
            `[WS] Closed: code=${event.code}, reason=${event.reason || 'n/a'}`
          )
          setIsConnected(false)
          setConnectionReady(false)
          setActiveConversationId(null)
          wsRef.current = null
        }
      } catch (e) {
        console.log('[WS] Failed to connect:', e)
      }
    }

    connect()

    return () => {
      isCancelled = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, handleIncomingMessage])

  // --- SUBSCRIBE / UNSUBSCRIBE ---

  const subscribe = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId)
      activeConversationIdRef.current = conversationId

      if (!connectionReady) {
        console.log(
          '[WS] subscribe called before connectionReady, will auto-SUBSCRIBE after READY'
        )
        return
      }

      console.log('[WS] Sending SUBSCRIBE for', conversationId)
      sendJson({
        type: 'SUBSCRIBE',
        conversationId,
      })
    },
    [connectionReady, sendJson]
  )

  const unsubscribe = useCallback(
    (conversationId: string) => {
      if (!connectionReady) return

      console.log('[WS] Sending UNSUBSCRIBE for', conversationId)
      sendJson({
        type: 'UNSUBSCRIBE',
        conversationId,
      })

      if (activeConversationIdRef.current === conversationId) {
        setActiveConversationId(null)
        activeConversationIdRef.current = null
      }
    },
    [connectionReady, sendJson]
  )

  // --- SEND MESSAGE (client → server SEND frame) ---

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      if (!connectionReady) {
        console.log('[WS] Cannot SEND – connection not READY yet')
        return
      }

      if (activeConversationIdRef.current !== conversationId) {
        console.log('[WS] Cannot SEND – conversation not active', {
          activeConversationId: activeConversationIdRef.current,
          conversationId,
        })
        return
      }

      console.log('[WS] SEND →', { conversationId, text: trimmed })

      // This shape is for the backend. It does *not* have to match WsMessageSchema,
      // since that schema is only for server → client frames.
      sendJson({
        type: 'MESSAGE',
        conversationId: conversationId,
        message: {
          id: '',
          conversationId: conversationId,
          content: trimmed,
          senderId: '',
          createdAt: '',
        },
      })
    },
    [connectionReady, sendJson]
  )

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isReady: connectionReady,
        activeConversationId,
        conversationReady,
        subscribe,
        unsubscribe,
        sendMessage,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = (): WebSocketContextValue => {
  const ctx = useContext(WebSocketContext)
  if (!ctx) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return ctx
}
