import { MapPin, Bookmark } from 'lucide-react'
import { getSubtitleText, formatExpectedSalary } from '../utils/candidateFormatters'

export function CandidateListItem({ c, isSelected, isInvited, isArchived, canInvite, terminal, onSelect, onArchive, onInvite }) {
  const rowClass = terminal
    ? `p-4 cursor-pointer border-l-4 t-card-pressable ${isSelected ? '' : 'border-l-transparent'}`
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
        transition: 'background 120ms, border-color 120ms, transform var(--t-dur-fast) var(--t-ease-std)',
      }
    : undefined

  return (
    <div
      onClick={onSelect}
      className={rowClass}
      style={rowStyle}
      onMouseEnter={(e) => { if (terminal && !isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
      onMouseLeave={(e) => { if (terminal && !isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex items-center gap-3">
        {/* 头像 */}
        <div
          className={
            terminal
              ? 'w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center text-white font-bold text-base flex-shrink-0'
              : 'w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center text-white font-bold text-base flex-shrink-0 bg-blue-500'
          }
          style={terminal ? { background: 'var(--t-primary)' } : undefined}
        >
          {c.avatar_url
            ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
            : (c.full_name?.[0] ?? '?')
          }
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={terminal ? 'font-medium text-sm truncate' : 'font-medium text-sm text-slate-800 truncate'} style={terminal ? { color: 'var(--t-text)' } : undefined}>
              {c.full_name}
            </p>
            {isArchived && terminal && (
              <span
                title="已收藏"
                style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(251,191,36,0.18)',
                  border: '1px solid var(--t-chart-amber)',
                  color: 'var(--t-chart-amber)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: 'var(--t-font-sans)',
                  letterSpacing: 0,
                }}
              >
                藏
              </span>
            )}
          </div>
          <p className={terminal ? 'text-xs truncate' : 'text-xs text-slate-500 truncate'} style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}>
            {getSubtitleText(c)}
          </p>
          {/* 行1：城市 / 年龄 / 经验 / 简历更新时间 / 求职状态 badge */}
          <div className={terminal ? 'flex items-center gap-2 text-xs mt-0.5 flex-wrap' : 'flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
            {(c.current_city || c.tags_by_category?.['意向城市']?.[0]) && (
              <span className="flex items-center gap-0.5">
                <MapPin size={9} />
                {c.current_city || c.tags_by_category['意向城市'][0]}
              </span>
            )}
            {c.age != null && <span>{c.age}岁</span>}
            {c.experience_years != null && c.current_title && <span>{c.experience_years}年</span>}
            {terminal && c.freshness_days != null && c.freshness_days <= 7 && (
              <span style={{ color: c.freshness_days <= 3 ? 'var(--t-success)' : 'var(--t-chart-blue)', fontWeight: 600 }}>
                {c.freshness_days <= 1 ? '今日更新' : `${c.freshness_days}天前更新`}
              </span>
            )}
            {terminal && c.availability_status && (() => {
              const isOpen = c.availability_status === 'open'
              const isPassiveNow = c.availability_status === 'passive_now'
              const isPassive = c.availability_status === 'passive'
              const label = isOpen ? '离职-随时到岗' : isPassiveNow ? '在职-月内到岗' : isPassive ? '在职-考虑机会' : '暂不考虑'
              const color = isOpen ? 'var(--t-success)' : isPassiveNow ? 'var(--t-warning)' : isPassive ? 'var(--t-chart-blue)' : 'var(--t-text-muted)'
              const bg = isOpen ? 'var(--t-success-muted)' : isPassiveNow ? 'rgba(245,158,11,0.1)' : isPassive ? 'rgba(96,165,250,0.12)' : 'rgba(148,163,184,0.1)'
              const border = color
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '1px 6px',
                  borderRadius: 'var(--t-radius-sm)',
                  border: `1px solid ${border}`,
                  background: bg,
                  color,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  lineHeight: '16px',
                }}>
                  {label}
                </span>
              )
            })()}
            {!terminal && c.availability_status && (
              <span className={
                c.availability_status === 'open' ? 'text-emerald-600 font-semibold' :
                c.availability_status === 'passive_now' ? 'text-amber-500 font-semibold' :
                c.availability_status === 'passive' ? 'text-blue-500 font-semibold' : 'text-slate-400'
              }>
                {c.availability_status === 'open' ? '离职-随时到岗' : c.availability_status === 'passive_now' ? '在职-月内到岗' : c.availability_status === 'passive' ? '在职-考虑机会' : '暂不考虑'}
              </span>
            )}
          </div>

          {/* 行2：目标岗位 + 期望薪资（仅在有值时渲染） */}
          {(c.desired_position || c.expected_salary_min != null || c.expected_salary_label) && (
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#64748b' }}>
              {c.desired_position && (
                <span style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}>
                  {c.desired_position}
                </span>
              )}
              {formatExpectedSalary(c.expected_salary_min, c.expected_salary_max, c.expected_salary_period, c.expected_salary_label) && (
                <span className={terminal ? 'font-semibold' : 'font-semibold text-blue-600'} style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}>
                  {formatExpectedSalary(c.expected_salary_min, c.expected_salary_max, c.expected_salary_period, c.expected_salary_label)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 右侧按钮 */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onArchive(c.id) }}
            className={terminal
              ? 'text-xs px-2 py-0.5 rounded w-18 text-center'
              : `text-xs px-2 py-0.5 rounded border transition-colors w-18 text-center ${
                  isArchived
                    ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
                    : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:text-slate-700'
                }`
            }
            style={terminal ? {
              border: isArchived ? '1px solid var(--t-success)' : '1px solid var(--t-text-muted)',
              color: isArchived ? 'var(--t-success)' : 'var(--t-text-secondary)',
              background: isArchived ? 'var(--t-success-muted)' : 'transparent',
              borderRadius: 'var(--t-radius-sm)',
              outline: 'none',
            } : undefined}
            onMouseEnter={(e) => {
              if (!terminal || isArchived) return
              e.currentTarget.style.borderColor = 'var(--t-text)'
              e.currentTarget.style.color = 'var(--t-text)'
            }}
            onMouseLeave={(e) => {
              if (!terminal || isArchived) return
              e.currentTarget.style.borderColor = 'var(--t-text-muted)'
              e.currentTarget.style.color = 'var(--t-text-secondary)'
            }}
          >
            {isArchived ? '已收藏' : '收藏'}
          </button>
          <button
            type="button"
            disabled={!canInvite && !isInvited}
            title={
              isInvited ? undefined
              : !canInvite && typeof canInvite === 'boolean' ? '需要订阅才能发起邀约'
              : undefined
            }
            onClick={(e) => { e.stopPropagation(); if (canInvite) onInvite(c) }}
            className={terminal
              ? 'text-xs px-2 py-0.5 rounded w-18 text-center'
              : `text-xs px-2 py-0.5 rounded border transition-colors w-18 text-center ${
                  isInvited
                    ? 'border-blue-300 text-blue-600 bg-blue-50 cursor-default'
                    : canInvite
                      ? 'border-slate-200 text-slate-500 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                      : 'border-slate-100 text-slate-300 bg-white cursor-not-allowed'
                }`
            }
            style={terminal ? {
              border: isInvited ? '1px solid var(--t-primary)' : '1px solid var(--t-text-muted)',
              color: isInvited ? 'var(--t-primary)' : canInvite ? 'var(--t-text-secondary)' : 'var(--t-text-muted)',
              background: isInvited ? 'var(--t-primary-muted)' : 'transparent',
              opacity: (!canInvite && !isInvited) ? 0.4 : 1,
              cursor: isInvited ? 'default' : !canInvite ? 'not-allowed' : 'pointer',
              borderRadius: 'var(--t-radius-sm)',
              outline: 'none',
            } : undefined}
            onMouseEnter={(e) => {
              if (!terminal || !canInvite || isInvited) return
              e.currentTarget.style.borderColor = 'var(--t-primary)'
              e.currentTarget.style.color = 'var(--t-primary)'
              e.currentTarget.style.background = 'var(--t-primary-muted)'
            }}
            onMouseLeave={(e) => {
              if (!terminal || !canInvite || isInvited) return
              e.currentTarget.style.borderColor = 'var(--t-text-muted)'
              e.currentTarget.style.color = 'var(--t-text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {isInvited ? '已邀约' : '面议邀约'}
          </button>
        </div>
      </div>
    </div>
  )
}
