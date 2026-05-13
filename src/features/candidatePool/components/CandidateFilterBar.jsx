import { Search, X } from 'lucide-react'
import RegionSelector from '../../../components/RegionSelector'
import { FUNCTION_OPTIONS, AVAIL_OPTIONS } from '../constants'

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
  terminal,
}) {
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }
    : undefined
  const selectClass = terminal
    ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
    : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'

  return (
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
            className={terminal ? 'flex-1 px-2 py-1 text-xs rounded-lg border' : 'flex-1 px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'}
            style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' } : undefined}
          >
            {myJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
      )}

      {jobsReady && myJobs.length === 0 && (
        <p
          className={terminal ? 'mb-3 rounded-lg border px-3 py-2 text-xs' : 'mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700'}
          style={terminal ? { background: 'rgba(251, 191, 36, 0.12)', borderColor: 'var(--t-warning)', color: 'var(--t-warning)' } : undefined}
        >
          当前没有可邀约的已发布岗位。请先发布岗位。
        </p>
      )}

      <form onSubmit={onSearch} className="space-y-2">
        <div className="relative">
          <Search size={13} className={terminal ? 'absolute left-3 top-1/2 -translate-y-1/2' : 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索姓名、职位或城市..."
            className={terminal
              ? 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none'
              : 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
            }
            style={terminal ? inputStyle : undefined}
          />
        </div>

        <RegionSelector value={location} onChange={onLocationChange} terminal={terminal} placeholder="按地区筛选（省 / 市 / 区 / 海外国家）" />

        <select
          value={functionCode}
          onChange={e => onFunctionChange(e.target.value)}
          className={selectClass}
          style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: functionCode ? 'var(--t-text)' : 'var(--t-text-muted)' } : undefined}
        >
          <option value="">按业务方向筛选（全部）</option>
          {FUNCTION_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select value={archiveFilter} onChange={e => setArchiveFilter(e.target.value)} className={selectClass}
            style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: archiveFilter === 'all' ? 'var(--t-text-muted)' : 'var(--t-text)' } : undefined}>
            <option value="all">归档：全部</option>
            <option value="archived">已归档</option>
            <option value="not_archived">未归档</option>
          </select>
          <select value={inviteFilter} onChange={e => setInviteFilter(e.target.value)} className={selectClass}
            style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: inviteFilter === 'all' ? 'var(--t-text-muted)' : 'var(--t-text)' } : undefined}>
            <option value="all">邀约：全部</option>
            <option value="invited">已邀约</option>
            <option value="not_invited">未邀约</option>
          </select>
          <select value={avail} onChange={e => setAvail(e.target.value)} className={selectClass}
            style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: avail === 'open' ? 'var(--t-text)' : 'var(--t-text-muted)' } : undefined}>
            {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={gender ?? ''} onChange={e => setGender(e.target.value)} className={selectClass}
            style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: gender ? 'var(--t-text)' : 'var(--t-text-muted)' } : undefined}>
            <option value="">性别：全部</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className={terminal ? 'flex-1 py-1.5 text-xs text-white rounded-lg transition-colors' : 'flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
            style={terminal ? { background: 'var(--t-primary)' } : undefined}
          >
            搜索
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={onReset}
              className={terminal ? 'px-2 py-1.5 text-xs rounded-lg border transition-colors' : 'px-2 py-1.5 text-xs text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50'}
              style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' } : undefined}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </form>

      {!loading && (
        <p className={terminal ? 'text-xs mt-2' : 'text-xs text-slate-400 mt-2'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
          共 {total ?? candidates.length} 位候选人{hasFilter ? '（已筛选）' : ''}
        </p>
      )}
    </div>
  )
}
