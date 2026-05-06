import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, Search, X, Loader2, FolderOpen,
  AlertCircle, GraduationCap, User, MessageSquare,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { candidatesApi } from '../../api/candidates'
import { getTags } from '../../api/tagsV2'

function useTagOptionsByCategory() {
  const [optMap, setOptMap] = useState({})
  useEffect(() => {
    getTags()
      .then(data => {
        const map = {}
        for (const t of data.tags || []) {
          if (!map[t.category]) map[t.category] = []
          map[t.category].push(t.name)
        }
        setOptMap(map)
      })
      .catch(() => {})
  }, [])
  return optMap
}

function AvailBadge({ status }) {
  if (status === 'open')    return <Badge color="green">开放机会</Badge>
  if (status === 'passive') return <Badge color="blue">被动寻找</Badge>
  return <Badge color="gray">暂不考虑</Badge>
}

function CandidateDetailPanel({ candidate }) {
  const navigate = useNavigate()
  const tagsByCat = candidate.tags_by_category || {}
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
          {candidate.full_name?.[0] ?? '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">{candidate.full_name}</h2>
            {candidate.availability_status && <AvailBadge status={candidate.availability_status} />}
          </div>
          {(candidate.current_title || candidate.current_company) && (
            <p className="text-sm text-slate-500 mt-0.5">
              {candidate.current_title}
              {candidate.current_company ? ` · ${candidate.current_company}` : ''}
            </p>
          )}
          {candidate.expected_salary_label && (
            <p className="text-base font-bold text-blue-600 mt-1">{candidate.expected_salary_label}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Briefcase,     label: '工作年限', value: candidate.experience_years != null ? `${candidate.experience_years} 年` : '—' },
          { icon: GraduationCap, label: '学历',     value: candidate.education ?? '—' },
          { icon: User,          label: '年龄',     value: candidate.age != null ? `${candidate.age} 岁` : '—' },
          { icon: MapPin,        label: '期望城市', value: candidate.expected_city ?? '不限' },
        ].map(item => (
          <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400">{item.label}</p>
            </div>
            <p className="text-sm font-semibold text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>

      {(candidate.email || candidate.phone) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-700 mb-2">联系方式（管理员可见）</p>
          {candidate.phone && <p className="text-sm text-blue-800">📱 {candidate.phone}</p>}
          {candidate.email && <p className="text-sm text-blue-800 mt-1">✉️ {candidate.email}</p>}
        </div>
      )}

      {candidate.work_experiences?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">工作经历</p>
          <div className="space-y-2">
            {candidate.work_experiences.map((w, i) => (
              <div key={i} className="border-l-2 border-blue-200 pl-3 py-1">
                <p className="text-sm font-medium text-slate-800">{w.title || '—'} · {w.company || '—'}</p>
                <p className="text-xs text-slate-500">{w.period || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.education_experiences?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">教育经历</p>
          <div className="space-y-2">
            {candidate.education_experiences.map((e, i) => (
              <div key={i} className="border-l-2 border-purple-200 pl-3 py-1">
                <p className="text-sm font-medium text-slate-800">
                  {e.school || '—'} · {e.major || '—'}
                  {e.degree && <span className="ml-2 text-xs text-slate-500">{e.degree}</span>}
                </p>
                <p className="text-xs text-slate-500">{e.period || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.certificates?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">资格证书</p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.certificates.map((c, i) => (
              <span key={i} className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                🎓 {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(tagsByCat).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">标签</p>
          <div className="space-y-2">
            {Object.entries(tagsByCat).map(([cat, names]) => (
              <div key={cat}>
                <p className="text-xs text-slate-400 mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">
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
          <p className="text-sm font-semibold text-slate-800 mb-2">个人简介</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{candidate.summary}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => navigate(`/messages`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <MessageSquare size={14} />消息中心
        </button>
      </div>
    </div>
  )
}

export default function AdminCandidates() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [selected, setSelected]     = useState(null)
  const tagOptions = useTagOptionsByCategory()

  const [q, setQ]                       = useState('')
  const [city, setCity]                 = useState('')
  const [businessType, setBusinessType] = useState('')
  const [jobType, setJobType]           = useState('')
  const [avail, setAvail]               = useState('all')

  const fetchCandidates = useCallback((filters) => {
    setLoading(true)
    setError('')
    candidatesApi.getCandidates(filters)
      .then(res => {
        const list = res.data.candidates
        setCandidates(list)
        if (list.length > 0) setSelected(prev => prev ?? list[0])
      })
      .catch(err => setError(err.response?.data?.message ?? '加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchCandidates({ availability_status: 'all' }) }, [fetchCandidates])

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    fetchCandidates({ q, city, business_type: businessType, job_type: jobType, availability_status: avail })
  }

  function handleReset() {
    setQ(''); setCity(''); setBusinessType(''); setJobType(''); setAvail('all')
    setSelected(null)
    fetchCandidates({ availability_status: 'all' })
  }

  const hasFilter = q || city || businessType || jobType || avail !== 'all'

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      {/* ── 左栏 ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-base font-semibold text-slate-800 mb-3">全量候选人</h1>
          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="搜索姓名、职位或城市..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <select value={city} onChange={e => setCity(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="">全部城市</option>
                {(tagOptions['城市'] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="">全部业务</option>
                {(tagOptions['业务类型'] || []).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <select value={jobType} onChange={e => setJobType(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="">全部类型</option>
                {(tagOptions['岗位类型'] || []).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={avail} onChange={e => setAvail(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="all">全部状态</option>
                <option value="open">开放机会</option>
                <option value="passive">被动寻找</option>
                <option value="closed">暂不考虑</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                搜索
              </button>
              {hasFilter && (
                <button type="button" onClick={handleReset}
                  className="px-2 py-1.5 text-xs text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <X size={12} />
                </button>
              )}
            </div>
          </form>
          {!loading && !error && (
            <p className="text-xs text-slate-400 mt-2">
              共 {candidates.length} 位候选人{hasFilter ? '（已筛选）' : ''}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <AlertCircle size={24} className="text-red-300 mb-2" />
              <p className="text-xs text-red-500 text-center">{error}</p>
            </div>
          )}
          {!loading && !error && candidates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FolderOpen size={28} className="text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 text-center">暂无匹配候选人</p>
            </div>
          )}
          {!loading && !error && candidates.map(c => {
            const isSelected = selected?.id === c.id
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className={`p-4 cursor-pointer border-b border-slate-100 transition-all ${
                  isSelected
                    ? 'border-l-4 border-l-blue-500 bg-blue-50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {c.full_name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{c.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.current_title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-0.5"><MapPin size={9} />{c.current_city}</span>
                      {c.experience_years != null && <span>{c.experience_years}年</span>}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-blue-600 flex-shrink-0">
                    {c.expected_salary_label ?? '面议'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 右栏详情 ── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <CandidateDetailPanel candidate={selected} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <User size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm">点击左侧候选人查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
