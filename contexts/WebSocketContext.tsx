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
import { Message } from '@/types/schemas/conversation'

type LiveMessage = {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  senderName?: string
}

type WebSocketContextValue = {
  isConnected: boolean
  isReady: boolean
  activeConversationId: string | null
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
  const [isReady, setIsReady] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null)

  const sendJson = useCallback((payload: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(payload))
  }, [])

  const handleIncomingMessage = useCallback(
    (raw: string) => {
      let msg: any
      try {
        msg = JSON.parse(raw)
      } catch {
        console.log('[WS] Raw message:', raw)
        return
      }

      const type = msg?.type

      if (type === 'READY') {
        setIsReady(true)
        console.log('[WS] READY received')

        if (activeConversationId) {
          sendJson({
            type: 'SUBSCRIBE',
            conversationId: activeConversationId,
          })
        }
        return
      }

      if (type === 'MESSAGE' || type === 'LIVE_MESSAGE') {
        const payload = msg.message ?? msg
        const liveMsg: LiveMessage = {
          id: payload.id,
          conversationId: payload.conversationId,
          senderId: payload.senderId,
          content: payload.content || payload.body || payload.text || '',
          createdAt: payload.createdAt,
          senderName: payload.senderName,
        }
        console.log('[WS] Live message:', liveMsg)

        const m: Message = {
          id: liveMsg.id,
          conversationId: liveMsg.conversationId,
          senderId: liveMsg.senderId,
          content: liveMsg.content,
          createdAt: liveMsg.createdAt,
        }

        store.dispatch(upsertMessage(m))
        return
      }

      if (type === 'NEW_MESSAGE') {
        console.log('[WS] New message notification:', msg)
        // hook unread/badge logic here later
        return
      }

      console.log('[WS] Event:', msg)
    },
    [activeConversationId, sendJson]
  )

  useEffect(() => {
    let isCancelled = false

    if (!enabled) {
      // if we disable WS (e.g. logged out), close if open
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
      setIsReady(false)
      return
    }

    const connect = async () => {
      try {
        const token = await getToken()
        if (!token) return new Error('No access token available')
        if (isCancelled) return

        const url = `${WS_URL}?token=${encodeURIComponent(token)}`
        console.log('[WS] Connecting to', url)

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[WS] Connected, waiting for READY...')
          setIsConnected(true)
          setIsReady(false)
        }

        ws.onmessage = (event) => {
          handleIncomingMessage(event.data)
        }

        ws.onerror = (event: any) => {
          console.log('[WS] Error:', event?.message ?? event)
        }

        ws.onclose = (event) => {
          console.log(`[WS] Closed: code=${event.code}, reason=${event.reason}`)
          setIsConnected(false)
          setIsReady(false)
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

  const subscribe = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId)

      if (!isReady) {
        return
      }

      sendJson({
        type: 'SUBSCRIBE',
        conversationId,
      })
    },
    [isReady, sendJson]
  )

  const unsubscribe = useCallback(
    (conversationId: string) => {
      if (!isReady) return
      sendJson({
        type: 'UNSUBSCRIBE',
        conversationId,
      })
      if (activeConversationId === conversationId) {
        setActiveConversationId(null)
      }
    },
    [activeConversationId, isReady, sendJson]
  )

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      if (!isReady || !text.trim()) return
      sendJson({
        type: 'SEND',
        conversationId,
        text,
      })
    },
    [isReady, sendJson]
  )

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isReady,
        activeConversationId,
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
