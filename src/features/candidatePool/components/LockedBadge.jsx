import { Lock } from 'lucide-react'

export function LockedBadge({ terminal }) {
  if (terminal) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5"
        style={{
          color: 'var(--t-text-muted)',
          background: 'var(--t-bg-elevated)',
          border: '1px solid var(--t-border)',
          borderRadius: 'var(--t-radius-sm)',
        }}
      >
        <Lock size={9} />LOCKED
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600 border border-amber-200">
      <Lock size={9} />订阅后可见
    </span>
  )
}

export function LockedSection({ label, terminal }) {
  if (terminal) {
    return (
      <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: '12px' }}>
        <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--t-text-muted)' }}>
          {label}
        </p>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded"
          style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)' }}
        >
          <Lock size={12} style={{ color: 'var(--t-text-muted)' }} />
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
            LOCKED — 订阅后可见
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-sm font-semibold text-slate-800 mb-2">{label}</p>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
        <Lock size={13} className="text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-700">订阅后可见</span>
      </div>
    </div>
  )
}
