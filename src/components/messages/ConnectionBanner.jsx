/**
 * ConnectionBanner.jsx — 顶部连接状态提示条
 *
 * status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
 * - disconnected / reconnecting → 黄色条"连接已断开，重连中..."
 * - 刚从 reconnecting 切换到 connected → 绿色条"✓ 已重连"，2s 后消失
 */
import { useState } from 'react'

export default function ConnectionBanner({ status }) {
  // 把 prevStatus 存为 state，在 render 里检测跳变（React 官方推荐的 getDerived 等价写法）
  const [prevStatus, setPrevStatus] = useState(status)
  const [reconnectFlash, setReconnectFlash] = useState(false)

  if (prevStatus !== status) {
    setPrevStatus(status)
    if (
      status === 'connected' &&
      (prevStatus === 'reconnecting' || prevStatus === 'disconnected')
    ) {
      // 在 render 阶段只做 state 更新（不用 ref / effect）：先打开 flash
      setReconnectFlash(true)
      // 2s 后在异步宏任务回调里关闭（不在 effect body 里同步 setState，规则合规）
      setTimeout(() => setReconnectFlash(false), 2000)
    }
  }

  const showYellow = status === 'disconnected' || status === 'reconnecting'
  const showGreen  = reconnectFlash && status === 'connected'
  const visible    = showYellow || showGreen

  if (!visible) return null

  const bgClass = showGreen ? 'bg-emerald-500' : 'bg-amber-400'
  const text = showGreen
    ? '✓ 已重连'
    : status === 'reconnecting'
      ? '连接已断开，重连中...'
      : '连接已断开'

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] ${bgClass} text-white text-center py-1.5 text-sm font-medium transition-colors duration-300`}
    >
      {text}
    </div>
  )
}
