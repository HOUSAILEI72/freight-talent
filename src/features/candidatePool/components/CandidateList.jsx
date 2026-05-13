import { Loader2, AlertCircle, FolderOpen } from 'lucide-react'
import { CandidateListItem } from './CandidateListItem'
import { CandidateResultCard } from './CandidateResultCard'

export function CandidateList({
  loading, error, candidates, filteredCandidates,
  selected, selectedJob, invited, archivedSet, hasSubscription,
  archiveFilter, inviteFilter, terminal,
  variant,          // 'wide' → CandidateResultCard in padded wrapper; default → CandidateListItem
  onSelect, onArchive, onInvite,
  navigateBasePath, // for variant==='wide'
}) {
  const muted  = terminal ? { color: 'var(--t-text-muted)' } : undefined
  const danger = terminal ? { color: 'var(--t-danger)' } : undefined

  if (loading) return (
    <div
      className={terminal
        ? 'flex items-center justify-center gap-2 py-16'
        : 'flex items-center justify-center gap-2 py-16 text-slate-400'}
      style={muted}
    >
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">加载中...</span>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <AlertCircle size={24} className={terminal ? 'mb-2' : 'text-red-300 mb-2'} style={danger} />
      <p className={terminal ? 'text-xs text-center' : 'text-xs text-red-500 text-center'} style={danger}>{error}</p>
    </div>
  )

  if (candidates.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <FolderOpen size={28} className={terminal ? 'mb-2' : 'text-slate-300 mb-2'} style={muted} />
      <p className={terminal ? 'text-xs text-center' : 'text-xs text-slate-400 text-center'} style={muted}>
        暂无匹配候选人
      </p>
    </div>
  )

  if (filteredCandidates.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <FolderOpen size={28} className={terminal ? 'mb-2' : 'text-slate-300 mb-2'} style={muted} />
      <p className={terminal ? 'text-xs text-center' : 'text-xs text-slate-400 text-center'} style={muted}>
        {(archiveFilter !== 'all' || inviteFilter !== 'all') ? '无符合条件的候选人' : '暂无匹配候选人'}
      </p>
    </div>
  )

  // ── wide card list (terminal variant) ──────────────────────────────────
  if (variant === 'wide') {
    return (
      <div className="px-5 py-4 space-y-3">
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

  // ── default compact list (public light mode) ────────────────────────────
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
