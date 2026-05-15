import { useSearchParams } from 'react-router-dom'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import CandidateProfile from './CandidateProfile'
import CandidateProfileBuilder from './CandidateProfileBuilder'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { id: 'view', label: 'VIEW' },
  { id: 'edit', label: 'EDIT' },
]

export default function TerminalCandidateProfile() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'view'
  const { user } = useAuth()

  function setTab(t) {
    setSearchParams(t === 'view' ? {} : { tab: t }, { replace: true })
  }

  return (
    <TerminalLayout title="PROFILE" activeIconId="profile" navItems={CANDIDATE_ICON_NAV}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Sub-header: username + role badge */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5">
          <div className="flex items-center gap-3">
            <span className="font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
              PROFILE
            </span>
            {user?.name && (
              <span className="font-[var(--t-font-sans)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)] truncate">
                {user.name}
              </span>
            )}
          </div>
          <span className="rounded border border-[var(--t-border)] px-2 py-0.5 font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
            Candidate
          </span>
        </div>

        {/* Tab strip */}
        <div className="flex h-9 shrink-0 items-center border-b border-[var(--t-border-subtle)] px-1">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex h-full items-center px-5 font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] border-b-2 transition-colors duration-[var(--t-transition)] ${
                tab === t.id
                  ? 'border-[color:var(--t-primary)] text-[color:var(--t-text)]'
                  : 'border-transparent text-[color:var(--t-text-muted)] hover:text-[color:var(--t-text-secondary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content — only one branch mounted at a time */}
        {tab === 'view' ? (
          <CandidateProfile viewMode="self" terminal onEdit={() => setTab('edit')} />
        ) : (
          <CandidateProfileBuilder terminal onDone={() => setTab('view')} />
        )}
      </div>
    </TerminalLayout>
  )
}

