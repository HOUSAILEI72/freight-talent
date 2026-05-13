import { CheckCircle, XCircle, Hourglass } from 'lucide-react'

export const INV_STATUS = {
  pending:  { label: '待回复', Icon: Hourglass,   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  accepted: { label: '已接受', Icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  declined: { label: '已婉拒', Icon: XCircle,     cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export const INV_STATUS_TERMINAL_STYLE = {
  pending:  { background: 'rgba(96, 165, 250, 0.12)', color: 'var(--t-chart-blue)', borderColor: 'var(--t-chart-blue)' },
  accepted: { background: 'rgba(34, 197, 94, 0.12)',  color: 'var(--t-success)',    borderColor: 'var(--t-success)' },
  declined: { background: 'var(--t-bg-elevated)',     color: 'var(--t-text-muted)', borderColor: 'var(--t-border)' },
}

export const SEND_MAX_ATTEMPTS = 3
export const SEND_RETRY_DELAY_MS = 2000
export const POLL_MESSAGES_INTERVAL_MS = 30000
export const POLL_CONVERSATIONS_INTERVAL_MS = 60000
export const TYPING_DEBOUNCE_MS = 1000
export const TYPING_CLEAR_MS = 3000
