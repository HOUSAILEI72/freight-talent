/**
 * socket.js — Socket.IO 单例 + 断线指数退避重连封装
 *
 * StrictMode 兼容：disconnectSocket 带 400ms 防抖，
 * 若在此窗口内重新调用 connectSocket，则取消断开，保持已有连接。
 */
import { io } from 'socket.io-client'

let socket = null
let _disconnectTimer = null

/**
 * 获取（或创建）socket 单例并建立连接。
 * 若 socket 已连接，或已存在但仍在握手中，直接返回现有实例。
 * 取消任何待执行的延迟断开（StrictMode 防重连）。
 */
export function connectSocket() {
  if (_disconnectTimer !== null) {
    clearTimeout(_disconnectTimer)
    _disconnectTimer = null
  }

  if (socket && !socket.disconnected) return socket

  socket = io('/', {
    path: '/socket.io',
    auth: (cb) => cb({ token: localStorage.getItem('token') ?? '' }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 10000,
  })

  return socket
}

/** 返回当前 socket 实例（可能为 null）。 */
export function getSocket() {
  return socket
}

/**
 * 断开连接并销毁实例。
 * 带 400ms 防抖：StrictMode 下 cleanup → remount 发生在 ~100ms 内，
 * remount 时调用 connectSocket() 会取消此定时器，避免不必要的断开/重连。
 */
export function disconnectSocket() {
  if (_disconnectTimer !== null) return
  _disconnectTimer = setTimeout(() => {
    _disconnectTimer = null
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }, 400)
}
