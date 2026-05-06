import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, Search, X, Loader2, FolderOpen,
  AlertCircle, GraduationCap, Send, CheckCircle, MessageSquare, User, Star,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { InviteModal } from '../../components/ui/InviteModal'
import { candidatesApi } from '../../api/candidates'
import { jobsApi } from '../../api/jobs'
import { invitationsApi } from '../../api/invitations'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import RegionSelector from '../../components/RegionSelector'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

const AVAIL_OPTIONS = [
  { value: 'open',    label: '开放机会' },
  { value: 'passive', label: '被动寻找' },
  { value: 'all',     label: '全部' },
]

function FreshBadge({ days }) {
  if (days == null) return null
  if (days <= 3) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
      {days <= 1 ? '今日更新' : `${days}天内更新`}
    </span>
  )
  if (days <= 7) return <Badge color="blue">{days}天内更新</Badge>
  return null
}

function AvailBadge({ status }) {
  if (status === 'open')    return <Badge color="green">开放机会</Badge>
  if (status === 'passive') return <Badge color="blue">被动寻找</Badge>
  return <Badge color="gray">暂不考虑</Badge>
}

function Toast({ name, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl">
      <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
      <span className="text-sm font-medium">已向 <strong>{name}</strong> 发出邀约</span>
    </div>
  )
}

// ── 右侧详情面板 ──────────────────────────────────────────────────────────────
function CandidateDetailPanel({
  candidate,
  isInvited,
  threadId,
  onInvite,
  messagesBasePath = '/messages',
  terminal = false,
  canInvite = true,
  inviteDisabledText = '请先发布岗位',
}) {
  const navigate = useNavigate()
  const tagsByCat = candidate.tags_by_category || {}
  const isPrivate = !!candidate.private_visible

  const titleColor   = terminal ? { color: 'var(--t-text)' } : undefined
  const subColor     = terminal ? { color: 'var(--t-text-secondary)' } : undefined
  const mutedColor   = terminal ? { color: 'var(--t-text-muted)' } : undefined
  const accentColor  = terminal ? { color: 'var(--t-chart-blue)' } : undefined
  const cellStyle    = terminal
    ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)' }
    : undefined

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div
          className={
            terminal
              ? 'w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0'
              : `w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${
                  isInvited ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                }`
          }
          style={
            terminal
              ? { background: isInvited ? 'var(--t-success)' : 'var(--t-primary)' }
              : undefined
          }
        >
          {isInvited ? <CheckCircle size={24} /> : (candidate.full_name?.[0] ?? '?')}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={terminal ? 'text-lg font-bold' : 'text-lg font-bold text-slate-800'} style={titleColor}>
              {candidate.full_name}
            </h2>
            {isInvited && (
              <span
                className={
                  terminal
                    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium'
                    : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium'
                }
                style={
                  terminal
                    ? {
                        background: 'rgba(34, 197, 94, 0.12)',
                        color: 'var(--t-success)',
                        borderColor: 'var(--t-success)',
                      }
                    : undefined
                }
              >
                <CheckCircle size={10} />邀约已发出
              </span>
            )}
            <FreshBadge days={candidate.freshness_days} />
            {candidate.availability_status && <AvailBadge status={candidate.availability_status} />}
            {!isPrivate && (
              <span
                className={
                  terminal
                    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border'
                    : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200'
                }
                style={
                  terminal
                    ? {
                        background: 'rgba(251, 191, 36, 0.12)',
                        color: 'var(--t-warning)',
                        borderColor: 'var(--t-warning)',
                      }
                    : undefined
                }
              >
                匿名
              </span>
            )}
          </div>
          {(candidate.current_title || (isPrivate && candidate.current_company)) && (
            <p className={terminal ? 'text-sm mt-0.5' : 'text-sm text-slate-500 mt-0.5'} style={subColor}>
              {candidate.current_title}
              {isPrivate && candidate.current_company ? ` · ${candidate.current_company}` : ''}
            </p>
          )}
          {candidate.expected_salary_label && (
            <p className={terminal ? 'text-base font-bold mt-1' : 'text-base font-bold text-blue-600 mt-1'} style={accentColor}>
              {candidate.expected_salary_label}
            </p>
          )}
        </div>
      </div>

      {/* 基本信息卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Briefcase,     label: '工作年限', value: candidate.experience_years != null ? `${candidate.experience_years} 年` : (isPrivate ? '—' : '🔒') },
          { icon: GraduationCap, label: '学历',     value: candidate.education ?? (isPrivate ? '—' : '🔒') },
          { icon: User,          label: '年龄',     value: candidate.age != null ? `${candidate.age} 岁` : (isPrivate ? '—' : '🔒') },
          { icon: MapPin,        label: '期望城市/地区', value: candidate.expected_city || candidate.location_name || candidate.business_area_name || '不限' },
        ].map(item => (
          <div
            key={item.label}
            className={terminal ? 'rounded-xl px-3 py-2.5' : 'bg-slate-50 rounded-xl px-3 py-2.5'}
            style={cellStyle}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon size={12} className={terminal ? '' : 'text-slate-400'} style={mutedColor} />
              <p className={terminal ? 'text-[10px]' : 'text-[10px] text-slate-400'} style={mutedColor}>{item.label}</p>
            </div>
            <p className={terminal ? 'text-sm font-semibold' : 'text-sm font-semibold text-slate-700'} style={subColor}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* 能力画像（永远公开 — 用于企业判断是否邀约） */}
      {(candidate.function_name || candidate.is_management_role != null
        || (candidate.knowledge_tags?.length ?? 0) > 0
        || (candidate.hard_skill_tags?.length ?? 0) > 0
        || (candidate.soft_skill_tags?.length ?? 0) > 0) && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            能力画像
          </p>
          {(candidate.function_name || candidate.is_management_role != null) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {candidate.function_name && (
                <span
                  className={
                    terminal
                      ? 'inline-flex items-center px-2 py-0.5 text-xs rounded-full border'
                      : 'inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100'
                  }
                  style={
                    terminal
                      ? { background: 'rgba(96,165,250,0.12)', color: 'var(--t-chart-blue)', borderColor: 'var(--t-border)' }
                      : undefined
                  }
                >
                  业务 · {candidate.function_name}
                </span>
              )}
              {candidate.is_management_role != null && (
                <span
                  className={
                    terminal
                      ? 'inline-flex items-center px-2 py-0.5 text-xs rounded-full border'
                      : 'inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700'
                  }
                  style={
                    terminal
                      ? { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' }
                      : undefined
                  }
                >
                  {candidate.is_management_role ? '管理岗位' : '非管理岗位'}
                </span>
              )}
            </div>
          )}
          {[
            { label: '知识',   tags: candidate.knowledge_tags },
            { label: '硬技能', tags: candidate.hard_skill_tags },
            { label: '软技能', tags: candidate.soft_skill_tags },
          ].filter(g => Array.isArray(g.tags) && g.tags.length > 0).map(g => (
            <div key={g.label} className="mb-2 last:mb-0">
              <p className={terminal ? 'text-xs mb-1' : 'text-xs text-slate-400 mb-1'} style={mutedColor}>{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.tags.map((n, i) => (
                  <span
                    key={i}
                    className={
                      terminal
                        ? 'px-2 py-0.5 text-xs rounded-full border'
                        : 'px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700'
                    }
                    style={
                      terminal
                        ? {
                            background: 'var(--t-bg-elevated)',
                            color: 'var(--t-text-secondary)',
                            borderColor: 'var(--t-border)',
                          }
                        : undefined
                    }
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 联系方式 */}
      {isPrivate && (candidate.email || candidate.phone) && (
        <div
          className={terminal ? 'border rounded-xl p-4' : 'bg-blue-50 border border-blue-100 rounded-xl p-4'}
          style={
            terminal
              ? { background: 'rgba(96, 165, 250, 0.08)', borderColor: 'var(--t-border)' }
              : undefined
          }
        >
          <p
            className={terminal ? 'text-xs font-medium mb-2' : 'text-xs font-medium text-blue-700 mb-2'}
            style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
          >
            联系方式
          </p>
          {candidate.phone && (
            <p className={terminal ? 'text-sm' : 'text-sm text-blue-800'} style={terminal ? { color: 'var(--t-text)' } : undefined}>
              📱 {candidate.phone}
            </p>
          )}
          {candidate.email && (
            <p className={terminal ? 'text-sm mt-1' : 'text-sm text-blue-800 mt-1'} style={terminal ? { color: 'var(--t-text)' } : undefined}>
              ✉️ {candidate.email}
            </p>
          )}
        </div>
      )}
      {!isPrivate && (
        <div
          className={terminal ? 'border rounded-xl p-3' : 'bg-amber-50 border border-amber-100 rounded-xl p-3'}
          style={
            terminal
              ? { background: 'rgba(251, 191, 36, 0.08)', borderColor: 'var(--t-border)' }
              : undefined
          }
        >
          <p
            className={terminal ? 'text-xs' : 'text-xs text-amber-700'}
            style={terminal ? { color: 'var(--t-warning)' } : undefined}
          >
            🔒 候选人接受邀约或主动投递后，您将看到完整联系方式与经历。
          </p>
        </div>
      )}

      {/* 当前任职（私有：职责 + 当前薪酬结构） */}
      {isPrivate && (
        candidate.current_company ||
        candidate.current_responsibilities ||
        candidate.current_salary_min != null ||
        candidate.current_salary_max != null ||
        candidate.current_salary_months != null ||
        candidate.current_average_bonus_percent != null ||
        candidate.current_has_year_end_bonus != null
      ) && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            当前任职
          </p>
          {candidate.current_company && (
            <p className={terminal ? 'text-sm mb-1' : 'text-sm text-slate-700 mb-1'} style={subColor}>
              {candidate.current_company}
              {candidate.current_title ? ` · ${candidate.current_title}` : ''}
            </p>
          )}
          {candidate.current_responsibilities && (
            <p
              className={terminal ? 'text-sm leading-relaxed whitespace-pre-line mb-2' : 'text-sm text-slate-600 leading-relaxed whitespace-pre-line mb-2'}
              style={subColor}
            >
              {candidate.current_responsibilities}
            </p>
          )}
          {(candidate.current_salary_min != null ||
            candidate.current_salary_max != null ||
            candidate.current_salary_months != null ||
            candidate.current_average_bonus_percent != null ||
            candidate.current_has_year_end_bonus != null) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: '当前月薪',
                  value: (candidate.current_salary_min != null || candidate.current_salary_max != null)
                    ? `${candidate.current_salary_min ?? '—'} ~ ${candidate.current_salary_max ?? '—'}`
                    : '—',
                },
                {
                  label: '薪资月数',
                  value: candidate.current_salary_months != null ? `${candidate.current_salary_months} 月` : '—',
                },
                {
                  label: '平均奖金',
                  value: candidate.current_average_bonus_percent != null ? `${candidate.current_average_bonus_percent}%` : '—',
                },
                {
                  label: '年终奖',
                  value: candidate.current_has_year_end_bonus
                    ? (candidate.current_year_end_bonus_months != null
                        ? `${candidate.current_year_end_bonus_months} 月`
                        : '有')
                    : (candidate.current_has_year_end_bonus === false ? '无' : '—'),
                },
              ].map(item => (
                <div
                  key={item.label}
                  className={terminal ? 'rounded-xl px-3 py-2.5' : 'bg-slate-50 rounded-xl px-3 py-2.5'}
                  style={cellStyle}
                >
                  <p className={terminal ? 'text-[10px] mb-0.5' : 'text-[10px] text-slate-400 mb-0.5'} style={mutedColor}>{item.label}</p>
                  <p className={terminal ? 'text-sm font-semibold' : 'text-sm font-semibold text-slate-700'} style={subColor}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 工作经历 */}
      {isPrivate && (candidate.work_experiences?.length > 0) && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            工作经历
          </p>
          <div className="space-y-3">
            {candidate.work_experiences.map((w, i) => {
              const company = w.company_name || w.company || '—'
              const period = w.period
                || (w.start_month || w.end_month
                  ? `${w.start_month || '?'} – ${w.end_month || '至今'}`
                  : '—')
              const salaryRange = (w.salary_min != null || w.salary_max != null)
                ? `${w.salary_min ?? '—'} ~ ${w.salary_max ?? '—'}`
                : null
              const yebText = w.has_year_end_bonus
                ? (w.year_end_bonus_months != null ? `${w.year_end_bonus_months} 月` : '有')
                : (w.has_year_end_bonus === false ? '无' : null)
              return (
                <div
                  key={i}
                  className={terminal ? 'border-l-2 pl-3 py-1' : 'border-l-2 border-blue-200 pl-3 py-1'}
                  style={terminal ? { borderColor: 'var(--t-chart-blue)' } : undefined}
                >
                  <p className={terminal ? 'text-sm font-medium' : 'text-sm font-medium text-slate-800'} style={titleColor}>
                    {w.title || '—'} · {company}
                  </p>
                  <p className={terminal ? 'text-xs' : 'text-xs text-slate-500'} style={subColor}>{period}</p>
                  {w.responsibilities && (
                    <p className={terminal ? 'text-xs mt-1 leading-relaxed whitespace-pre-line' : 'text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line'} style={subColor}>
                      <span className={terminal ? 'mr-1' : 'mr-1 text-slate-400'} style={mutedColor}>职责：</span>
                      {w.responsibilities}
                    </p>
                  )}
                  {w.achievements && (
                    <p className={terminal ? 'text-xs mt-1 leading-relaxed whitespace-pre-line' : 'text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line'} style={subColor}>
                      <span className={terminal ? 'mr-1' : 'mr-1 text-slate-400'} style={mutedColor}>成就：</span>
                      {w.achievements}
                    </p>
                  )}
                  {(salaryRange || w.salary_months != null || w.average_bonus_percent != null || yebText != null) && (
                    <p className={terminal ? 'text-xs mt-1' : 'text-xs text-slate-500 mt-1'} style={subColor}>
                      {salaryRange && <span className="mr-2">薪资 {salaryRange}</span>}
                      {w.salary_months != null && <span className="mr-2">{w.salary_months} 月</span>}
                      {w.average_bonus_percent != null && <span className="mr-2">奖金 {w.average_bonus_percent}%</span>}
                      {yebText && <span>年终奖 {yebText}</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 教育经历 */}
      {isPrivate && (candidate.education_experiences?.length > 0) && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            教育经历
          </p>
          <div className="space-y-2">
            {candidate.education_experiences.map((e, i) => (
              <div
                key={i}
                className={terminal ? 'border-l-2 pl-3 py-1' : 'border-l-2 border-purple-200 pl-3 py-1'}
                style={terminal ? { borderColor: 'var(--t-chart-purple)' } : undefined}
              >
                <p className={terminal ? 'text-sm font-medium' : 'text-sm font-medium text-slate-800'} style={titleColor}>
                  {e.school || '—'} · {e.major || '—'}
                  {e.degree && (
                    <span
                      className={terminal ? 'ml-2 text-xs' : 'ml-2 text-xs text-slate-500'}
                      style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                    >
                      {e.degree}
                    </span>
                  )}
                </p>
                <p className={terminal ? 'text-xs' : 'text-xs text-slate-500'} style={subColor}>{e.period || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 资格证书 */}
      {isPrivate && (candidate.certificates?.length > 0) && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            资格证书
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.certificates.map((c, i) => (
              <span
                key={i}
                className={
                  terminal
                    ? 'px-2.5 py-1 text-xs rounded-full border'
                    : 'px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full'
                }
                style={
                  terminal
                    ? {
                        background: 'rgba(34, 197, 94, 0.12)',
                        color: 'var(--t-success)',
                        borderColor: 'var(--t-border)',
                      }
                    : undefined
                }
              >
                🎓 {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 按分类显示标签（公开） */}
      {Object.keys(tagsByCat).length > 0 && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            标签
          </p>
          <div className="space-y-2">
            {Object.entries(tagsByCat).map(([cat, names]) => (
              <div key={cat}>
                <p className={terminal ? 'text-xs mb-1' : 'text-xs text-slate-400 mb-1'} style={mutedColor}>{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <span
                      key={i}
                      className={
                        terminal
                          ? 'px-2 py-0.5 text-xs rounded-full border'
                          : 'px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full'
                      }
                      style={
                        terminal
                          ? {
                              background: 'var(--t-bg-elevated)',
                              color: 'var(--t-text-secondary)',
                              borderColor: 'var(--t-border)',
                            }
                          : undefined
                      }
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.summary && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            个人简介
          </p>
          <p
            className={terminal ? 'text-sm leading-relaxed whitespace-pre-line' : 'text-sm text-slate-600 leading-relaxed whitespace-pre-line'}
            style={subColor}
          >
            {candidate.summary}
          </p>
        </div>
      )}

      <div
        className={terminal ? 'flex items-center gap-2 pt-2 border-t' : 'flex items-center gap-2 pt-2 border-t border-slate-100'}
        style={terminal ? { borderColor: 'var(--t-border-subtle)' } : undefined}
      >
        {isInvited ? (
          <span
            className={
              terminal
                ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border font-medium'
                : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium'
            }
            style={
              terminal
                ? {
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: 'var(--t-success)',
                    borderColor: 'var(--t-success)',
                  }
                : undefined
            }
          >
            <CheckCircle size={14} />已发出邀约
          </span>
        ) : (
          <button
            type="button"
            disabled={!canInvite}
            title={!canInvite ? inviteDisabledText : undefined}
            onClick={() => {
              if (canInvite) onInvite(candidate)
            }}
            className={
              terminal
                ? `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white transition-colors ${canInvite ? '' : 'cursor-not-allowed opacity-50'}`
                : `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 ${canInvite ? '' : 'cursor-not-allowed opacity-60 hover:bg-blue-600'}`
            }
            style={terminal ? { background: 'var(--t-primary)' } : undefined}
          >
            <Send size={14} />{canInvite ? '发起邀约' : inviteDisabledText}
          </button>
        )}
        {isInvited && threadId && (
          <button
            onClick={() => navigate(`${messagesBasePath}/${threadId}`)}
            className={
              terminal
                ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border transition-colors'
                : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }
            style={
              terminal
                ? {
                    background: 'var(--t-bg-elevated)',
                    borderColor: 'var(--t-border)',
                    color: 'var(--t-text-secondary)',
                  }
                : undefined
            }
          >
            <MessageSquare size={14} />进入沟通
          </button>
        )}
      </div>
      {!isInvited && !canInvite && (
        <p
          className={terminal ? 'text-xs' : 'text-xs text-amber-600'}
          style={terminal ? { color: 'var(--t-warning)' } : undefined}
        >
          请先发布并上架至少一个岗位，才能向候选人发起邀约。
        </p>
      )}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function CandidatePool({ terminal = false, messagesBasePath = '/messages' }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [selected, setSelected]     = useState(null)

  const [invited, setInvited]           = useState({})
  const [modal, setModal]               = useState(null)
  const [toast, setToast]               = useState(null)
  const [myJobs, setMyJobs]             = useState([])
  const [selectedJob, setSelectedJob]   = useState(null)
  const [jobsReady, setJobsReady]       = useState(false)

  const [q, setQ]                 = useState('')
  const [avail, setAvail]         = useState('open')
  const [location, setLocation]   = useState(null)  // RegionSelector value
  const [functionCode, setFunctionCode] = useState('')

  function fetchCandidates(filters) {
    setLoading(true)
    setError('')
    candidatesApi.getCandidates(filters)
      .then(res => {
        const list = res.data.candidates
        setCandidates(list)
        if (list.length > 0) setSelected(prev => prev ?? list[0])
      })
      .catch(err => {
        console.error('Failed to load candidate pool:', {
          status: err.response?.status,
          data: err.response?.data,
          code: err.code,
          message: err.message,
        })
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载失败，请刷新重试'
        setError(errMsg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCandidates({ availability_status: 'open' })
    Promise.all([
      jobsApi.getMyJobs(),
      invitationsApi.getSentInvitations(),
    ]).then(([jobsRes, sentRes]) => {
      const published = (jobsRes.data.jobs ?? []).filter(j => j.status === 'published')
      setMyJobs(published)
      if (published.length > 0) setSelectedJob(published[0])
      const sentMap = {}
      for (const inv of (sentRes.data.invitations ?? [])) {
        if (inv.status !== 'declined') {
          sentMap[`${inv.job_id}_${inv.candidate_id}`] = inv.thread_id ?? true
        }
      }
      setInvited(sentMap)
    }).catch(err => {
      console.error('Failed to load employer jobs or sent invitations:', {
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
    }).finally(() => {
      setJobsReady(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildFilters(nextLocation = location, nextAvail = avail, nextQ = q, nextFn = functionCode) {
    return {
      availability_status: nextAvail,
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextLocation?.location_code ? { location_code: nextLocation.location_code } : {}),
      ...(nextFn ? { function_code: nextFn } : {}),
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    fetchCandidates(buildFilters())
  }

  function handleReset() {
    setQ(''); setAvail('open'); setLocation(null); setFunctionCode('')
    setSelected(null)
    fetchCandidates({ availability_status: 'open' })
  }

  function handleLocationChange(loc) {
    setLocation(loc)
    setSelected(null)
    fetchCandidates(buildFilters(loc, avail, q, functionCode))
  }

  function handleFunctionChange(code) {
    setFunctionCode(code)
    setSelected(null)
    fetchCandidates(buildFilters(location, avail, q, code))
  }

  const handleConfirm = useCallback((threadId) => {
    const key = `${selectedJob?.id}_${modal.id}`
    setInvited(prev => ({ ...prev, [key]: threadId ?? true }))
    setToast(modal.full_name)
    setModal(null)
  }, [modal, selectedJob])

  const hasFilter = q || avail !== 'open' || !!location?.location_code || !!functionCode
  const selectedInvKey = selectedJob && selected ? `${selectedJob.id}_${selected.id}` : null

  const poolBody = (
    <>
        {/* ── 左栏 ── */}
        <div
          className={
            terminal
              ? 'w-80 flex-shrink-0 flex flex-col overflow-hidden'
              : 'w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden'
          }
          style={terminal ? { background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)' } : undefined}
        >
          <div
            className={terminal ? 'p-4' : 'p-4 border-b border-slate-100'}
            style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
          >
            <h1
              className={terminal ? 'text-base font-semibold mb-1' : 'text-base font-semibold text-slate-800 mb-1'}
              style={terminal ? { color: 'var(--t-text)' } : undefined}
            >
              候选人池
            </h1>

            {myJobs.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={terminal ? 'text-xs whitespace-nowrap flex-shrink-0' : 'text-xs text-slate-500 whitespace-nowrap flex-shrink-0'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                >
                  邀约岗位：
                </span>
                <select
                  value={selectedJob?.id ?? ''}
                  onChange={e => setSelectedJob(myJobs.find(j => j.id === Number(e.target.value)) ?? null)}
                  className={
                    terminal
                      ? 'flex-1 px-2 py-1 text-xs rounded-lg border'
                      : 'flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          borderColor: 'var(--t-border)',
                          color: 'var(--t-text)',
                        }
                      : undefined
                  }
                >
                  {myJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
            )}
            {jobsReady && myJobs.length === 0 && (
              <p
                className={
                  terminal
                    ? 'mb-3 rounded-lg border px-3 py-2 text-xs'
                    : 'mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700'
                }
                style={
                  terminal
                    ? {
                        background: 'rgba(251, 191, 36, 0.12)',
                        borderColor: 'var(--t-warning)',
                        color: 'var(--t-warning)',
                      }
                    : undefined
                }
              >
                当前没有可邀约的已发布岗位。请先发布岗位。
              </p>
            )}

            <form onSubmit={handleSearch} className="space-y-2">
              <div className="relative">
                <Search
                  size={13}
                  className={terminal ? 'absolute left-3 top-1/2 -translate-y-1/2' : 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="搜索姓名、职位或城市..."
                  className={
                    terminal
                      ? 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none'
                      : 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          border: '1px solid var(--t-border)',
                          color: 'var(--t-text)',
                        }
                      : undefined
                  }
                />
              </div>
              <RegionSelector
                value={location}
                onChange={handleLocationChange}
                terminal={terminal}
                placeholder="按地区筛选（省 / 市 / 区 / 海外国家）"
              />
              <select
                value={functionCode}
                onChange={(e) => handleFunctionChange(e.target.value)}
                className={
                  terminal
                    ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                    : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                }
                style={
                  terminal
                    ? {
                        background: 'var(--t-bg-input)',
                        borderColor: 'var(--t-border)',
                        color: functionCode ? 'var(--t-text)' : 'var(--t-text-muted)',
                      }
                    : undefined
                }
              >
                <option value="">按业务方向筛选（全部）</option>
                {FUNCTION_OPTIONS.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={avail}
                  onChange={e => setAvail(e.target.value)}
                  className={
                    terminal
                      ? 'flex-1 px-2 py-1.5 text-xs rounded-lg border'
                      : 'flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          borderColor: 'var(--t-border)',
                          color: 'var(--t-text)',
                        }
                      : undefined
                  }
                >
                  {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  type="submit"
                  className={
                    terminal
                      ? 'flex-1 py-1.5 text-xs text-white rounded-lg transition-colors'
                      : 'flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                  }
                  style={terminal ? { background: 'var(--t-primary)' } : undefined}
                >
                  搜索
                </button>
                {hasFilter && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className={
                      terminal
                        ? 'px-2 py-1.5 text-xs rounded-lg border transition-colors'
                        : 'px-2 py-1.5 text-xs text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50'
                    }
                    style={
                      terminal
                        ? {
                            background: 'var(--t-bg-elevated)',
                            borderColor: 'var(--t-border)',
                            color: 'var(--t-text-secondary)',
                          }
                        : undefined
                    }
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </form>
            {!loading && !error && (
              <p
                className={terminal ? 'text-xs mt-2' : 'text-xs text-slate-400 mt-2'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                共 {candidates.length} 位候选人{hasFilter ? '（已筛选）' : ''}
              </p>
            )}
          </div>

          <div className={terminal ? 'flex-1 overflow-y-auto terminal-scrollbar' : 'flex-1 overflow-y-auto'}>
            {loading && (
              <div
                className={terminal ? 'flex items-center justify-center gap-2 py-16' : 'flex items-center justify-center gap-2 py-16 text-slate-400'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">加载中...</span>
              </div>
            )}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <AlertCircle
                  size={24}
                  className={terminal ? 'mb-2' : 'text-red-300 mb-2'}
                  style={terminal ? { color: 'var(--t-danger)' } : undefined}
                />
                <p
                  className={terminal ? 'text-xs text-center' : 'text-xs text-red-500 text-center'}
                  style={terminal ? { color: 'var(--t-danger)' } : undefined}
                >
                  {error}
                </p>
              </div>
            )}
            {!loading && !error && candidates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <FolderOpen
                  size={28}
                  className={terminal ? 'mb-2' : 'text-slate-300 mb-2'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                />
                <p
                  className={terminal ? 'text-xs text-center' : 'text-xs text-slate-400 text-center'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                >
                  暂无匹配候选人
                </p>
              </div>
            )}
            {!loading && !error && candidates.map(c => {
              const isSelected = selected?.id === c.id
              const invKey = selectedJob ? `${selectedJob.id}_${c.id}` : null
              const isInvited = invKey ? !!invited[invKey] : false

              const rowClass = terminal
                ? `p-4 cursor-pointer transition-all border-l-4 ${isSelected ? '' : 'border-l-transparent'}`
                : `p-4 cursor-pointer border-b border-slate-100 transition-all ${
                    isSelected
                      ? 'border-l-4 border-l-blue-500 bg-blue-50'
                      : 'border-l-4 border-l-transparent hover:bg-slate-50'
                  }`
              const rowStyle = terminal
                ? {
                    borderBottom: '1px solid var(--t-border-subtle)',
                    background: isSelected ? 'var(--t-bg-active)' : 'transparent',
                    borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
                  }
                : undefined

              const avatarStyle = terminal
                ? { background: isInvited ? 'var(--t-success)' : 'var(--t-primary)' }
                : undefined

              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={rowClass}
                  style={rowStyle}
                  onMouseEnter={(e) => {
                    if (terminal && !isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (terminal && !isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        terminal
                          ? 'w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0'
                          : `w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                              isInvited ? 'bg-emerald-500' : 'bg-blue-500'
                            }`
                      }
                      style={avatarStyle}
                    >
                      {isInvited ? <CheckCircle size={16} /> : (c.full_name?.[0] ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={terminal ? 'font-medium text-sm truncate' : 'font-medium text-sm text-slate-800 truncate'}
                        style={terminal ? { color: 'var(--t-text)' } : undefined}
                      >
                        {c.full_name}
                      </p>
                      <p
                        className={terminal ? 'text-xs truncate' : 'text-xs text-slate-500 truncate'}
                        style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
                      >
                        {c.current_title || (c.education && c.experience_years != null
                          ? `${c.education} · ${c.experience_years}年`
                          : c.education || (c.experience_years != null ? `${c.experience_years}年经验` : '匿名候选人'))}
                      </p>
                      <div
                        className={terminal ? 'flex items-center gap-2 text-xs mt-0.5 flex-wrap' : 'flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap'}
                        style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                      >
                        {(c.current_city || (c.tags_by_category?.['意向城市']?.[0])) && (
                          <span className="flex items-center gap-0.5">
                            <MapPin size={9} />
                            {c.current_city || c.tags_by_category['意向城市'][0]}
                          </span>
                        )}
                        {c.age != null && <span>{c.age}岁</span>}
                        {c.experience_years != null && c.current_title && <span>{c.experience_years}年</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p
                        className={terminal ? 'text-xs font-bold' : 'text-xs font-bold text-blue-600'}
                        style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
                      >
                        {c.expected_salary_label ?? '面议'}
                      </p>
                      <Star
                        size={16}
                        fill={isInvited ? 'currentColor' : 'none'}
                        className={terminal ? '' : ''}
                        style={terminal ? { color: isInvited ? 'var(--t-warning)' : 'var(--t-text-muted)' } : undefined}
                        {...(!terminal && { className: isInvited ? 'text-amber-500' : 'text-slate-300' })}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 右栏详情 ── */}
        <div
          className="flex-1 overflow-y-auto"
          style={terminal ? { background: 'var(--t-bg)' } : undefined}
        >
          {selected ? (
            <CandidateDetailPanel
              candidate={selected}
              isInvited={selectedInvKey ? !!invited[selectedInvKey] : false}
              threadId={selectedInvKey && typeof invited[selectedInvKey] === 'number'
                ? invited[selectedInvKey] : null}
              onInvite={setModal}
              messagesBasePath={messagesBasePath}
              terminal={terminal}
              canInvite={!!selectedJob}
              inviteDisabledText={jobsReady ? '请先发布岗位' : '岗位加载中'}
            />
          ) : (
            <div
              className={terminal ? 'h-full flex items-center justify-center' : 'h-full flex items-center justify-center text-slate-400'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              <div className="text-center">
                <User
                  size={40}
                  className={terminal ? 'mx-auto mb-3' : 'mx-auto mb-3 text-slate-300'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                />
                <p className="text-sm">点击左侧候选人查看详情</p>
              </div>
            </div>
          )}
        </div>
    </>
  )

  return (
    <>
      {modal && selectedJob && (
        <InviteModal
          candidate={modal}
          job={selectedJob}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
          terminal={terminal}
        />
      )}
      {toast && <Toast name={toast} onDone={() => setToast(null)} />}

      {terminal ? (
        <TerminalPageSurface split>{poolBody}</TerminalPageSurface>
      ) : (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">{poolBody}</div>
      )}
    </>
  )
}
