import { useState, useEffect, useRef } from 'react'
import { Briefcase, FileText, Paperclip, GraduationCap, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { INV_STATUS, INV_STATUS_TERMINAL_STYLE } from '../constants'
import { candidatesApi } from '../../../api/candidates'

function InvBadge({ status, terminal = false }) {
  const cfg = INV_STATUS[status] ?? INV_STATUS.pending
  const { Icon } = cfg
  if (terminal) {
    const style = INV_STATUS_TERMINAL_STYLE[status] ?? INV_STATUS_TERMINAL_STYLE.pending
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border" style={style}>
        <Icon size={11} />{cfg.label}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

function JobSelector({ threads, activeId, onSelect, terminal }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })
  const ref        = useRef(null)
  const triggerRef = useRef(null)
  const multi = threads.length > 1
  const activeThread = threads.find(t => t.id === activeId)

  useEffect(() => {
    if (!open) return
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle() {
    if (!multi) return
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(v => !v)
  }

  return (
    <div className="inline-flex" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        className="text-xs flex items-center gap-1.5 rounded-full border px-2.5 py-1"
        style={terminal ? {
          color: open ? 'var(--t-text)' : 'var(--t-text-secondary)',
          borderColor: open ? 'var(--t-primary)' : 'var(--t-border)',
          background: open ? 'var(--t-primary-muted)' : 'transparent',
          cursor: multi ? 'pointer' : 'default',
          transition: 'background 120ms, border-color 120ms, color 120ms',
        } : {
          color: open ? '#1e40af' : '#475569',
          borderColor: open ? '#3b82f6' : '#cbd5e1',
          background: open ? '#eff6ff' : '#fff',
          cursor: multi ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => {
          if (!multi || open) return
          if (terminal) { e.currentTarget.style.borderColor = 'var(--t-text-muted)'; e.currentTarget.style.color = 'var(--t-text)'; e.currentTarget.style.background = 'var(--t-bg-hover)' }
          else { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc' }
        }}
        onMouseLeave={(e) => {
          if (!multi || open) return
          if (terminal) { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)'; e.currentTarget.style.background = 'transparent' }
          else { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#fff' }
        }}
      >
        <Briefcase size={11} className="flex-shrink-0 opacity-60" />
        <span className="truncate max-w-[180px]">{activeThread?.job_title || '—'}</span>
        {multi && (
          <svg width="10" height="10" viewBox="0 0 10 10" className="flex-shrink-0 opacity-50" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}>
            <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && multi && (
        <div
          className={terminal ? 'fixed z-[9999] rounded-lg overflow-hidden' : 'fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden'}
          style={{
            top: pos.top, left: pos.left, minWidth: 200,
            ...(terminal ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' } : {}),
          }}
        >
          <div className="py-1 terminal-scrollbar" style={{ maxHeight: 240, overflowY: 'auto' }}>
            {threads.map(t => (
              <button
                key={t.id} type="button"
                onClick={() => { onSelect(t.id); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                style={terminal
                  ? { color: t.id === activeId ? 'var(--t-text)' : 'var(--t-text-secondary)', background: t.id === activeId ? 'var(--t-bg-active)' : 'transparent', transition: 'background 100ms' }
                  : { color: t.id === activeId ? '#1e293b' : '#475569', background: t.id === activeId ? '#eff6ff' : 'transparent' }
                }
                onMouseEnter={(e) => { if (t.id !== activeId) e.currentTarget.style.background = terminal ? 'var(--t-bg-hover)' : '#f8fafc' }}
                onMouseLeave={(e) => { if (t.id !== activeId) e.currentTarget.style.background = t.id === activeId ? (terminal ? 'var(--t-bg-active)' : '#eff6ff') : 'transparent' }}
              >
                {t.id === activeId ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" style={{ color: terminal ? 'var(--t-primary)' : '#3b82f6' }}>
                    <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <span className="w-3 flex-shrink-0" />}
                <span className="truncate flex-1">{t.job_title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Terminal BOSS-style header ──────────────────────────────────────────────
function TerminalConvHeader({ thread, threadId, threads, onSwitchThread, myRole }) {
  const navigate    = useNavigate()
  const otherName   = thread?.candidate_name ?? thread?.company_name
  const isEmployer  = myRole === 'employer' || myRole === 'admin'
  const candidateId = thread?.candidate_id
  const activeThread = threads.find(t => t.id === threadId) ?? thread

  // Fetch candidate profile (employer/admin only)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  useEffect(() => {
    if (!candidateId || !isEmployer) { setProfile(null); return }
    setLoadingProfile(true)
    candidatesApi.getCandidatePublicProfile(candidateId)
      .then(r => setProfile(r.data?.candidate ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false))
  }, [candidateId, isEmployer])

  // Resume viewer state
  const [resumeUrl,     setResumeUrl]     = useState(null)  // blob URL for PDF modal
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeError,   setResumeError]   = useState(null)

  useEffect(() => () => { if (resumeUrl) URL.revokeObjectURL(resumeUrl) }, [resumeUrl])

  async function handleViewResume() {
    if (resumeLoading) return
    setResumeError(null)
    const fileName = profile?.resume_file_name
    const ext = fileName?.split('.').pop()?.toLowerCase() ?? ''
    if (!candidateId || !fileName) return
    setResumeLoading(true)
    try {
      const res = await candidatesApi.getCandidateResume(candidateId)
      const blob = res.data
      const url  = URL.createObjectURL(blob)
      if (ext === 'pdf') {
        if (resumeUrl) URL.revokeObjectURL(resumeUrl)
        setResumeUrl(url)
      } else {
        // DOC/DOCX — trigger download
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setResumeError(err.response?.data?.message ?? '简历加载失败')
      setTimeout(() => setResumeError(null), 3000)
    } finally {
      setResumeLoading(false)
    }
  }

  function closeResumeModal() { if (resumeUrl) URL.revokeObjectURL(resumeUrl); setResumeUrl(null) }

  // Derived
  const latestWork = profile?.work_experiences?.[0] ?? null
  const latestEdu  = profile?.education_experiences?.[0] ?? null
  const workPeriod = latestWork
    ? (latestWork.period || [latestWork.start_month, latestWork.end_month || '至今'].filter(Boolean).join(' – '))
    : null
  const eduPeriod = latestEdu
    ? (latestEdu.period || [latestEdu.start_month, latestEdu.end_month || '至今'].filter(Boolean).join(' – '))
    : null

  const freshnessActive = profile?.freshness_days != null && profile.freshness_days <= 14
  const freshnessLabel  = profile?.freshness_days != null
    ? (profile.freshness_days <= 1 ? '刚刚活跃' : profile.freshness_days <= 7 ? `近${profile.freshness_days}天活跃` : `近${profile.freshness_days}天活跃`)
    : null

  const expectedParts = [
    profile?.expected_city,
    profile?.job_type,
    profile?.expected_salary_label,
  ].filter(Boolean)

  // Fallback meta from thread when no private profile
  const threadFunction = activeThread?.function_name
  const threadCity     = activeThread?.city_name || activeThread?.province

  const dot = <span style={{ color: 'var(--t-border)', margin: '0 2px' }}>·</span>

  // Build personal attribute string: 29岁 · 6年经验 · 本科
  const personalAttrs = [
    profile?.age != null ? `${profile.age}岁` : null,
    profile?.experience_years != null
      ? `${profile.experience_years >= 10 ? profile.experience_years + '年以上' : profile.experience_years + '年经验'}`
      : null,
    profile?.education || null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{
      flexShrink: 0,
      borderBottom: '1px solid var(--t-border-subtle)',
      background: 'var(--t-bg-panel)',
      padding: '12px 20px 10px',
      position: 'relative',
    }}>

      {/* PDF viewer modal */}
      {resumeUrl && (
        <div
          onClick={closeResumeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.72)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(88vw, 920px)', height: '90vh',
              borderRadius: 12, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              background: 'var(--t-bg-elevated)',
              border: '1px solid var(--t-border)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Modal toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--t-border)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>
                {profile?.resume_file_name}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={resumeUrl}
                  download={profile?.resume_file_name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: 'var(--t-bg-hover)',
                    border: '1px solid var(--t-border)',
                    color: 'var(--t-text-secondary)', textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Paperclip size={12} />下载
                </a>
                <button
                  type="button"
                  onClick={closeResumeModal}
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6, border: 'none', background: 'var(--t-bg-hover)',
                    color: 'var(--t-text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              src={resumeUrl}
              title="附件简历"
              style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
            />
          </div>
        </div>
      )}

      {/* Resume error toast */}
      {resumeError && (
        <div className="terminal-mode" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '8px 18px', borderRadius: 10,
          background: 'var(--t-bg-elevated)', border: '1px solid var(--t-danger)',
          color: 'var(--t-danger)', fontSize: 13, fontWeight: 500,
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {resumeError}
        </div>
      )}

      {/* ── 2-column grid: right col auto-sized by button group so labels left-align ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, columnGap: 12, alignItems: 'center' }}>

        {/* Row 1 left: name + badges + attributes */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--t-text)', lineHeight: 1, flexShrink: 0 }}>
            {otherName ?? '—'}
          </span>

          {/* Freshness badge */}
          {freshnessLabel && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              fontSize: 11, padding: '2px 7px', borderRadius: 999,
              background: freshnessActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${freshnessActive ? 'var(--t-success)' : 'var(--t-border)'}`,
              color: freshnessActive ? 'var(--t-success)' : 'var(--t-text-muted)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: freshnessActive ? 'var(--t-success)' : 'var(--t-text-muted)' }} />
              {freshnessLabel}
            </span>
          )}

          {/* Invitation status badge */}
          {thread?.invitation_status && (
            <InvBadge status={thread.invitation_status} terminal />
          )}

          {/* Separator + personal attributes */}
          {loadingProfile ? (
            <div className="t-skeleton" style={{ width: 96, height: 11, flexShrink: 0 }} />
          ) : personalAttrs && (
            <>
              <span style={{ width: 1, height: 12, background: 'var(--t-border)', flexShrink: 0, borderRadius: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', flexShrink: 0 }}>
                {personalAttrs}
              </span>
            </>
          )}
        </div>

        {/* Row 1 right: 在线简历 / 附件简历 */}
        {isEmployer ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              disabled={!candidateId}
              onClick={() => candidateId && navigate(`/employer/candidates/${candidateId}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: candidateId ? 'var(--t-primary)' : 'var(--t-bg-elevated)',
                border: `1px solid ${candidateId ? 'var(--t-primary)' : 'var(--t-border)'}`,
                color: candidateId ? '#fff' : 'var(--t-text-muted)',
                cursor: candidateId ? 'pointer' : 'not-allowed',
                opacity: candidateId ? 1 : 0.5, transition: '120ms',
              }}
              onMouseEnter={e => { if (candidateId) e.currentTarget.style.background = 'var(--t-primary-hover)' }}
              onMouseLeave={e => { if (candidateId) e.currentTarget.style.background = 'var(--t-primary)' }}
            >
              <FileText size={13} />在线简历
            </button>

            {/* 附件简历：有文件时可点击 */}
            {(() => {
              const hasResume = !!profile?.resume_file_name
              const isPdf    = profile?.resume_file_name?.split('.').pop()?.toLowerCase() === 'pdf'
              const btnLabel = resumeLoading ? '加载中…' : (isPdf ? '附件简历' : (hasResume ? '下载简历' : '附件简历'))
              return (
                <button
                  type="button"
                  disabled={!hasResume || resumeLoading}
                  onClick={handleViewResume}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'transparent',
                    border: `1px solid ${hasResume ? 'var(--t-border-focus)' : 'var(--t-border)'}`,
                    color: hasResume ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
                    cursor: hasResume && !resumeLoading ? 'pointer' : 'not-allowed',
                    opacity: hasResume ? 1 : 0.4,
                    transition: 'background 120ms, border-color 120ms, color 120ms',
                  }}
                  onMouseEnter={e => { if (hasResume && !resumeLoading) { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.color = 'var(--t-text)' } }}
                  onMouseLeave={e => { if (hasResume) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--t-border-focus)'; e.currentTarget.style.color = 'var(--t-text-secondary)' } }}
                >
                  <Paperclip size={13} />{btnLabel}
                </button>
              )
            })()}
          </div>
        ) : <div />}

        {/* Row 2 left: work exp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12, overflow: 'hidden' }}>
          {loadingProfile ? (
            <div className="t-skeleton" style={{ width: 160, height: 11 }} />
          ) : latestWork ? (
            <>
              <Calendar size={12} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
              {workPeriod && <span style={{ color: 'var(--t-text-muted)', flexShrink: 0, whiteSpace: 'nowrap', minWidth: '6em', display: 'inline-block' }}>{workPeriod}</span>}
              <span style={{ color: 'var(--t-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[latestWork.company_name || latestWork.company, latestWork.title].filter(Boolean).join(' · ')}
              </span>
            </>
          ) : (
            <>
              {threadFunction && <span style={{ color: 'var(--t-text-secondary)' }}>{threadFunction}</span>}
              {threadCity && <>{dot}<span style={{ color: 'var(--t-text-muted)' }}>{threadCity}</span></>}
              {profile?.current_title && !threadFunction && (
                <span style={{ color: 'var(--t-text-secondary)' }}>{profile.current_title}</span>
              )}
            </>
          )}
        </div>

        {/* Row 2 right: 当前沟通职位 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' }}>当前沟通职位：</span>
          {threads.length > 0 ? (
            <JobSelector threads={threads} activeId={threadId} onSelect={id => onSwitchThread?.(id)} terminal />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--t-text-secondary)', whiteSpace: 'nowrap' }}>{activeThread?.job_title || '—'}</span>
          )}
        </div>

        {/* Row 3: education (left) + 期望 (right) — conditional */}
        {(loadingProfile || latestEdu || expectedParts.length > 0) && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12, overflow: 'hidden' }}>
              {loadingProfile ? (
                <div className="t-skeleton" style={{ width: 140, height: 11 }} />
              ) : latestEdu ? (
                <>
                  <GraduationCap size={12} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
                  {eduPeriod && <span style={{ color: 'var(--t-text-muted)', flexShrink: 0, whiteSpace: 'nowrap', minWidth: '6em', display: 'inline-block' }}>{eduPeriod}</span>}
                  <span style={{ color: 'var(--t-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[latestEdu.school, latestEdu.major, latestEdu.degree].filter(Boolean).join(' · ')}
                  </span>
                </>
              ) : <span />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {expectedParts.length > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' }}>期望：</span>
                  <span style={{ fontSize: 11, color: 'var(--t-text-secondary)', whiteSpace: 'nowrap' }}>{expectedParts.join(' · ')}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Public light header (unchanged logic) ───────────────────────────────────
export function ConversationHeader({ thread, threadId, threads, onSwitchThread, terminal, myRole }) {
  if (terminal) {
    return (
      <TerminalConvHeader
        thread={thread}
        threadId={threadId}
        threads={threads}
        onSwitchThread={onSwitchThread}
        myRole={myRole}
      />
    )
  }

  const otherName  = thread?.candidate_name ?? thread?.company_name
  const showEmailBar = (myRole === 'employer' || myRole === 'admin') && !!thread?.candidate_id && !!thread?.job_id
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-start gap-3 flex-shrink-0">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(otherName?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800 text-sm">{otherName}</p>
          {thread?.invitation_status && <InvBadge status={thread.invitation_status} terminal={false} />}
        </div>
        {threads.length > 0 ? (
          <JobSelector threads={threads} activeId={threadId} onSelect={id => onSwitchThread?.(id)} terminal={false} />
        ) : (
          <p className="text-xs text-slate-400">{thread?.job_title}</p>
        )}
        {showEmailBar && (
          <div style={{ marginTop: 6 }}>
            <CandidateEmailActionBar candidateId={thread.candidate_id} jobId={thread.job_id} threadId={threadId} terminal={false} />
          </div>
        )}
      </div>
    </div>
  )
}
