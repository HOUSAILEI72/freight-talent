import {
  Lock, GraduationCap, Briefcase,
  BookmarkPlus, BookmarkCheck, Send, CheckCircle2,
  Eye,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatWorkPeriod } from '../utils/candidateFormatters'

/* ── experience selectors ───────────────────────────────────────── */

const EDU_RANK = { '博士': 6, '硕士': 5, '研究生': 5, '本科': 4, '学士': 4, '大专': 3, '专科': 3, '高中': 2, '中专': 2 }

function eduRank(exp) {
  const key = exp?.degree ?? exp?.level ?? ''
  for (const [kw, rank] of Object.entries(EDU_RANK)) {
    if (key.includes(kw)) return rank
  }
  return 0
}

function isCurrentJob(w) {
  const end = (w.end_month ?? w.end_date ?? '').toString().toLowerCase()
  return !end || end === '至今' || end === 'present' || end === 'now'
}

function getLatestWorkExperience(arr) {
  if (!arr?.length) return null
  const current = arr.find(isCurrentJob)
  if (current) return current
  return [...arr].sort((a, b) => {
    const ea = (a.end_month ?? a.end_date ?? '').toString()
    const eb = (b.end_month ?? b.end_date ?? '').toString()
    return eb.localeCompare(ea)
  })[0]
}

function getHighestEducation(arr) {
  if (!arr?.length) return null
  return [...arr].sort((a, b) => eduRank(b) - eduRank(a))[0]
}

/* ── status pill — 统一规格，四种状态共用 ───────────────────────── */

const PILL_COLORS = {
  green: { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)',   color: 'var(--t-success)' },
  blue:  { bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)',  color: 'var(--t-chart-blue)' },
  amber: { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.4)',   color: 'var(--t-chart-amber)' },
  gray:  { bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)',  color: 'var(--t-text-muted)' },
}

function StatusPill({ color = 'gray', dot, icon, children }) {
  const { bg, border, color: fg } = PILL_COLORS[color] ?? PILL_COLORS.gray
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        height: 16, padding: '0 6px',
        borderRadius: 999,
        background: bg, border: `1px solid ${border}`, color: fg,
        fontSize: 9, fontWeight: 700,
        fontFamily: 'var(--t-font-mono)',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      )}
      {icon && !dot && <span style={{ fontSize: 8 }}>{icon}</span>}
      {children}
    </span>
  )
}

const APP_STATUS_PILL = {
  submitted:   { color: 'blue',  label: '待查看' },
  viewed:      { color: 'blue',  label: '已查看' },
  shortlisted: { color: 'green', label: '候选名单' },
  rejected:    { color: 'gray',  label: '暂不匹配' },
  withdrawn:   { color: 'gray',  label: '已撤回' },
  saved:       { color: 'amber', label: '已保存' },
}

/* ── micro helpers ──────────────────────────────────────────────── */

function Chip({ children, accent }) {
  return (
    <span
      className="font-mono text-[10px] px-1.5 py-[2px] whitespace-nowrap"
      style={{
        background: accent ? 'rgba(37,99,235,0.13)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent ? 'rgba(37,99,235,0.32)' : 'var(--t-border)'}`,
        color: accent ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)',
        borderRadius: 'var(--t-radius-sm)',
      }}
    >
      {children}
    </span>
  )
}

function TimelineRow({ Icon, iconColor, period, title }) {
  return (
    <div className="flex items-center min-w-0" style={{ height: 20 }}>
      <div className="flex items-center gap-1 flex-shrink-0" style={{ width: 104 }}>
        <Icon size={10} style={{ color: iconColor, flexShrink: 0 }} />
        <span className="font-mono text-[10px] truncate" style={{ color: 'var(--t-text-muted)' }}>
          {period || '—'}
        </span>
      </div>
      <span className="text-[11px] truncate flex-1" style={{ color: 'var(--t-text-secondary)' }}>
        {title}
      </span>
    </div>
  )
}

function PillBtn({ onClick, disabled, style, onMouseEnter, onMouseLeave, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 28,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 999,
        fontFamily: 'var(--t-font-mono)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 130ms, border-color 130ms, box-shadow 130ms',
        border: '1px solid transparent',
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled && onMouseEnter) onMouseEnter(e) }}
      onMouseLeave={(e) => { if (!disabled && onMouseLeave) onMouseLeave(e) }}
    >
      {children}
    </button>
  )
}

/* ── main card ──────────────────────────────────────────────────── */

export function CandidateResultCard({
  c,
  isInvited,
  isArchived,
  canInvite,
  onArchive,
  onInvite,
  navigatePath,
}) {
  const navigate   = useNavigate()
  const isUnlocked = !!c.private_visible

  const latestWork = getLatestWorkExperience(c.work_experiences)
  const highestEdu = getHighestEducation(c.education_experiences)

  const publicTags = [
    ...(c.knowledge_tags  ?? []),
    ...(c.hard_skill_tags ?? []),
    ...(c.soft_skill_tags ?? []),
  ]

  const stripTags = [
    ...(c.knowledge_tags  ?? []),
    ...(c.hard_skill_tags ?? []),
    ...(c.soft_skill_tags ?? []),
    ...(c.route_tags      ?? []),
    ...(c.skill_tags      ?? []),
  ]
  const STRIP_LIMIT   = 6
  const visibleStrip  = stripTags.slice(0, STRIP_LIMIT)
  const overflowCnt   = stripTags.length - STRIP_LIMIT
  const stripFallback = [c.business_type, c.job_type, c.business_area_name].filter(Boolean)

  const city = c.current_city ?? c.expected_city ?? c.location_name ?? c.business_area_name

  const idParts = []
  if (isUnlocked) {
    if (c.age != null)              idParts.push(`${c.age}岁`)
    if (c.experience_years != null) idParts.push(`${c.experience_years}年`)
    if (c.education)                idParts.push(c.education)
    if (city)                       idParts.push(city)
  } else {
    idParts.push('年龄—', '经验—', '学历—')
    if (city) idParts.push(city)
  }
  const identityLine = idParts.join(' · ')

  function go(e) {
    e?.stopPropagation()
    navigate(navigatePath ?? `/employer/candidates/${c.id}`)
  }

  return (
    <div
      onClick={go}
      className="cursor-pointer overflow-hidden"
      style={{
        background: 'var(--t-bg-panel)',
        border: '1px solid var(--t-border)',
        borderRadius: 'var(--t-radius)',
        transition: 'border-color 140ms, background 140ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background  = 'var(--t-bg-hover)'
        e.currentTarget.style.borderColor = 'var(--t-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background  = 'var(--t-bg-panel)'
        e.currentTarget.style.borderColor = 'var(--t-border)'
      }}
    >
      {/* ── 3-col body ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 256px) minmax(0, 1fr) 144px' }}>

        {/* ── LEFT: identity ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-2"
          style={{ borderRight: '1px solid var(--t-border-subtle)' }}
        >
          {/* avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-9 h-9 rounded flex items-center justify-center font-bold text-sm"
              style={{
                background: isInvited
                  ? 'var(--t-success-muted)'
                  : isUnlocked ? 'var(--t-primary-muted)' : 'var(--t-bg-elevated)',
                border: `1px solid ${isInvited
                  ? 'var(--t-success)'
                  : isUnlocked ? 'var(--t-primary)' : 'var(--t-border)'}`,
                color: isInvited
                  ? 'var(--t-success)'
                  : isUnlocked ? 'var(--t-primary)' : 'var(--t-text-secondary)',
              }}
            >
              {c.full_name?.[0] ?? '?'}
            </div>
          </div>

          <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* row 1: name */}
            <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)', lineHeight: 1.25 }}>
              {c.full_name}
            </span>

            {/* row 2: status badges — 统一 pill 规格，单行不换行 */}
            <div className="flex items-center gap-1" style={{ minHeight: 17, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {c.freshness_days != null && c.freshness_days <= 7 && (
                <StatusPill
                  color={c.freshness_days <= 3 ? 'green' : 'blue'}
                  dot={c.freshness_days <= 3}
                >
                  {c.freshness_days <= 1 ? '今日更新' : `${c.freshness_days}天前`}
                </StatusPill>
              )}
              {isUnlocked && c.availability_status && (
                <StatusPill color={c.availability_status === 'open' ? 'green' : c.availability_status === 'passive' ? 'blue' : 'gray'}>
                  {c.availability_status === 'open' ? 'OPEN' : c.availability_status === 'passive' ? 'PASSIVE' : 'CLOSED'}
                </StatusPill>
              )}
              {isInvited && (
                <StatusPill color="green" icon="✓">已邀约</StatusPill>
              )}
              {isArchived && (
                <StatusPill color="amber" icon="★">已收藏</StatusPill>
              )}
              {c.application_status && APP_STATUS_PILL[c.application_status] && (
                <StatusPill color={APP_STATUS_PILL[c.application_status].color} icon="↗">
                  {APP_STATUS_PILL[c.application_status].label}
                </StatusPill>
              )}
            </div>

            {/* row 2: title · company or function */}
            {isUnlocked
              ? (c.current_title || c.current_company) && (
                  <p className="truncate" style={{ fontSize: 11, color: 'var(--t-text-secondary)', lineHeight: 1.3 }}>
                    {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
                  </p>
                )
              : c.function_name && (
                  <p className="truncate" style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.3 }}>
                    {c.function_name}
                  </p>
                )
            }

            {/* row 3: identity + city merged */}
            {identityLine && (
              <p style={{ fontSize: 11, color: isUnlocked ? 'var(--t-text-secondary)' : 'var(--t-text-muted)', lineHeight: 1.3 }}>
                {!isUnlocked && (
                  <Lock size={8} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle', color: 'var(--t-text-muted)' }} />
                )}
                {identityLine}
              </p>
            )}

            {/* row 4: expected salary */}
            {c.expected_salary_label && (
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-chart-blue)', lineHeight: 1.2 }}>
                {c.expected_salary_label}
              </p>
            )}
          </div>
        </div>

        {/* ── CENTER: timeline (unlocked) / public portrait (locked) ── */}
        <div
          className="px-4 py-2 flex flex-col justify-center"
          style={{ borderRight: '1px solid var(--t-border-subtle)', minWidth: 0, gap: 4 }}
        >
          {isUnlocked ? (
            <>
              {latestWork ? (
                <TimelineRow
                  Icon={Briefcase}
                  iconColor="var(--t-chart-blue)"
                  period={formatWorkPeriod(latestWork)}
                  title={[latestWork.company_name ?? latestWork.company, latestWork.title].filter(Boolean).join(' · ') || '—'}
                />
              ) : (
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>暂无工作经历</p>
              )}
              {highestEdu ? (
                <TimelineRow
                  Icon={GraduationCap}
                  iconColor="var(--t-chart-purple)"
                  period={highestEdu.period || '—'}
                  title={[highestEdu.school, highestEdu.major, highestEdu.degree ?? highestEdu.level].filter(Boolean).join(' · ') || '—'}
                />
              ) : (
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>暂无教育经历</p>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {c.summary && (
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--t-text-secondary)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {c.summary}
                </p>
              )}
              {publicTags.slice(0, 4).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {publicTags.slice(0, 4).map((t, i) => <Chip key={i}>{t}</Chip>)}
                </div>
              )}
              {!c.summary && publicTags.length === 0 && (
                <p style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>暂无公开简介</p>
              )}
              <div className="flex items-center gap-1">
                <Lock size={8} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', letterSpacing: '0.04em' }}>
                  完整履历 · 订阅后可见
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: actions ──────────────────────────────────────────── */}
        <div
          className="flex flex-col justify-center gap-1.5 px-2.5 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* View */}
          <PillBtn
            onClick={go}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 1px 5px rgba(37,99,235,0.35)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.5)'
              e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 5px rgba(37,99,235,0.35)'
              e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
            }}
          >
            <Eye size={11} />
            查看
          </PillBtn>

          {/* Invite */}
          <PillBtn
            disabled={!canInvite && !isInvited}
            onClick={() => { if (canInvite) onInvite(c) }}
            style={{
              background: isInvited ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.08)',
              border: `1px solid ${isInvited ? 'var(--t-success)' : canInvite ? 'rgba(96,165,250,0.55)' : 'var(--t-border)'}`,
              color: isInvited ? 'var(--t-success)' : canInvite ? 'var(--t-chart-blue)' : 'var(--t-text-muted)',
              opacity: !canInvite && !isInvited ? 0.38 : 1,
              cursor: isInvited ? 'default' : !canInvite ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(96,165,250,0.16)'
              e.currentTarget.style.borderColor = 'rgba(96,165,250,0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(96,165,250,0.08)'
              e.currentTarget.style.borderColor = canInvite ? 'rgba(96,165,250,0.55)' : 'var(--t-border)'
            }}
          >
            {isInvited ? <CheckCircle2 size={11} /> : <Send size={11} />}
            {isInvited ? '已邀约' : '邀约'}
          </PillBtn>

          {/* Bookmark */}
          <PillBtn
            onClick={() => onArchive(c.id)}
            style={{
              background: isArchived ? 'rgba(251,191,36,0.12)' : 'transparent',
              border: `1px solid ${isArchived ? 'var(--t-chart-amber)' : 'var(--t-border)'}`,
              color: isArchived ? 'var(--t-chart-amber)' : 'var(--t-text-secondary)',
            }}
            onMouseEnter={(e) => {
              if (isArchived) return
              e.currentTarget.style.borderColor = 'rgba(251,191,36,0.6)'
              e.currentTarget.style.color = 'var(--t-chart-amber)'
              e.currentTarget.style.background = 'rgba(251,191,36,0.08)'
            }}
            onMouseLeave={(e) => {
              if (isArchived) return
              e.currentTarget.style.borderColor = 'var(--t-border)'
              e.currentTarget.style.color = 'var(--t-text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {isArchived ? <BookmarkCheck size={11} /> : <BookmarkPlus size={11} />}
            {isArchived ? '已收藏' : '收藏'}
          </PillBtn>
        </div>
      </div>

      {/* ── skills strip ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-4 flex-wrap"
        style={{
          borderTop: '1px solid var(--t-border-subtle)',
          background: 'var(--t-bg-elevated)',
          minHeight: 28,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        <span className="font-mono text-[9px] flex-shrink-0 mr-1" style={{ color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Skills
        </span>
        {c.function_name && <Chip accent>{c.function_name}</Chip>}
        {c.english_level  && <Chip>EN·{c.english_level}</Chip>}
        {(visibleStrip.length > 0 ? visibleStrip : stripFallback).map((t, i) => (
          <Chip key={i}>{t}</Chip>
        ))}
        {overflowCnt > 0 && (
          <span className="font-mono text-[9px]" style={{ color: 'var(--t-text-muted)' }}>+{overflowCnt}</span>
        )}
        {!c.function_name && !c.english_level && visibleStrip.length === 0 && stripFallback.length === 0 && (
          <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>暂无标签</span>
        )}
      </div>
    </div>
  )
}
