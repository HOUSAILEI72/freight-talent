import { User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { InviteModal } from '../../components/ui/InviteModal'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import Pagination from '../../components/ui/Pagination'
import { useCandidatePool } from './hooks/useCandidatePool'
import { useCandidateFilters } from './hooks/useCandidateFilters'
import { useCandidateArchive } from './hooks/useCandidateSelection'
import { useCandidateInvite } from './hooks/useCandidateInvite'
import { CandidateFilterBar } from './components/CandidateFilterBar'
import { CandidateList } from './components/CandidateList'
import { CandidateDetailPanel } from './components/CandidateDetailPanel'
import { Toast } from './components/Toast'
import { useState, useEffect } from 'react'

export default function CandidatePoolPage({ terminal = false, messagesBasePath }) {
  const pool    = useCandidatePool()
  const filters = useCandidateFilters()
  const archive = useCandidateArchive()
  const invite  = useCandidateInvite({ selectedJob: pool.selectedJob, markInvited: pool.markInvited })
  const navigate = useNavigate()

  const [selected, setSelected] = useState(null)
  // Keep latest filters so pagination buttons can re-fetch with same params
  const lastFiltersRef = useRef({ availability_status: 'open' })

  // Auto-select first candidate when list loads (only for non-terminal inline view)
  useEffect(() => {
    if (!terminal && pool.candidates.length > 0 && !selected) setSelected(pool.candidates[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.candidates])

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    const f = filters.buildFilters()
    lastFiltersRef.current = f
    pool.fetchCandidates(f, 1)
  }

  function handleReset() {
    filters.resetFilters()
    setSelected(null)
    const f = { availability_status: 'open' }
    lastFiltersRef.current = f
    pool.fetchCandidates(f, 1)
  }

  function handleLocationChange(loc) {
    filters.setLocation(loc)
    setSelected(null)
    const f = filters.buildFilters({ location: loc })
    lastFiltersRef.current = f
    pool.fetchCandidates(f, 1)
  }

  function handleFunctionChange(code) {
    filters.setFunctionCode(code)
    setSelected(null)
    const f = filters.buildFilters({ fn: code })
    lastFiltersRef.current = f
    pool.fetchCandidates(f, 1)
  }

  function handleGenderChange(g) {
    filters.setGender(g)
    setSelected(null)
    const f = filters.buildFilters({ gender: g })
    lastFiltersRef.current = f
    pool.fetchCandidates(f, 1)
  }

  function handlePageChange(p) {
    setSelected(null)
    pool.fetchCandidates(lastFiltersRef.current, p)
  }

  const filteredCandidates = pool.candidates.filter(c => {
    const isArch = archive.archivedSet.has(c.id)
    const invKey = pool.selectedJob ? `${pool.selectedJob.id}_${c.id}` : null
    const isInv  = invKey ? !!pool.invited[invKey] : false
    if (filters.archiveFilter === 'archived'     && !isArch) return false
    if (filters.archiveFilter === 'not_archived' &&  isArch) return false
    if (filters.inviteFilter  === 'invited'      && !isInv)  return false
    if (filters.inviteFilter  === 'not_invited'  &&  isInv)  return false
    return true
  })

  const selectedInvKey = pool.selectedJob && selected ? `${pool.selectedJob.id}_${selected.id}` : null

  const filterBarProps = {
    q: filters.q, setQ: filters.setQ,
    avail: filters.avail, setAvail: filters.setAvail,
    location: filters.location, onLocationChange: handleLocationChange,
    functionCode: filters.functionCode, onFunctionChange: handleFunctionChange,
    gender: filters.gender, setGender: handleGenderChange,
    archiveFilter: filters.archiveFilter, setArchiveFilter: filters.setArchiveFilter,
    inviteFilter: filters.inviteFilter, setInviteFilter: filters.setInviteFilter,
    hasFilter: filters.hasFilter,
    onSearch: handleSearch, onReset: handleReset,
    myJobs: pool.myJobs, selectedJob: pool.selectedJob, setSelectedJob: pool.setSelectedJob,
    jobsReady: pool.jobsReady,
    loading: pool.loading, candidates: pool.candidates, total: pool.total,
    terminal,
  }

  const listProps = {
    loading: pool.loading, error: pool.error,
    candidates: pool.candidates, filteredCandidates,
    selected, selectedJob: pool.selectedJob,
    invited: pool.invited, archivedSet: archive.archivedSet,
    hasSubscription: pool.hasSubscription,
    archiveFilter: filters.archiveFilter, inviteFilter: filters.inviteFilter,
    terminal,
    onArchive: archive.handleArchive,
    onInvite: invite.setModal,
  }

  // ── Terminal layout: filter sidebar + wide card list ─────────────────────
  if (terminal) {
    return (
      <>
        {invite.modal && pool.selectedJob && (
          <InviteModal
            candidate={invite.modal}
            job={pool.selectedJob}
            onConfirm={invite.handleConfirm}
            onCancel={() => invite.setModal(null)}
            terminal
          />
        )}
        {invite.toast && <Toast name={invite.toast} onDone={() => invite.setToast(null)} />}

        <TerminalPageSurface split>
          {/* Left: filter sidebar only */}
          <aside
            className="w-72 flex-shrink-0 flex flex-col overflow-y-auto terminal-scrollbar"
            style={{ background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)' }}
          >
            <CandidateFilterBar {...filterBarProps} />
          </aside>

          {/* Right: wide card list */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: 'var(--t-bg)' }}>
            <div className="flex-1 overflow-y-auto terminal-scrollbar">
              <CandidateList
                {...listProps}
                variant="wide"
                navigateBasePath="/employer/candidates"
                onSelect={() => {}}
              />
            </div>
            <Pagination
              page={pool.page}
              totalPages={pool.totalPages}
              onPageChange={handlePageChange}
              terminal
            />
          </main>
        </TerminalPageSurface>
      </>
    )
  }

  // ── Public light layout: unchanged ───────────────────────────────────────
  const leftPanel = (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
      <CandidateFilterBar {...filterBarProps} />
      <div className="flex-1 overflow-y-auto">
        <CandidateList
          {...listProps}
          onSelect={setSelected}
        />
      </div>
      <Pagination
        page={pool.page}
        totalPages={pool.totalPages}
        onPageChange={handlePageChange}
        terminal={false}
      />
    </div>
  )

  const rightPanel = (
    <div className="flex-1 overflow-y-auto">
      {selected ? (
        <CandidateDetailPanel
          candidate={selected}
          isInvited={selectedInvKey ? !!pool.invited[selectedInvKey] : false}
          terminal={false}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-400">
          <div className="text-center">
            <User size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm">点击左侧候选人查看详情</p>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {invite.modal && pool.selectedJob && (
        <InviteModal
          candidate={invite.modal}
          job={pool.selectedJob}
          onConfirm={invite.handleConfirm}
          onCancel={() => invite.setModal(null)}
          terminal={false}
        />
      )}
      {invite.toast && <Toast name={invite.toast} onDone={() => invite.setToast(null)} />}
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">{leftPanel}{rightPanel}</div>
    </>
  )
}

