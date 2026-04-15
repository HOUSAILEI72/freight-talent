/**
 * socket.js — Socket.IO 单例 + 断线指数退避重连封装
 *
 * 使用方式：
 *   import { connectSocket, getSocket, disconnectSocket } from '@/lib/socket'
 *
 * 注意：token 来自 localStorage，每次 connect 时读取最新值。
 */
import { io } from 'socket.io-client'

let socket = null

/**
 * 获取（或创建）socket 单例并建立连接。
 * 若 socket 已连接则直接返回现有实例。
 */
export function connectSocket() {
  if (socket?.connected) return socket

  const token = localStorage.getItem('token') ?? ''

  socket = io('/', {
    path: '/socket.io',
    query: { token },
    transports: ['websocket', 'polling'],  // 优先 WebSocket，降级 polling
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,              // 加随机抖动，避免惊群
    timeout: 10000,
  })

  return socket
}

/** 返回当前 socket 实例（可能为 null）。 */
export function getSocket() {
  return socket
}

/** 断开连接并销毁实例。 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
