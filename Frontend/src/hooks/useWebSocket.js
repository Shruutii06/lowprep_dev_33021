import { useEffect, useRef, useCallback, useState } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 2000

export function useWebSocket(roomToken, token, onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const onMessageRef = useRef(onMessage)
  const reconnectTimerRef = useRef(null)
  const unmountedRef = useRef(false)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!roomToken || !token || unmountedRef.current) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const base = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}`
    const url = `${base}/ws/${roomToken}?token=${token}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) return
      setConnected(true)
      setReconnectCount(0)
    }

    ws.onclose = (e) => {
      if (unmountedRef.current) return
      setConnected(false)
      // Don't reconnect on intentional close (code 1000) or auth errors (4001, 4003, 4004)
      if (e.code !== 1000 && e.code < 4000) {
        setReconnectCount(c => {
          if (c < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS * Math.pow(1.5, c))
            return c + 1
          }
          return c
        })
      }
    }

    ws.onerror = () => {
      if (!unmountedRef.current) setConnected(false)
    }

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        onMessageRef.current?.(event)
      } catch (_) {}
    }
  }, [roomToken, token])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
      }
      setConnected(false)
    }
  }, [connect])

  const send = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  return { send, connected, reconnectCount }
}
