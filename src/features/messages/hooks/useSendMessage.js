import { useRef } from 'react'
import { sendMessage } from '../services/messagesApi'
import { SEND_MAX_ATTEMPTS, SEND_RETRY_DELAY_MS } from '../constants'
import { SOCKET_EVENTS } from '../services/messagesSocket'

export function useSendMessage({ threadId, myUserId, myRole, socket, setMessages, shouldScrollRef }) {
  const tempIdRef      = useRef(0)
  const retryTimersRef = useRef({})
  const typingTimerRef = useRef(null)

  function sendWithRetry(content, tempId, attempt = 0) {
    sendMessage(threadId, content)
      .then(serverMsg => {
        clearTimeout(retryTimersRef.current[tempId])
        delete retryTimersRef.current[tempId]
        setMessages(prev => {
          if (prev.some(m => m.id === serverMsg.id)) {
            return prev.filter(m => m._tempId !== tempId)
          }
          shouldScrollRef.current = true
          return prev.map(m => m._tempId === tempId ? serverMsg : m)
        })
      })
      .catch(err => {
        if (attempt < SEND_MAX_ATTEMPTS - 1) {
          const retryLabel = ` (第${attempt + 2}次)`
          setMessages(prev =>
            prev.map(m => m._tempId === tempId
              ? { ...m, status: 'retrying', _retryLabel: retryLabel }
              : m
            )
          )
          retryTimersRef.current[tempId] = setTimeout(() => {
            sendWithRetry(content, tempId, attempt + 1)
          }, SEND_RETRY_DELAY_MS)
        } else {
          clearTimeout(retryTimersRef.current[tempId])
          delete retryTimersRef.current[tempId]
          const errMsg = err.response?.data?.message ?? '发送失败，请重试'
          setMessages(prev =>
            prev.map(m => m._tempId === tempId
              ? { ...m, status: 'failed', _errorMsg: errMsg, _retryLabel: undefined }
              : m
            )
          )
        }
      })
  }

  function handleSend(e, input, setInput) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    const tempId   = `_tmp_${++tempIdRef.current}`
    const localMsg = {
      _tempId:        tempId,
      id:             undefined,
      sender_user_id: myUserId,
      sender_role:    myRole,
      sender_name:    null,
      content:        text,
      created_at:     new Date().toISOString(),
      status:         'sending',
      is_read:        false,
    }
    shouldScrollRef.current = true
    setMessages(prev => [...prev, localMsg])
    setInput('')
    clearTimeout(typingTimerRef.current)
    if (socket) socket.emit(SOCKET_EVENTS.TYPING, { thread_id: threadId, is_typing: false })
    sendWithRetry(text, tempId, 0)
  }

  function handleRetry(tempId, content) {
    shouldScrollRef.current = true
    setMessages(prev =>
      prev.map(m => m._tempId === tempId
        ? { ...m, status: 'sending', _errorMsg: undefined, _retryLabel: undefined }
        : m
      )
    )
    sendWithRetry(content, tempId, 0)
  }

  function handleInputChange(value, setInput) {
    setInput(value)
    if (!socket) return
    socket.emit(SOCKET_EVENTS.TYPING, { thread_id: threadId, is_typing: true })
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.TYPING, { thread_id: threadId, is_typing: false })
    }, 1000)
  }

  function cleanup() {
    Object.values(retryTimersRef.current).forEach(clearTimeout)
    clearTimeout(typingTimerRef.current)
  }

  return { handleSend, handleRetry, handleInputChange, cleanup }
}
