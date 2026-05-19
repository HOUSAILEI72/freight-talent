import { User, MessageSquare, X, ChevronRight } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import Pagination from '../../components/ui/Pagination'
import { useCandidatePool } from './hooks/useCandidatePool'
import { useCandidateFilters } from './hooks/useCandidateFilters'
import { useCandidateArchive } from './hooks/useCandidateSelection'
import { CandidateFilterBar } from './components/CandidateFilterBar'
import { CandidateList } from './components/CandidateList'
import { CandidateDetailPanel } from './components/CandidateDetailPanel'
import { CandidatePoolRail } from './components/CandidatePoolRail'
import { CandidateChatModal } from './components/CandidateChatModal'
import { CandidateConversationDock } from './components/CandidateConversationDock'
import { CandidateMiniChatWindow } from './components/CandidateMiniChatWindow'
import { CANDIDATE_POOL_TABS } from './constants'
import { conversationsApi } from '../../api/conversations'

function QuotaBar({ used, limit }) {
  const pct = Math.min(100, (used / limit) * 100)
  const color = pct >= 90 ? 'var(--t-danger)' : pct >= 70 ? 'var(--t-warning)' : 'var(--t-primary)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--t-text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        主动沟通
      </span>
      <div style={{ width: 72, height: 4, background: 'var(--t-border)', borderRadius: 9999, flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 300ms' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' }}>{used}/{limit}</span>
    </div>
  )
}

export default function CandidatePoolPage({ terminal = false }) {
  const pool    = useCandidatePool()
  const filters = useCandidateFilters()
  const archive = useCandidateArchive()

  const [selected, setSelected] = useState(null)
  const [chatModal, setChatModal] = useState(null)    // { threadId, candidate, job } — public light only
  const [chatToast, setChatToast] = useState(null)
  const [activeDockConv,  setActiveDockConv]  = useState(null)  // terminal dock mini-chat
  const [dockCollapsed,   setDockCollapsed]   = useState(true)
  const [dockRefreshKey,  setDockRefreshKey]  = useState(0)
  const [dockOpen,        setDockOpen]        = useState(false)  // responsive drawer
  const [filterCollapsed, setFilterCollapsed] = useState(false)
  const filterAutoRef  = useRef(false)
  const dockElRef      = useRef(null)
  const lastFiltersRef = useRef({ availability_status: 'open' })
  const [expandBtnHovered, setExpandBtnHovered] = useState(false)

  useEffect(() => {
    if (!terminal && pool.candidates.length > 0 && !selected) setSelected(pool.candidates[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.candidates])

  // Auto-collapse filter sidebar when mini-chat opens or dock expands; auto-restore when both close
  useEffect(() => {
    if (!terminal) return
    const shouldCollapse = activeDockConv !== null || !dockCollapsed
    if (shouldCollapse) {
      filterAutoRef.current = true
      setFilterCollapsed(true)
    } else if (filterAutoRef.current) {
      filterAutoRef.current = false
      setFilterCollapsed(false)
    }
  }, [activeDockConv, dockCollapsed, terminal])

  function handleToggleFilter() {
    filterAutoRef.current = false
    setFilterCollapsed(v => !v)
  }

  function showToast(msg) {
    setChatToast(msg)
    setTimeout(() => setChatToast(null), 3000)
  }

  function handleJobChange(job) {
    pool.setSelectedJob(job)
    if (filters.poolType === 'applied') {
      setSelected(null)
      const f = filters.buildFilters({ job_id: job?.id })
      lastFiltersRef.current = f
      pool.fetchCandidates(f, 1)
    }
  }

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

  async function handleOpenConversation(candidate) {
    if (!pool.selectedJob) {
      showToast('请先选择沟通岗位')
      return
    }

    const invKey  = `${pool.selectedJob.id}_${candidate.id}`
    const existing = pool.invited[invKey]

    function buildConvFromCandidate(threadId) {
      return {
        threadId,
        candidateId:     candidate.id,
        candidateName:   candidate.full_name,
        candidateInitial: (candidate.full_name?.[0] ?? '?').toUpperCase(),
        jobId:           pool.selectedJob?.id ?? null,
        jobTitle:        pool.selectedJob?.title ?? null,
      }
    }

    if (typeof existing === 'number') {
      if (terminal) {
        setActiveDockConv(buildConvFromCandidate(existing))
      } else {
        setChatModal({ threadId: existing, candidate, job: pool.selectedJob })
      }
      return
    }

    try {
      const res = await conversationsApi.openConversation({
        jobId: pool.selectedJob.id,
        candidateId: candidate.id,
      })
      const threadId = res.data.thread_id
      pool.markInvited(pool.selectedJob.id, candidate.id, threadId)
      if (terminal) {
        setActiveDockConv(buildConvFromCandidate(threadId))
        setDockRefreshKey(k => k + 1)   // 新建会话后刷新 Dock 列表
      } else {
        setChatModal({ threadId, candidate, job: pool.selectedJob })
      }
    } catch (err) {
      showToast(err.response?.data?.message || '打开沟通失败')
    }
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
    myJobs: pool.myJobs, selectedJob: pool.selectedJob, setSelectedJob: handleJobChange,
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
    onOpenConversation: handleOpenConversation,
  }

  const chatToastEl = chatToast ? (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-sm font-medium">
      {chatToast}
    </div>
  ) : null

  // ── Terminal layout ───────────────────────────────────────────────────────
  if (terminal) {
    return (
      <>
        {activeDockConv && (
          <CandidateMiniChatWindow
            key={activeDockConv.threadId}
            activeDockConv={activeDockConv}
            dockElRef={dockElRef}
            onClose={() => {
              setActiveDockConv(null)
              setDockRefreshKey(k => k + 1)   // 关闭时刷新一次未读数
            }}
            onReadDone={() => setDockRefreshKey(k => k + 1)}
          />
        )}
        {chatToastEl}

        <TerminalPageSurface split>
          <CandidatePoolRail
            value={filters.poolType}
            onChange={(next) => {
              filters.setPoolType(next)
              setSelected(null)
              const jobId = next === 'applied' && pool.selectedJob ? pool.selectedJob.id : undefined
              const f = filters.buildFilters({ poolType: next, job_id: jobId })
              lastFiltersRef.current = f
              pool.fetchCandidates(f, 1)
            }}
            counts={pool.poolCounts}
          />

          <aside
            className={`terminal-filter-sidebar${filterCollapsed ? ' terminal-filter-sidebar--collapsed' : ''}`}
            style={{ background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)' }}
          >
            {filterCollapsed ? (
              <button
                type="button"
                title="展开筛选"
                className="terminal-filter-expand-btn"
                onClick={handleToggleFilter}
                onMouseEnter={() => setExpandBtnHovered(true)}
                onMouseLeave={() => setExpandBtnHovered(false)}
                style={{
                  background: expandBtnHovered ? 'var(--t-bg-hover)' : 'transparent',
                  color: expandBtnHovered ? 'var(--t-text)' : 'var(--t-text-muted)',
                }}
              >
                <ChevronRight size={14} />
              </button>
            ) : (
              <div className="flex-1 overflow-y-auto terminal-scrollbar">
                <CandidateFilterBar
                  {...filterBarProps}
                  activePoolLabel={CANDIDATE_POOL_TABS.find(t => t.key === filters.poolType)?.label}
                  onCollapse={handleToggleFilter}
                />
              </div>
            )}
          </aside>

          <main className="terminal-candidate-list-container flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.035) 0%, var(--t-bg) 200px), var(--t-bg)' }}>
            {/* Quota + dock trigger strip */}
            <div className="terminal-candidate-dock-trigger-row" style={{ justifyContent: 'space-between', paddingRight: 12 }}>
              <button
                type="button"
                className="terminal-candidate-dock-trigger"
                onClick={() => setDockOpen(true)}
              >
                <MessageSquare size={13} />
                沟通列表
              </button>
              {pool.quota?.has_active && (
                <QuotaBar
                  used={pool.quota.contacts.used}
                  limit={pool.quota.contacts.limit}
                />
              )}
            </div>
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

          {/* Desktop dock — hidden at ≤1535px */}
          <div className="terminal-candidate-dock-desktop">
            <CandidateConversationDock
              activeThreadId={activeDockConv?.threadId ?? null}
              onSelect={setActiveDockConv}
              onCollapsedChange={setDockCollapsed}
              refreshKey={dockRefreshKey}
              onDockRef={(el) => { dockElRef.current = el }}
            />
          </div>
        </TerminalPageSurface>

        {/* Responsive drawer — visible at ≤1535px */}
        {dockOpen && (
          <div
            className="terminal-candidate-dock-overlay"
            onClick={() => setDockOpen(false)}
          >
            <aside
              className="terminal-candidate-dock-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="terminal-candidate-dock-drawer-header">
                <span>沟通列表</span>
                <button
                  type="button"
                  onClick={() => setDockOpen(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="terminal-candidate-dock-drawer-body">
                <CandidateConversationDock
                  activeThreadId={activeDockConv?.threadId ?? null}
                  onSelect={(conv) => { setActiveDockConv(conv); setDockOpen(false) }}
                  onCollapsedChange={setDockCollapsed}
                  refreshKey={dockRefreshKey}
                />
              </div>
            </aside>
          </div>
        )}
      </>
    )
  }

  // ── Public light layout ───────────────────────────────────────────────────
  const leftPanel = (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
      <CandidateFilterBar {...filterBarProps} />
      <div className="flex-1 overflow-y-auto">
        <CandidateList {...listProps} onSelect={setSelected} />
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
          onApplicationStatusChange={(candId, _appId, nextStatus) => {
            pool.setCandidates(prev => prev.map(c =>
              c.id === candId ? { ...c, application_status: nextStatus } : c
            ))
            setSelected(prev => prev?.id === candId ? { ...prev, application_status: nextStatus } : prev)
          }}
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
      {chatModal && (
        <CandidateChatModal
          threadId={chatModal.threadId}
          candidate={chatModal.candidate}
          job={chatModal.job}
          terminal={false}
          onClose={() => setChatModal(null)}
        />
      )}
      {chatToastEl}
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">{leftPanel}{rightPanel}</div>
    </>
  )
}
