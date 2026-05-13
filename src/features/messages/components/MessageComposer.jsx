import { Send } from 'lucide-react'
import { Button } from '../../../components/ui/Button'

export function MessageComposer({ input, onChange, onSubmit, terminal }) {
  return (
    <form
      onSubmit={onSubmit}
      className={terminal ? 'px-4 py-3 flex-shrink-0' : 'px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0'}
      style={terminal ? { borderTop: '1px solid var(--t-border-subtle)', background: 'var(--t-bg-panel)' } : undefined}
    >
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
          value={input}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e) }
          }}
          className={terminal
            ? 'flex-1 px-3 py-2 text-sm rounded-xl focus:outline-none resize-none'
            : 'flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none'
          }
          style={terminal ? { background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)' } : undefined}
        />
        <Button type="submit" size="sm" disabled={!input.trim()} className="flex-shrink-0">
          <Send size={13} />发送
        </Button>
      </div>
    </form>
  )
}
