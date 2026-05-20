import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchMessages } from '../services/messagesApi'
import { SOCKET_EVENTS } from '../services/messagesSocket'
import {
  POLL_MESSAGES_INTERVAL_MS,
  TYPING_CLEAR_MS,
} from '../constants'

export function useConversationMessages({ threadId, myUserId, socket, connectionStatus, onRead }) {
  const [thread,      setThread]      = useState(null)
  const [messages,    setMessages]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [msgError,    setMsgError]    = useState('')
  const [hasMore,     setHasMore]     = useState(false)
  const [nextBefore,  setNextBefore]  = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isTyping,    setIsTyping]    = useState(false)

  const onReadRef       = useRef(onRead)
  const shouldScrollRef = useRef(false)
  const loadingMoreRef  = useRef(false)
  const typingClearRef  = useRef(null)

  useEffect(() => { onReadRef.current = onRead }, [onRead])

  const handleApiError = (err, label) => {
    console.error(`Failed to ${label}:`, {
      threadId,
      status: err.response?.status,
      data: err.response?.data,
      code: err.code,
      message: err.message,
    })
    return err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || `${label}失败`
  }

  const initialFetch = useCallback(() => {
    fetchMessages(threadId)
      .then(data => {
        setThread(data.thread)
        setMessages(data.messages)
        setHasMore(data.has_more)
        setNextBefore(data.next_before)
        setMsgError('')
        onReadRef.current?.(threadId)
        shouldScrollRef.current = true
      })
      .catch(err => setMsgError(handleApiError(err, '加载消息')))
      .finally(() => setLoading(false))
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  const pollFetch = useCallback(() => {
    fetchMessages(threadId)
      .then(data => {
        setThread(data.thread)
        setMessages(prev => {
          const existingIds = new Set(prev.filter(m => m.id != null).map(m => m.id))
          const newOnes = (data.messages ?? []).filter(m => !existingIds.has(m.id))
          if (newOnes.length === 0) return prev
          onReadRef.current?.(threadId)
          shouldScrollRef.current = true
          return [...prev, ...newOnes]
        })
      })
      .catch(() => {})
  }, [threadId])

  // Initial load + polling
  useEffect(() => {
    setLoading(true)
    setMessages([])
    setThread(null)
    setHasMore(false)
    setNextBefore(null)
    shouldScrollRef.current = false
    loadingMoreRef.current  = false
    initialFetch()
    const t = setInterval(pollFetch, POLL_MESSAGES_INTERVAL_MS)
    return () => clearInterval(t)
  }, [initialFetch, pollFetch])

  // Re-fetch on reconnect
  useEffect(() => {
    if (connectionStatus === 'connected' && threadId && !loading) pollFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus])

  // Socket events
  useEffect(() => {
    if (!socket || !threadId) return

    socket.emit(SOCKET_EVENTS.JOIN_THREAD, { thread_id: threadId })
    socket.emit(SOCKET_EVENTS.MARK_READ,   { thread_id: threadId })

    const onNewMessage = (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        const hasTempForThis = prev.some(m => m._tempId && m.sender_user_id === myUserId && m.content === msg.content && !m.id)
        if (hasTempForThis) {
          let replaced = false
          return prev.map(m => {
            if (!replaced && m._tempId && m.sender_user_id === myUserId && m.content === msg.content && !m.id) {
              replaced = true; return msg
            }
            return m
          })
        }
        shouldScrollRef.current = true
        return [...prev, msg]
      })
      socket.emit(SOCKET_EVENTS.MARK_READ, { thread_id: threadId })
      onReadRef.current?.(threadId)
      shouldScrollRef.current = true
    }

    const onMessagesRead = ({ thread_id, reader_user_id }) => {
      if (thread_id !== threadId || reader_user_id === myUserId) return
      setMessages(prev =>
        prev.map(m => m.sender_user_id === myUserId && !m.is_read ? { ...m, is_read: true } : m)
      )
    }

    const onTyping = ({ thread_id, user_id, is_typing }) => {
      if (thread_id !== threadId || user_id === myUserId) return
      setIsTyping(is_typing)
      if (is_typing) {
        clearTimeout(typingClearRef.current)
        typingClearRef.current = setTimeout(() => setIsTyping(false), TYPING_CLEAR_MS)
        shouldScrollRef.current = true
      } else {
        clearTimeout(typingClearRef.current)
      }
    }

    socket.on(SOCKET_EVENTS.NEW_MESSAGE,    onNewMessage)
    socket.on(SOCKET_EVENTS.MESSAGES_READ,  onMessagesRead)
    socket.on(SOCKET_EVENTS.TYPING,         onTyping)

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_THREAD, { thread_id: threadId })
      socket.off(SOCKET_EVENTS.NEW_MESSAGE,   onNewMessage)
      socket.off(SOCKET_EVENTS.MESSAGES_READ, onMessagesRead)
      socket.off(SOCKET_EVENTS.TYPING,        onTyping)
      clearTimeout(typingClearRef.current)
    }
  }, [socket, threadId, myUserId])

  function handleLoadMore() {
    if (!nextBefore || loadingMoreRef.current) return
    setLoadingMore(true)
    loadingMoreRef.current = true
    fetchMessages(threadId, { before: nextBefore })
      .then(data => {
        const older = data.messages ?? []
        setMessages(prev => {
          const existingIds = new Set(prev.filter(m => m.id != null).map(m => m.id))
          return [...older.filter(m => !existingIds.has(m.id)), ...prev]
        })
        setHasMore(data.has_more)
        setNextBefore(data.next_before)
      })
      .catch(() => {})
      .finally(() => {
        setLoadingMore(false)
        loadingMoreRef.current = false
      })
  }

  return {
    thread, messages, setMessages,
    loading, msgError,
    hasMore, loadingMore, handleLoadMore,
    isTyping,
    shouldScrollRef,
    loadingMoreRef,
  }
}
