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
import { MessageSchema } from '@/types/schemas/conversation'
import { z } from 'zod'

// ==============================
// 🔧 DEBUG CONFIG
// ==============================
const WS_DEBUG = true // set false in production

const log = (...args: any[]) => {
  if (WS_DEBUG) {
    console.log(
      `%c[WS ${new Date().toISOString()}]`,
      'color: purple; font-weight: bold;',
      ...args
    )
  }
}

const logGroup = (label: string, fn: () => void) => {
  if (!WS_DEBUG) return
  console.group(`%c[WS] ${label}`, 'color: purple; font-weight: bold;')
  fn()
  console.groupEnd()
}

// ==============================
// 📦 SCHEMAS
// ==============================
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

// ==============================
// 🧠 CONTEXT TYPES
// ==============================
type WebSocketContextValue = {
  isConnected: boolean
  isReady: boolean
  activeConversationId: string | null
  conversationReady: boolean
  subscribe: (conversationId: string) => void
  unsubscribe: (conversationId: string) => void
  sendMessage: (conversationId: string, text: string) => void
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
)

// ==============================
// 🚀 PROVIDER
// ==============================
export const WebSocketProvider: React.FC<{
  children: React.ReactNode
  enabled?: boolean
}> = ({ children, enabled = true }) => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const enabledRef = useRef(enabled)
  const connectionIdRef = useRef(0)

  const [isConnected, setIsConnected] = useState(false)
  const [connectionReady, setConnectionReady] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null)

  const activeConversationIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const conversationReady = connectionReady && !!activeConversationId

  // ==============================
  // 📤 SEND JSON
  // ==============================
  const sendJson = useCallback((payload: any) => {
    const ws = wsRef.current

    logGroup('OUTGOING', () => {
      log('readyState:', ws?.readyState)
      log('payload:', payload)
    })

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log('❌ SEND BLOCKED: socket not open')
      return
    }

    ws.send(JSON.stringify(payload))
  }, [])

  // ==============================
  // 📥 HANDLE INCOMING
  // ==============================
  const handleIncomingMessage = useCallback(
    (raw: string) => {
      logGroup('INCOMING RAW', () => {
        log(raw)
      })

      let msg: WsMessage
      try {
        msg = WsMessageSchema.parse(JSON.parse(raw))
      } catch {
        log('❌ Invalid message format:', raw)
        return
      }

      logGroup(`INCOMING PARSED → ${msg.type}`, () => {
        log('payload:', msg)
        log('activeConversationRef:', activeConversationIdRef.current)
      })

      const type = msg.type

      if (type === 'CONFIRM_OPEN') {
        log('✅ READY received (connection handshake)')
        setConnectionReady(true)

        const convoId = activeConversationIdRef.current
        if (convoId) {
          log('🔁 Auto-subscribing to:', convoId)
          sendJson({
            type: 'SUBSCRIBE',
            conversationId: convoId,
          })
        }
        return
      }

      if (type === 'CONFIRM_SUBSCRIBE') {
        log('✅ SUBSCRIBED:', msg.conversationId)
        return
      }

      if (type === 'CONFIRM_MESSAGE') {
        logGroup('MESSAGE ACK', () => {
          log('server message:', msg.message)
        })

        if (msg.message) {
          store.dispatch(upsertMessage(msg.message))
        }
        return
      }

      if (type === 'MESSAGE') {
        const message = msg.message
        if (message) {
          logGroup('📩 LIVE MESSAGE', () => {
            log('id:', message.id)
            log('conversationId:', message.conversationId)
            log('content:', message.content)
          })

          store.dispatch(upsertMessage(message))
        }
        return
      }

      if (type === 'ERROR') {
        log('❌ WS ERROR:', msg)
        return
      }

      log('⚠️ Unhandled message type:', msg)
    },
    [sendJson]
  )

  // ==============================
  // 🔌 CONNECT
  // ==============================
  const connect = useCallback(() => {
    if (!enabledRef.current) return

    const existing = wsRef.current
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      log('⚠️ Already connected or connecting')
      return
    }

    const token = getToken()
    if (!token) {
      log('❌ No token, skipping WS connect')
      return
    }

    connectionIdRef.current += 1
    const connectionId = connectionIdRef.current

    const url = `${WS_URL}?token=${encodeURIComponent(token)}`

    logGroup(`CONNECT #${connectionId}`, () => {
      log('url:', url)
      log('token exists:', !!token)
    })

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      log(`[#${connectionId}] ✅ OPEN`)
      setIsConnected(true)
      setConnectionReady(false)
      reconnectAttemptRef.current = 0
    }

    ws.onmessage = (event) => {
      handleIncomingMessage(event.data)
    }

    ws.onerror = (event: any) => {
      log(`[#${connectionId}] ❌ ERROR`, event?.message ?? event)
    }

    ws.onclose = (event) => {
      logGroup(`[#${connectionId}] CLOSED`, () => {
        log('code:', event.code)
        log('reason:', event.reason || 'n/a')
        log('wasClean:', event.wasClean)
      })

      setIsConnected(false)
      setConnectionReady(false)
      setActiveConversationId(null)
      wsRef.current = null

      if (!enabledRef.current) return

      const delayMs = Math.min(
        1000 * 2 ** reconnectAttemptRef.current,
        10000
      )

      reconnectAttemptRef.current += 1

      logGroup('RECONNECT SCHEDULED', () => {
        log('attempt:', reconnectAttemptRef.current)
        log('delayMs:', delayMs)
      })

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }

      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, delayMs)
    }
  }, [handleIncomingMessage])

  // ==============================
  // 🔁 INIT / CLEANUP
  // ==============================
  useEffect(() => {
    if (!enabled) {
      enabledRef.current = false

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      setIsConnected(false)
      setConnectionReady(false)
      setActiveConversationId(null)
      return
    }

    enabledRef.current = true
    connect()

    return () => {
      enabledRef.current = false

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect, enabled])

  // ==============================
  // 📡 SUBSCRIBE
  // ==============================
  const subscribe = useCallback(
    (conversationId: string) => {
      logGroup('SUBSCRIBE FLOW', () => {
        log('conversationId:', conversationId)
        log('connectionReady:', connectionReady)
        log('current active:', activeConversationIdRef.current)
      })

      setActiveConversationId(conversationId)
      activeConversationIdRef.current = conversationId

      if (!connectionReady) {
        log('⏳ Delayed subscribe (waiting for READY)')
        connect()
        return
      }

      sendJson({
        type: 'SUBSCRIBE',
        conversationId,
      })
    },
    [connect, connectionReady, sendJson]
  )

  // ==============================
  // ❌ UNSUBSCRIBE
  // ==============================
  const unsubscribe = useCallback(
    (conversationId: string) => {
      log('UNSUBSCRIBE:', conversationId)

      if (!connectionReady) return

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

  // ==============================
  // 💬 SEND MESSAGE
  // ==============================
  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      if (!connectionReady) {
        log('❌ SEND BLOCKED: not READY')
        return
      }

      if (activeConversationIdRef.current !== conversationId) {
        logGroup('❌ SEND BLOCKED: wrong conversation', () => {
          log('expected:', activeConversationIdRef.current)
          log('got:', conversationId)
        })
        return
      }

      log('🚀 SEND MESSAGE', { conversationId, text: trimmed })

      sendJson({
        type: 'MESSAGE',
        conversationId,
        message: {
          id: '',
          conversationId,
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

// ==============================
// 🪝 HOOK
// ==============================
export const useWebSocket = (): WebSocketContextValue => {
  const ctx = useContext(WebSocketContext)
  if (!ctx) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return ctx
}
