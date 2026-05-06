import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { getCandidateChart, getJobChart } from '../../api/chartApi'
import { TagBarChart } from '../../components/charts/TagBarChart'
import { GranularityTabs } from '../../components/charts/GranularityTabs'
import { ChartTagSelector } from '../../components/charts/ChartTagSelector'

function ChartSection({ title, fetchFn, color, label }) {
  const [tagGroups, setTagGroups] = useState({})
  const [gran, setGran] = useState('month')
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runQuery = async (groups, granularity, refresh = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchFn({ tagGroups: groups, granularity, periods: 12, refresh })
      console.log(`[${title}] chart response`, res)
      setChartData(res)
    } catch (e) {
      setError(e.response?.data?.detail || '查询失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runQuery({}, 'month') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuery = () => runQuery(tagGroups, gran, false)
  const handleRefresh = () => runQuery(tagGroups, gran, true)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          title="跳过缓存重新读取最新数据"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>
      <div className="flex flex-wrap gap-3 items-start mb-5">
        <div className="flex-1 min-w-[220px]">
          <ChartTagSelector value={tagGroups} onChange={setTagGroups} />
        </div>
        <GranularityTabs value={gran} onChange={setGran} />
        <button
          onClick={handleQuery}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? '查询中...' : '查询'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      <TagBarChart
        data={chartData?.data ?? []}
        loading={loading}
        color={color}
        label={label}
        fetchedAt={chartData?.fetched_at}
      />
    </div>
  )
}

export default function AdminCharts() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-slate-800">数据图表</h1>
        <p className="text-sm text-slate-500 mt-1">按标签查看候选人与岗位的活跃趋势</p>
      </div>

      <ChartSection
        title="候选人动态"
        fetchFn={getCandidateChart}
        color="#60a5fa"
        label="候选人数"
      />

      <ChartSection
        title="岗位动态"
        fetchFn={getJobChart}
        color="#34d399"
        label="岗位数"
      />
    </div>
  )
}
