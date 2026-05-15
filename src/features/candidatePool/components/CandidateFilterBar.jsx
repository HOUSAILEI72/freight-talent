import { Search, X, SlidersHorizontal } from 'lucide-react'
import RegionSelector from '../../../components/RegionSelector'
import { FUNCTION_OPTIONS, AVAIL_OPTIONS } from '../constants'

const SEL_STYLE = (terminal, hasValue) => terminal
  ? {
      background: 'var(--t-bg-input)',
      borderColor: hasValue ? 'var(--t-border-focus)' : 'var(--t-border)',
      color: hasValue ? 'var(--t-text)' : 'var(--t-text-muted)',
    }
  : undefined

const SEL_CLASS = (terminal) => terminal
  ? 'w-full px-2 py-1.5 text-xs rounded border focus:outline-none'
  : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'

export function CandidateFilterBar({
  q, setQ,
  avail, setAvail,
  location, onLocationChange,
  functionCode, onFunctionChange,
  gender, setGender,
  archiveFilter, setArchiveFilter,
  inviteFilter, setInviteFilter,
  hasFilter,
  onSearch, onReset,
  myJobs, selectedJob, setSelectedJob,
  jobsReady,
  loading, candidates, total,
  activePoolLabel,
  terminal,
}) {
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }
    : undefined

  return (
    <div style={terminal ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined}>

      {/* ── Header strip ── */}
      <div
        style={terminal
          ? {
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--t-border-subtle)',
              flexShrink: 0,
            }
          : { padding: '16px', borderBottom: '1px solid #f1f5f9' }
        }
      >
        {/* Title row */}
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal
            size={11}
            style={terminal ? { color: 'var(--t-text-muted)', flexShrink: 0 } : { color: '#94a3b8', flexShrink: 0 }}
          />
          <span
            style={terminal
              ? { fontFamily: 'var(--t-font-sans)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)' }
              : { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }
            }
          >
            {terminal ? 'FILTER' : '筛选条件'}
          </span>
          {terminal && activePoolLabel && (
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--t-font-sans)',
                fontSize: 9,
                color: 'var(--t-primary)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 90,
              }}
            >
              {activePoolLabel}
            </span>
          )}
        </div>

        {/* Result count */}
        {!loading && (
          <p style={terminal
            ? { fontSize: 10, color: 'var(--t-text-muted)', marginTop: 2 }
            : { fontSize: 11, color: '#94a3b8', marginTop: 2 }
          }>
            共 {total ?? candidates.length} 位{hasFilter ? '（已筛选）' : ''}
          </p>
        )}
      </div>

      {/* ── Scrollable form body ── */}
      <div
        className={terminal ? 'terminal-scrollbar' : ''}
        style={terminal
          ? { flex: 1, overflowY: 'auto', padding: '12px 14px 16px' }
          : { padding: '12px 16px 16px' }
        }
      >

        {/* Job selector */}
        {myJobs.length > 0 && (
          <div className="mb-3">
            <label
              style={terminal
                ? { display: 'block', fontSize: 9, fontFamily: 'var(--t-font-sans)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)', marginBottom: 4 }
                : { display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }
              }
            >
              邀约岗位
            </label>
            <select
              value={selectedJob?.id ?? ''}
              onChange={e => setSelectedJob(myJobs.find(j => j.id === Number(e.target.value)) ?? null)}
              className={SEL_CLASS(terminal)}
              style={SEL_STYLE(terminal, !!selectedJob)}
            >
              {myJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
        )}

        {jobsReady && myJobs.length === 0 && (
          <div
            className="mb-3 rounded px-3 py-2"
            style={terminal
              ? { background: 'rgba(245,158,11,0.08)', border: '1px solid var(--t-warning)', borderRadius: 'var(--t-radius-sm)' }
              : { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }
            }
          >
            <p style={terminal ? { fontSize: 10, color: 'var(--t-warning)' } : { fontSize: 11, color: '#92400e' }}>
              暂无已发布岗位，请先发布岗位后再邀约候选人。
            </p>
          </div>
        )}

        <form onSubmit={onSearch} className="space-y-2">

          {/* Search input */}
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
            />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="姓名 / 职位 / 城市..."
              className={terminal
                ? 'w-full pl-7 pr-3 py-1.5 text-xs rounded focus:outline-none'
                : 'w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
              }
              style={terminal ? { ...inputStyle, borderColor: q ? 'var(--t-border-focus)' : 'var(--t-border)', fontSize: 12 } : undefined}
            />
          </div>

          {/* Region */}
          <RegionSelector
            value={location}
            onChange={onLocationChange}
            terminal={terminal}
            placeholder="地区筛选（省 / 市 / 区）"
          />

          {/* Divider */}
          {terminal && (
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', margin: '6px 0' }} />
          )}

          {/* Section label */}
          {terminal && (
            <p style={{ fontFamily: 'var(--t-font-sans)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)', marginBottom: 4 }}>
              属性筛选
            </p>
          )}

          {/* Function */}
          <select
            value={functionCode}
            onChange={e => onFunctionChange(e.target.value)}
            className={SEL_CLASS(terminal)}
            style={SEL_STYLE(terminal, !!functionCode)}
          >
            <option value="">业务方向（全部）</option>
            {FUNCTION_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>

          {/* Availability */}
          <select
            value={avail}
            onChange={e => setAvail(e.target.value)}
            className={SEL_CLASS(terminal)}
            style={SEL_STYLE(terminal, avail !== 'open')}
          >
            {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Gender */}
          <select
            value={gender ?? ''}
            onChange={e => setGender(e.target.value)}
            className={SEL_CLASS(terminal)}
            style={SEL_STYLE(terminal, !!gender)}
          >
            <option value="">性别（不限）</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>

          {/* Divider */}
          {terminal && (
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', margin: '6px 0' }} />
          )}

          {/* Section label */}
          {terminal && (
            <p style={{ fontFamily: 'var(--t-font-sans)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)', marginBottom: 4 }}>
              互动状态
            </p>
          )}

          {/* Archive filter */}
          <select
            value={archiveFilter}
            onChange={e => setArchiveFilter(e.target.value)}
            className={SEL_CLASS(terminal)}
            style={SEL_STYLE(terminal, archiveFilter !== 'all')}
          >
            <option value="all">收藏（全部）</option>
            <option value="archived">已收藏</option>
            <option value="not_archived">未收藏</option>
          </select>

          {/* Invite filter */}
          <select
            value={inviteFilter}
            onChange={e => setInviteFilter(e.target.value)}
            className={SEL_CLASS(terminal)}
            style={SEL_STYLE(terminal, inviteFilter !== 'all')}
          >
            <option value="all">邀约（全部）</option>
            <option value="invited">已邀约</option>
            <option value="not_invited">未邀约</option>
          </select>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-1.5 text-xs rounded"
              style={terminal
                ? {
                    background: 'var(--t-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--t-radius-sm)',
                    fontFamily: 'var(--t-font-sans)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                  }
                : { background: '#2563eb', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer' }
              }
              onMouseEnter={e => { if (terminal) e.currentTarget.style.background = 'var(--t-primary-hover)' }}
              onMouseLeave={e => { if (terminal) e.currentTarget.style.background = 'var(--t-primary)' }}
            >
              {terminal ? 'SEARCH' : '搜索'}
            </button>
            {hasFilter && (
              <button
                type="button"
                onClick={onReset}
                className="px-2.5 py-1.5 text-xs rounded flex items-center justify-center"
                style={terminal
                  ? {
                      background: 'var(--t-bg-elevated)',
                      border: '1px solid var(--t-border)',
                      color: 'var(--t-text-secondary)',
                      borderRadius: 'var(--t-radius-sm)',
                      cursor: 'pointer',
                    }
                  : { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 6, cursor: 'pointer' }
                }
                onMouseEnter={e => { if (terminal) { e.currentTarget.style.borderColor = 'var(--t-text-muted)'; e.currentTarget.style.color = 'var(--t-text)' } }}
                onMouseLeave={e => { if (terminal) { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)' } }}
                title="清除筛选"
              >
                <X size={12} />
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  )
}
