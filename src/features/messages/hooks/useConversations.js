import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchConversationList } from '../services/messagesApi'
import { SOCKET_EVENTS } from '../services/messagesSocket'
import { sortConversations } from '../utils/conversationHelpers'
import { POLL_CONVERSATIONS_INTERVAL_MS } from '../constants'

export function useConversations({ socket, activeIdRef, paramThreadId, basePath, navigate }) {
  const { user } = useAuth()

  const [conversations, setConversations] = useState([])
  const [loadingList,   setLoadingList]   = useState(true)
  const [listError,     setListError]     = useState('')

  const storageKey = user?.id ? `msg_hidden_${user.id}` : null
  const deletedKey = user?.id ? `msg_deleted_${user.id}` : null

  const [hiddenIds,  setHiddenIds]  = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`msg_hidden_${user?.id}`) ?? '[]')) }
    catch { return new Set() }
  })
  const [deletedIds, setDeletedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`msg_deleted_${user?.id}`) ?? '[]')) }
    catch { return new Set() }
  })

  // Persist hidden / deleted sets
  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...hiddenIds]))
  }, [hiddenIds, storageKey])
  useEffect(() => {
    if (deletedKey) localStorage.setItem(deletedKey, JSON.stringify([...deletedIds]))
  }, [deletedIds, deletedKey])

  const readThreadsRef = useRef(new Set())

  const mergeConversations = useCallback((incoming) => {
    setConversations(prev => {
      const localUnread = {}
      for (const c of prev) {
        if (readThreadsRef.current.has(c.id)) localUnread[c.id] = c.unread_count
      }
      const merged = incoming.map(c => ({
        ...c,
        unread_count: (c.id === activeIdRef.current && localUnread[c.id] === 0)
          ? 0
          : c.unread_count,
      }))
      return sortConversations(merged)
    })
  }, [activeIdRef])

  const doFetch = useCallback((isInitial) => {
    if (isInitial) setLoadingList(true)
    fetchConversationList()
      .then(convs => {
        if (isInitial) {
          setConversations(convs)
          setListError('')
          if (!paramThreadId && convs.length > 0) {
            navigate(`${basePath}/${convs[0].id}`, { replace: true })
          }
        } else {
          mergeConversations(convs)
        }
      })
      .catch(err => {
        console.error('Failed to load conversations:', {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
        })
        const data = err.response?.data
        const message = data?.message || data?.error || data?.detail || data?.msg || '加载会话失败'
        if (isInitial) setListError(message)
      })
      .finally(() => { if (isInitial) setLoadingList(false) })
  }, [mergeConversations, navigate, paramThreadId, basePath])

  // Initial load
  useEffect(() => {
    startTransition(() => { doFetch(true) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling fallback
  useEffect(() => {
    const t = setInterval(() => startTransition(() => { doFetch(false) }), POLL_CONVERSATIONS_INTERVAL_MS)
    return () => clearInterval(t)
  }, [doFetch])

  // Socket: conversation_updated
  useEffect(() => {
    if (!socket) return
    const handler = (data) => {
      if (data.sender_user_id !== user?.id) {
        setHiddenIds(prev => {
          if (!prev.has(data.thread_id)) return prev
          const next = new Set(prev); next.delete(data.thread_id); return next
        })
      }
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id !== data.thread_id) return c
          return {
            ...c,
            latest_message:    data.latest_message,
            latest_message_at: data.latest_message_at ?? data.updated_at,
            updated_at:        data.updated_at,
            unread_count: (data.sender_user_id !== user?.id && c.id !== activeIdRef.current)
              ? (c.unread_count ?? 0) + 1
              : c.unread_count,
          }
        })
        return sortConversations(updated)
      })
    }
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, handler)
    return () => socket.off(SOCKET_EVENTS.CONVERSATION_UPDATED, handler)
  }, [socket, user?.id, activeIdRef])

  const handleThreadRead = useCallback((threadId) => {
    readThreadsRef.current.add(threadId)
    setConversations(prev => prev.map(c => c.id === threadId ? { ...c, unread_count: 0 } : c))
  }, [])

  function hideConv(convId, activeId, setActiveId) {
    setHiddenIds(prev => new Set([...prev, convId]))
    if (activeId === convId) setActiveId(null)
  }

  function deleteConv(convId, activeId, setActiveId) {
    if (!window.confirm('确定删除此对话？删除后将不再显示，已有消息不会被清除。')) return
    setDeletedIds(prev => new Set([...prev, convId]))
    setHiddenIds(prev => { const next = new Set(prev); next.delete(convId); return next })
    if (activeId === convId) setActiveId(null)
  }

  return {
    conversations,
    loadingList, listError,
    hiddenIds, deletedIds,
    hideConv, deleteConv,
    handleThreadRead,
    user,
  }
}
