/**
 * useSocket.js — 管理 Socket.IO 连接生命周期 + 暴露连接状态
 *
 * @returns {{ socket: import('socket.io-client').Socket|null, connectionStatus: string }}
 *   connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
 */
import { useEffect, useRef, useState } from 'react'
import { connectSocket, disconnectSocket } from '../lib/socket'

export function useSocket(enabled = true) {
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  // socket 实例通过 ref 持有（不触发 render），通过 socketState 暴露给消费者
  const [socketState, setSocketState] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const s = connectSocket()
    // 通过 connect 事件同步给消费者，而非在 effect body 里直接 setState
    socketRef.current = s

    const onConnect = () => {
      setConnectionStatus('connected')
      setSocketState(socketRef.current)
    }
    const onDisconnect       = () => setConnectionStatus('disconnected')
    const onReconnectAttempt = () => setConnectionStatus('reconnecting')
    const onReconnect        = () => setConnectionStatus('connected')
    const onConnectError     = () => setConnectionStatus('disconnected')

    s.on('connect',           onConnect)
    s.on('disconnect',        onDisconnect)
    s.on('connect_error',     onConnectError)
    s.io.on('reconnect_attempt', onReconnectAttempt)
    s.io.on('reconnect',      onReconnect)

    // 若已经连上（单例复用），模拟一次 connect 事件
    if (s.connected) onConnect()

    return () => {
      s.off('connect',       onConnect)
      s.off('disconnect',    onDisconnect)
      s.off('connect_error', onConnectError)
      s.io.off('reconnect_attempt', onReconnectAttempt)
      s.io.off('reconnect',  onReconnect)
      disconnectSocket()
      socketRef.current = null
      setSocketState(null)
    }
  }, [enabled])

  return {
    socket: socketState,
    connectionStatus,
  }
}

