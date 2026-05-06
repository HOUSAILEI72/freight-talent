import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

export function TagBarChart({
  data = [],
  loading = false,
  color = "#60a5fa",
  label = "数量",
  fetchedAt,
  emptyText = "暂无数据",
}) {
  if (loading) {
    return <div className="h-[280px] bg-slate-100 animate-pulse rounded-lg" />
  }

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
        {emptyText}
      </div>
    )
  }

  const total = data.reduce((s, d) => s + (Number(d.count) || 0), 0)
  const nonZero = data.filter(d => (Number(d.count) || 0) > 0).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs text-slate-500">
          总计 <strong className="text-slate-800">{total}</strong> {label}
          <span className="ml-2 text-slate-400">
            （{data.length} 个周期，{nonZero} 个有数据）
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [v, label]} />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {fetchedAt && (
        <p className="text-xs text-slate-400 mt-1 text-right">
          数据更新于 {new Date(fetchedAt).toLocaleString("zh-CN")}
        </p>
      )}
    </div>
  )
}
