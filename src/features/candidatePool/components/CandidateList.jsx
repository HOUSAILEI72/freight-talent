import { Loader2, AlertCircle, FolderOpen } from 'lucide-react'
import { CandidateListItem } from './CandidateListItem'
import { CandidateResultCard } from './CandidateResultCard'

function EmptyState({ terminal, text }) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={terminal
        ? { padding: '64px 24px', gap: 10 }
        : { padding: '64px 24px', gap: 8 }
      }
    >
      <FolderOpen
        size={terminal ? 24 : 28}
        style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#cbd5e1' }}
      />
      {terminal ? (
        <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--t-text-muted)' }}>
          {text}
        </span>
      ) : (
        <p className="text-xs text-slate-400 text-center">{text}</p>
      )}
    </div>
  )
}

export function CandidateList({
  loading, error, candidates, filteredCandidates,
  selected, selectedJob, invited, archivedSet, hasSubscription,
  archiveFilter, inviteFilter, terminal,
  variant,
  onSelect, onArchive, onInvite,
  navigateBasePath,
}) {
  if (loading) return (
    <div
      className="flex items-center justify-center gap-2"
      style={terminal
        ? { padding: '64px 24px', color: 'var(--t-text-muted)' }
        : { padding: '64px 24px', color: '#94a3b8' }
      }
    >
      <Loader2 size={15} className="animate-spin" style={terminal ? { color: 'var(--t-primary)' } : undefined} />
      {terminal ? (
        <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, letterSpacing: '0.06em', color: 'var(--t-text-muted)' }}>
          LOADING...
        </span>
      ) : (
        <span className="text-sm">加载中...</span>
      )}
    </div>
  )

  if (error) return (
    <div
      className="flex flex-col items-center justify-center"
      style={terminal
        ? { padding: '64px 24px', gap: 8 }
        : { padding: '64px 24px', gap: 6 }
      }
    >
      <AlertCircle
        size={20}
        style={terminal ? { color: 'var(--t-danger)' } : { color: '#fca5a5' }}
      />
      <p
        className="text-xs text-center"
        style={terminal ? { color: 'var(--t-danger)', maxWidth: 240 } : { color: '#ef4444', maxWidth: 240 }}
      >
        {error}
      </p>
    </div>
  )

  if (candidates.length === 0) return (
    <EmptyState terminal={terminal} text={terminal ? 'NO CANDIDATES' : '暂无候选人'} />
  )

  if (filteredCandidates.length === 0) return (
    <EmptyState
      terminal={terminal}
      text={terminal
        ? ((archiveFilter !== 'all' || inviteFilter !== 'all') ? 'NO MATCH' : 'NO CANDIDATES')
        : ((archiveFilter !== 'all' || inviteFilter !== 'all') ? '无符合条件的候选人' : '暂无匹配候选人')
      }
    />
  )

  // ── wide card grid (terminal variant) ──────────────────────────────────────
  if (variant === 'wide') {
    return (
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredCandidates.map(c => {
          const invKey     = selectedJob ? `${selectedJob.id}_${c.id}` : null
          const isInvited  = invKey ? !!invited[invKey] : false
          const isArchived = archivedSet.has(c.id)
          const canInvite  = !!selectedJob && !isInvited && hasSubscription
          return (
            <CandidateResultCard
              key={c.id}
              c={c}
              isInvited={isInvited}
              isArchived={isArchived}
              canInvite={canInvite}
              selectedJob={selectedJob}
              onArchive={onArchive}
              onInvite={onInvite}
              navigatePath={`${navigateBasePath ?? '/employer/candidates'}/${c.id}`}
            />
          )
        })}
      </div>
    )
  }

  // ── default compact list (public light mode) ────────────────────────────────
  return (
    <>
      {filteredCandidates.map(c => {
        const invKey     = selectedJob ? `${selectedJob.id}_${c.id}` : null
        const isInvited  = invKey ? !!invited[invKey] : false
        const isArchived = archivedSet.has(c.id)
        const canInvite  = !!selectedJob && !isInvited && hasSubscription
        return (
          <CandidateListItem
            key={c.id}
            c={c}
            isSelected={selected?.id === c.id}
            isInvited={isInvited}
            isArchived={isArchived}
            canInvite={canInvite}
            terminal={terminal}
            onSelect={() => onSelect(c)}
            onArchive={onArchive}
            onInvite={onInvite}
          />
        )
      })}
    </>
  )
}
