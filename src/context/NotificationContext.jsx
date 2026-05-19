import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { notificationsApi } from '../api/notifications'

export const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [panelOpen,     setPanelOpen]     = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unread_count)
    } catch {
      // silent — bell just shows 0
    }
  }, [user])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      if (user) {
        fetchNotifications()
      } else {
        setNotifications([])
        setUnreadCount(0)
        setPanelOpen(false)
      }
    })
    return () => { cancelled = true }
  }, [user, fetchNotifications])

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [notif, ...prev])
    if (!notif.is_read) setUnreadCount(c => c + 1)
  }, [])

  const markRead = useCallback(async (id) => {
    const notif = notifications.find(n => n.id === id)
    if (!notif || notif.is_read) return
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch {
      // ignore
    }
  }, [notifications])

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // ignore
    }
  }, [])

  const dismiss = useCallback(async (id) => {
    const notif = notifications.find(n => n.id === id)
    try {
      await notificationsApi.dismiss(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (notif && !notif.is_read) setUnreadCount(c => Math.max(0, c - 1))
    } catch {
      // ignore
    }
  }, [notifications])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      panelOpen,
      setPanelOpen,
      addNotification,
      markRead,
      markAllRead,
      dismiss,
      refetch: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}
