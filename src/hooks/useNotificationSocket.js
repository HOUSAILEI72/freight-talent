import { useEffect } from 'react'
import { useNotifications } from '../context/NotificationContext'

export function useNotificationSocket(socket) {
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (!socket) return
    const handler = (notif) => addNotification(notif)
    socket.on('notification', handler)
    return () => socket.off('notification', handler)
  }, [socket, addNotification])
}
