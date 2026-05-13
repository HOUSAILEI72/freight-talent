import { Loader2, AlertCircle } from 'lucide-react'

export function MessageLoadingState({ terminal }) {
  return (
    <div className="flex-1 flex items-center justify-center gap-2" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
      <Loader2 size={20} className={terminal ? 'animate-spin' : 'animate-spin text-slate-400'} />
      <span className={terminal ? 'text-sm' : 'text-sm text-slate-400'}>加载消息...</span>
    </div>
  )
}

export function MessageErrorState({ error, terminal }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
      <AlertCircle size={28} style={terminal ? { color: 'var(--t-danger)' } : undefined} className={terminal ? '' : 'text-red-300'} />
      <p className="text-sm" style={terminal ? { color: 'var(--t-danger)' } : undefined}>
        {error}
      </p>
    </div>
  )
}
