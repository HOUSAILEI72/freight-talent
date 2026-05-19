import {
  Lock, GraduationCap, Briefcase,
  BookmarkPlus, BookmarkCheck, Send, CheckCircle2,
  Eye,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatWorkPeriod, formatExpectedSalary } from '../utils/candidateFormatters'

const AVAIL_LABEL = {
  open: '离职-随时到岗', passive_now: '在职-月内到岗', passive: '在职-考虑机会',
}

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

function getSortedWorkExperiences(arr, limit = 2) {
  if (!arr?.length) return []
  const current = arr.filter(isCurrentJob)
  const past = arr.filter(w => !isCurrentJob(w)).sort((a, b) => {
    const ea = (a.end_month ?? a.end_date ?? '').toString()
    const eb = (b.end_month ?? b.end_date ?? '').toString()
    return eb.localeCompare(ea)
  })
  return [...current, ...past].slice(0, limit)
}

function getSortedEducations(arr, limit = 2) {
  if (!arr?.length) return []
  return [...arr].sort((a, b) => eduRank(b) - eduRank(a)).slice(0, limit)
}

function parseYearMonth(str) {
  if (!str) return null
  const s = str.toString().trim()
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})/)
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, 1)
  const y = s.match(/^(\d{4})$/)
  if (y) return new Date(parseInt(y[1]), 0, 1)
  return null
}

function computeExperienceYears(arr) {
  if (!arr?.length) return null
  let totalMonths = 0
  const now = new Date()
  for (const w of arr) {
    const start = parseYearMonth(w.start_month ?? w.start_date)
    if (!start) continue
    const endStr = (w.end_month ?? w.end_date ?? '').toString().toLowerCase()
    const end = (!endStr || endStr === '至今' || endStr === 'present' || endStr === 'now')
      ? now
      : parseYearMonth(endStr)
    if (!end) continue
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    if (months > 0) totalMonths += months
  }
  return totalMonths > 0 ? Math.max(1, Math.round(totalMonths / 12)) : null
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
        fontFamily: 'var(--t-font-cjk)',
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

function Chip({ children, accent, chipType }) {
  let bg, border, color
  if (accent) {
    bg = 'rgba(37,99,235,0.13)'; border = 'rgba(37,99,235,0.32)'; color = 'var(--t-chart-blue)'
  } else if (chipType === 'know') {
    bg = 'rgba(59,130,246,0.10)'; border = 'rgba(59,130,246,0.30)'; color = 'var(--t-primary)'
  } else if (chipType === 'hard') {
    bg = 'rgba(34,197,94,0.09)'; border = 'rgba(34,197,94,0.28)'; color = 'var(--t-success)'
  } else if (chipType === 'soft') {
    bg = 'rgba(167,139,250,0.09)'; border = 'rgba(167,139,250,0.28)'; color = 'var(--t-chart-purple)'
  } else {
    bg = 'rgba(255,255,255,0.04)'; border = 'var(--t-border)'; color = 'var(--t-text-secondary)'
  }
  return (
    <span
      className="px-1.5 py-[2px] whitespace-nowrap"
      style={{
        fontFamily: 'var(--t-font-cjk)',
        fontSize: 10,
        fontWeight: 500,
        lineHeight: '16px',
        background: bg,
        border: `1px solid ${border}`,
        color,
        borderRadius: 'var(--t-radius-sm)',
      }}
    >
      {children}
    </span>
  )
}

function BossTimelineEntry({ Icon, iconColor, period, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, minWidth: 0 }}>
      <Icon size={10} style={{ color: iconColor, flexShrink: 0, marginTop: 2 }} />
      <span
        style={{
          fontFamily: 'var(--t-font-mono)',
          fontSize: 10,
          color: 'var(--t-text-muted)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.01em',
          lineHeight: 1.45,
          whiteSpace: 'nowrap',
        }}
      >
        {period || '—'}
      </span>
      <span
        style={{
          fontFamily: 'var(--t-font-cjk)',
          fontSize: 11,
          color: 'var(--t-text-secondary)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.45,
          flex: 1,
        }}
      >
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
      className="terminal-result-pill-btn"
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingInline: 8,
        borderRadius: 'var(--t-radius-sm)',
        fontFamily: 'var(--t-font-cjk)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 130ms, border-color 130ms',
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
  onOpenConversation,
  navigatePath,
}) {
  const navigate   = useNavigate()
  const isUnlocked = !!c.private_visible

  const workEntries = getSortedWorkExperiences(c.work_experiences, 2)
  const eduEntries  = getSortedEducations(c.education_experiences, 2)

  const publicTagged = [
    ...(c.knowledge_tags  ?? []).map(t => ({ t, chipType: 'know' })),
    ...(c.hard_skill_tags ?? []).map(t => ({ t, chipType: 'hard' })),
    ...(c.soft_skill_tags ?? []).map(t => ({ t, chipType: 'soft' })),
  ]

  const allTagged = [
    ...(c.knowledge_tags  ?? []).map(t => ({ t, chipType: 'know' })),
    ...(c.hard_skill_tags ?? []).map(t => ({ t, chipType: 'hard' })),
    ...(c.soft_skill_tags ?? []).map(t => ({ t, chipType: 'soft' })),
    ...(c.route_tags      ?? []).map(t => ({ t, chipType: null })),
    ...(c.skill_tags      ?? []).map(t => ({ t, chipType: null })),
  ]
  const STRIP_LIMIT   = 6
  const visibleTagged = allTagged.slice(0, STRIP_LIMIT)
  const overflowCnt   = allTagged.length - STRIP_LIMIT
  const stripFallback = [c.business_type, c.job_type, c.business_area_name].filter(Boolean)

  const city = c.expected_city || c.location_name || c.current_city || c.business_area_name
  const experienceYears = c.experience_years ?? computeExperienceYears(c.work_experiences)
  const metaParts = []
  if (experienceYears != null) metaParts.push(`${experienceYears}年经验`)
  if (isUnlocked && c.age != null) metaParts.push(`${c.age}岁`)
  if (city) metaParts.push(city)
  if (isUnlocked && c.education) metaParts.push(c.education)
  else if (!isUnlocked) metaParts.push('学历')
  if (isUnlocked && c.availability_status) metaParts.push(AVAIL_LABEL[c.availability_status] ?? c.availability_status)
  const metaLine = metaParts.join(' | ')

  function go(e) {
    e?.stopPropagation()
    navigate(navigatePath ?? `/employer/candidates/${c.id}`)
  }

  return (
    <div
      onClick={go}
      className="cursor-pointer overflow-hidden t-card-pressable"
      style={{
        position: 'relative',
        background: 'var(--t-bg-panel)',
        border: '1px solid rgba(96,165,250,0.15)',
        borderRadius: 'var(--t-radius)',
        transition: 'border-color 160ms, background 160ms, transform var(--t-dur-fast) var(--t-ease-std)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background  = 'var(--t-bg-hover)'
        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.36)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background  = 'var(--t-bg-panel)'
        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.15)'
      }}
    >
      {/* left accent stripe — status indicator */}
      <div
        className="terminal-result-card-stripe"
        style={{
          background: isInvited
            ? 'var(--t-success)'
            : isUnlocked ? 'var(--t-primary)' : 'transparent',
        }}
      />

      {/* ── 3-col body ─────────────────────────────────────────────── */}
      <div className="terminal-result-card-body">

        {/* ── LEFT: identity ─────────────────────────────────────────── */}
        <div
          className="terminal-candidate-identity flex items-center gap-3 px-4 py-2"
          style={{ borderRight: '1px solid var(--t-border-subtle)' }}
        >
          {/* avatar */}
          <div className="relative flex-shrink-0">
            <div
              className={`w-9 h-9 rounded flex items-center justify-center font-bold text-sm${c.freshness_days != null && c.freshness_days <= 1 ? ' terminal-avatar-fresh' : ''}`}
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
            <span className="truncate" style={{ fontFamily: 'var(--t-font-cjk)', fontSize: 13, fontWeight: 700, color: 'var(--t-text)', lineHeight: 'var(--t-line-tight, 1.25)', letterSpacing: 'var(--t-letter-ui, 0.01em)' }}>
              {c.full_name}
            </span>

            {/* row 2: status badges — 允许换行，保证每个 pill 完整可见 */}
            <div className="flex items-center gap-1" style={{ minHeight: 17, flexWrap: 'wrap' }}>
              {c.freshness_days != null && c.freshness_days <= 7 && (
                <StatusPill
                  color={c.freshness_days <= 3 ? 'green' : 'blue'}
                  dot={c.freshness_days <= 3}
                >
                  {c.freshness_days <= 1 ? '今日更新' : `${c.freshness_days}天前`}
                </StatusPill>
              )}
              {isInvited && (
                <StatusPill color="green" icon="✓">已沟通</StatusPill>
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

            {/* row 3: 目标岗位 | 期望薪资 */}
            <div className="flex items-center flex-wrap" style={{ gap: '0 4px', lineHeight: 1.3 }}>
              {c.desired_position && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)' }}>{c.desired_position}</span>
              )}
              {c.desired_position && (c.expected_salary_min != null || c.expected_salary_label) && (
                <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>|</span>
              )}
              {formatExpectedSalary(c.expected_salary_min, c.expected_salary_max, c.expected_salary_period, c.expected_salary_label) && (
                <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11.5, fontWeight: 600, color: 'rgba(96,165,250,0.85)', letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {formatExpectedSalary(c.expected_salary_min, c.expected_salary_max, c.expected_salary_period, c.expected_salary_label)}
                </span>
              )}
            </div>

            {metaLine && (
              <p className="terminal-result-meta-line">
                {metaLine}
              </p>
            )}

          </div>
        </div>

        {/* ── CENTER: timeline (unlocked) / public portrait (locked) ── */}
        <div
          className="terminal-candidate-timeline px-4 py-2 flex flex-col justify-center"
          style={{ borderRight: '1px solid var(--t-border-subtle)', minWidth: 0, gap: 4 }}
        >
          {isUnlocked ? (
            <>
              {workEntries.length > 0
                ? workEntries.map((w, i) => (
                    <BossTimelineEntry
                      key={i}
                      Icon={Briefcase}
                      iconColor="var(--t-chart-blue)"
                      period={formatWorkPeriod(w)}
                      title={[w.company_name ?? w.company, w.title].filter(Boolean).join(' · ') || '—'}
                    />
                  ))
                : <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>暂无工作经历</p>
              }
              {workEntries.length > 0 && eduEntries.length > 0 && (
                <div style={{ height: 1, background: 'var(--t-border-subtle)', margin: '2px 0' }} />
              )}
              {eduEntries.length > 0
                ? eduEntries.map((edu, i) => (
                    <BossTimelineEntry
                      key={i}
                      Icon={GraduationCap}
                      iconColor="var(--t-chart-purple)"
                      period={edu.period || '—'}
                      title={[edu.school, edu.major, edu.degree ?? edu.level].filter(Boolean).join(' · ') || '—'}
                    />
                  ))
                : <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>暂无教育经历</p>
              }
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
              {publicTagged.slice(0, 4).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {publicTagged.slice(0, 4).map(({ t, chipType }, i) => <Chip key={i} chipType={chipType}>{t}</Chip>)}
                </div>
              )}
              {!c.summary && publicTagged.length === 0 && (
                <p style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>暂无公开简介</p>
              )}
              <div className="flex items-center gap-1">
                <Lock size={8} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-cjk)', letterSpacing: '0.04em' }}>
                  完整履历 · 订阅后可见
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: actions ──────────────────────────────────────────── */}
        <div
          className="terminal-candidate-actions terminal-result-card-actions flex flex-col justify-center gap-1.5 px-2.5 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* View */}
          <PillBtn
            onClick={go}
            style={{
              background: 'rgba(37,99,235,0.14)',
              color: 'var(--t-text)',
              border: '1px solid rgba(96,165,250,0.42)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(37,99,235,0.22)'
              e.currentTarget.style.borderColor = 'rgba(96,165,250,0.65)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(37,99,235,0.14)'
              e.currentTarget.style.borderColor = 'rgba(96,165,250,0.42)'
            }}
          >
            <Eye size={11} />
            完整简历
          </PillBtn>

          {/* Invite / Chat */}
          <PillBtn
            disabled={!canInvite && !isInvited}
            onClick={() => { if (canInvite || isInvited) onOpenConversation(c) }}
            style={{
              background: isInvited ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.08)',
              border: `1px solid ${isInvited ? 'var(--t-success)' : canInvite ? 'rgba(96,165,250,0.55)' : 'var(--t-border)'}`,
              color: isInvited ? 'var(--t-success)' : canInvite ? 'var(--t-chart-blue)' : 'var(--t-text-muted)',
              opacity: !canInvite && !isInvited ? 0.38 : 1,
              cursor: !canInvite && !isInvited ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isInvited ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.16)'
              e.currentTarget.style.borderColor = isInvited ? 'var(--t-success)' : 'rgba(96,165,250,0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isInvited ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.08)'
              e.currentTarget.style.borderColor = isInvited ? 'var(--t-success)' : canInvite ? 'rgba(96,165,250,0.55)' : 'var(--t-border)'
            }}
          >
            {isInvited ? <CheckCircle2 size={11} /> : <Send size={11} />}
            {isInvited ? '已沟通' : '在线沟通'}
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
        <span className="flex-shrink-0 mr-1" style={{ fontFamily: 'var(--t-font-ui)', fontSize: 9, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--t-letter-caps, 0.08em)', fontWeight: 600 }}>
          Skills
        </span>
        {c.function_name && <Chip accent>{c.function_name}</Chip>}
        {c.english_level  && <Chip>EN·{c.english_level}</Chip>}
        {(visibleTagged.length > 0
          ? visibleTagged
          : stripFallback.map(t => ({ t, chipType: null }))
        ).map(({ t, chipType }, i) => (
          <Chip key={i} chipType={chipType}>{t}</Chip>
        ))}
        {overflowCnt > 0 && (
          <span className="text-[9px]" style={{ fontFamily: 'var(--t-font-ui)', color: 'var(--t-text-muted)' }}>+{overflowCnt}</span>
        )}
        {!c.function_name && !c.english_level && visibleTagged.length === 0 && stripFallback.length === 0 && (
          <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>暂无标签</span>
        )}
      </div>
    </div>
  )
}
