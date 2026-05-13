import {
  Lock, ArrowRight, GraduationCap, Briefcase,
  BookmarkPlus, BookmarkCheck, Send, CheckCircle2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FreshBadge, AvailBadge } from './FreshBadge'
import { formatWorkPeriod } from '../utils/candidateFormatters'

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

// period (130px fixed) | company · title (flex-1, readable)
function TimelineRow({ Icon, iconColor, period, title }) {
  return (
    <div className="flex items-center min-w-0" style={{ minHeight: 26 }}>
      <div className="flex items-center gap-1 flex-shrink-0" style={{ width: 130 }}>
        <Icon size={10} style={{ color: iconColor, flexShrink: 0 }} />
        <span
          className="font-mono text-[10px] truncate"
          style={{ color: 'var(--t-text-muted)' }}
        >
          {period || '—'}
        </span>
      </div>
      <span
        className="text-[13px] truncate flex-1"
        style={{ color: 'var(--t-text-secondary)' }}
      >
        {title}
      </span>
    </div>
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

  const workExp = c.work_experiences?.slice(0, 2) ?? []
  const eduExp  = c.education_experiences?.[0] ?? null

  // public tags visible regardless of subscription
  const publicTags = [
    ...(c.knowledge_tags  ?? []),
    ...(c.hard_skill_tags ?? []),
    ...(c.soft_skill_tags ?? []),
  ]

  // bottom skills strip
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

  // Identity line: unlocked → skip missing fields; locked → always show placeholders
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
  const identityLine = idParts.join(' | ')

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
        borderRadius: 'var(--t-radius-lg)',
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

      {/* ── 3-col body ───────────────────────────────────────────────── */}
      <div
        className="grid"
        style={{ gridTemplateColumns: '300px minmax(0,1fr) 156px' }}
      >

        {/* ── LEFT: identity ─────────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 px-4 py-4"
          style={{ borderRight: '1px solid var(--t-border-subtle)' }}
        >
          {/* avatar 48px */}
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0"
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

          <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>

            {/* row 1: name + badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--t-text)', lineHeight: 1.2 }}>
                {c.full_name}
              </span>
              <FreshBadge days={c.freshness_days} terminal />
              {isUnlocked && c.availability_status && (
                <AvailBadge status={c.availability_status} terminal />
              )}
              {isInvited && (
                <span className="font-mono text-[10px]" style={{ color: 'var(--t-success)' }}>✓ 邀约</span>
              )}
              {isArchived && (
                <span className="font-mono text-[10px]" style={{ color: 'var(--t-text-muted)' }}>归档</span>
              )}
            </div>

            {/* row 2: current_title · company (unlocked) | function_name muted (locked) */}
            {isUnlocked
              ? (c.current_title || c.current_company) && (
                  <p
                    className="truncate"
                    style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.35 }}
                  >
                    {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
                  </p>
                )
              : c.function_name && (
                  <p
                    className="truncate"
                    style={{ fontSize: 12, color: 'var(--t-text-muted)', lineHeight: 1.35 }}
                  >
                    {c.function_name}
                  </p>
                )
            }

            {/* row 3: identity — age | exp | edu | city */}
            {identityLine && (
              <p style={{ fontSize: 13, color: isUnlocked ? 'var(--t-text-secondary)' : 'var(--t-text-muted)', lineHeight: 1.35 }}>
                {!isUnlocked && (
                  <Lock
                    size={9}
                    style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle', color: 'var(--t-text-muted)' }}
                  />
                )}
                {identityLine}
              </p>
            )}

            {/* row 4: expected salary (public field — show for both locked/unlocked) */}
            {c.expected_salary_label && (
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-chart-blue)', lineHeight: 1.35 }}>
                {c.expected_salary_label}
              </p>
            )}

          </div>
        </div>

        {/* ── CENTER: timeline (unlocked) / public portrait (locked) ──── */}
        <div
          className="px-4 py-4 flex flex-col justify-center"
          style={{ borderRight: '1px solid var(--t-border-subtle)', minWidth: 0, gap: 6 }}
        >
          {isUnlocked ? (
            <>
              {workExp.map((w, i) => (
                <TimelineRow
                  key={i}
                  Icon={Briefcase}
                  iconColor="var(--t-chart-blue)"
                  period={formatWorkPeriod(w)}
                  title={[w.company_name ?? w.company, w.title].filter(Boolean).join(' · ') || '—'}
                />
              ))}
              {workExp.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>暂无工作经历</p>
              )}
              {eduExp && (
                <TimelineRow
                  Icon={GraduationCap}
                  iconColor="var(--t-chart-purple)"
                  period={eduExp.period || '—'}
                  title={[eduExp.school, eduExp.major, eduExp.degree ?? eduExp.level].filter(Boolean).join(' · ') || '—'}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {c.summary && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--t-text-secondary)',
                    lineHeight: 1.55,
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
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>暂无公开简介</p>
              )}

              <div className="flex items-center gap-1">
                <Lock size={9} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>
                  完整履历 · 订阅后可见
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: actions ──────────────────────────────────────────── */}
        <div
          className="flex flex-col justify-center gap-2 px-3 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={go}
            className="flex items-center justify-center gap-1.5 w-full font-semibold text-xs"
            style={{
              height: 32,
              background: 'var(--t-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--t-radius)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--t-primary-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--t-primary)' }}
          >
            <ArrowRight size={12} />查看详情
          </button>

          <div className="flex gap-1">
            <button
              type="button"
              disabled={!canInvite && !isInvited}
              onClick={() => { if (canInvite) onInvite(c) }}
              className="flex-1 flex items-center justify-center gap-1 text-[11px]"
              style={{
                height: 28,
                background: isInvited ? 'var(--t-success-muted)' : 'transparent',
                border: `1px solid ${isInvited ? 'var(--t-success)' : canInvite ? 'var(--t-chart-blue)' : 'var(--t-border)'}`,
                color: isInvited ? 'var(--t-success)' : canInvite ? 'var(--t-chart-blue)' : 'var(--t-text-muted)',
                opacity: !canInvite && !isInvited ? 0.38 : 1,
                cursor: isInvited ? 'default' : !canInvite ? 'not-allowed' : 'pointer',
                borderRadius: 'var(--t-radius-sm)',
              }}
              onMouseEnter={(e) => {
                if (!canInvite || isInvited) return
                e.currentTarget.style.background = 'rgba(96,165,250,0.1)'
              }}
              onMouseLeave={(e) => {
                if (!canInvite || isInvited) return
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {isInvited ? <CheckCircle2 size={10} /> : <Send size={10} />}
              {isInvited ? '已邀约' : '邀约'}
            </button>

            <button
              type="button"
              onClick={() => onArchive(c.id)}
              className="flex-1 flex items-center justify-center gap-1 text-[11px]"
              style={{
                height: 28,
                background: isArchived ? 'var(--t-success-muted)' : 'transparent',
                border: `1px solid ${isArchived ? 'var(--t-success)' : 'var(--t-border)'}`,
                color: isArchived ? 'var(--t-success)' : 'var(--t-text-secondary)',
                borderRadius: 'var(--t-radius-sm)',
              }}
              onMouseEnter={(e) => {
                if (isArchived) return
                e.currentTarget.style.borderColor = 'var(--t-text-secondary)'
                e.currentTarget.style.color = 'var(--t-text)'
              }}
              onMouseLeave={(e) => {
                if (isArchived) return
                e.currentTarget.style.borderColor = 'var(--t-border)'
                e.currentTarget.style.color = 'var(--t-text-secondary)'
              }}
            >
              {isArchived ? <BookmarkCheck size={10} /> : <BookmarkPlus size={10} />}
              {isArchived ? '已归档' : '归档'}
            </button>
          </div>
        </div>
      </div>

      {/* ── skills strip ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-4 flex-wrap"
        style={{
          borderTop: '1px solid var(--t-border-subtle)',
          background: 'var(--t-bg-elevated)',
          minHeight: 36,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <span className="font-mono text-[10px] flex-shrink-0 mr-1" style={{ color: 'var(--t-text-muted)' }}>
          技能&amp;经验
        </span>
        {c.function_name && <Chip accent>{c.function_name}</Chip>}
        {c.english_level  && <Chip>英语 {c.english_level}</Chip>}
        {(visibleStrip.length > 0 ? visibleStrip : stripFallback).map((t, i) => (
          <Chip key={i}>{t}</Chip>
        ))}
        {overflowCnt > 0 && (
          <span className="font-mono text-[10px]" style={{ color: 'var(--t-text-muted)' }}>+{overflowCnt}</span>
        )}
        {!c.function_name && !c.english_level && visibleStrip.length === 0 && stripFallback.length === 0 && (
          <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>暂无标签</span>
        )}
      </div>

    </div>
  )
}
