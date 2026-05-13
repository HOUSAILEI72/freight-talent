import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const STYLES = {
  success: 'border-emerald-500/30 bg-emerald-900/80 text-emerald-100',
  error:   'border-red-500/30 bg-red-900/80 text-red-100',
  info:    'border-blue-500/30 bg-blue-900/80 text-blue-100',
  warning: 'border-amber-500/30 bg-amber-900/80 text-amber-100',
}

let _nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_nextId
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => remove(id), duration)
    }
    return id
  }, [remove])

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ show, remove }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-sm max-w-sm transition-all duration-300 ${STYLES[t.type]}`}
              role="alert"
            >
              <Icon size={16} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="关闭"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
