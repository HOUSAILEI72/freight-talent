import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const SKELETON_TREND = Array.from({ length: 12 }, (_, i) => ({
  date: `W${i + 1}`,
  candidates: null,
  jobs: null,
}))

const VIEWS = [
  { key: 'candidates', label: '候选池',   color: '#2563eb', fillId: 'gradBlue', href: '/candidates' },
  { key: 'jobs',       label: '岗位需求', color: '#0891b2', fillId: 'gradCyan', href: '/jobs'       },
]

function formatDate(iso) {
  if (!iso || !iso.includes('-')) return iso
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isSeriesZero(data, key) {
  return data.every(d => (d[key] || 0) === 0)
}

function calcYTicks(data, key) {
  const max = Math.max(...data.map(d => d[key] || 0))
  if (max === 0) return [0, 1, 2, 3, 4]
  const step = Math.ceil(max / 4)
  return [0, step, step * 2, step * 3, step * 4]
}

function CustomTooltip({ active, payload, label, viewLabel }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #dde6f5',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 12,
      boxShadow: '0 4px 20px rgba(30,64,175,0.10)',
      minWidth: 130,
    }}>
      <p style={{ color: '#64748b', marginBottom: 6, fontWeight: 700, fontSize: 11 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, margin: '3px 0', fontSize: 12 }}>
          {viewLabel}
          <strong style={{ float: 'right', marginLeft: 16 }}>{p.value ?? 0}</strong>
        </p>
      ))}
    </div>
  )
}

const STAT_BTN = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  padding: '14px 18px',
  cursor: 'pointer',
  background: '#f8faff',
  border: '1.5px solid #e8f0fe',
  borderRadius: 10,
  textAlign: 'left',
  transition: 'border-color 0.15s, background 0.15s',
}

export default function TalentIndexCard({ totals = { candidates: 0, jobs: 0 }, trend = [] }) {
  const navigate  = useNavigate()
  const [viewIdx, setViewIdx] = useState(0)
  const view = VIEWS[viewIdx]

  const rawData  = trend.length > 0 ? trend : []
  const chartData = rawData.length > 0
    ? rawData.map(d => ({ ...d, date: formatDate(d.date) }))
    : SKELETON_TREND

  const noData  = rawData.length === 0 || isSeriesZero(chartData, view.key)
  const yTicks  = noData ? [0, 1, 2, 3, 4] : calcYTicks(chartData, view.key)
  const yDomain = [0, yTicks[yTicks.length - 1]]

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      boxShadow: '0 16px 56px rgba(30,64,175,0.16), 0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      width: 540,
      flexShrink: 0,
    }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #eef3fd 0%, #f4f7ff 100%)',
        borderBottom: '1px solid #dde6f5',
        padding: '14px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          background: '#fff',
          color: '#1e40af',
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: '0.04em',
          padding: '5px 10px',
          borderRadius: 6,
          border: '1.5px solid #1e40af',
          flexShrink: 0,
          lineHeight: 1.2,
        }}>
          ATI
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#1e3a6e',
            textTransform: 'uppercase',
            lineHeight: 1.4,
          }}>
            ACE-TALENT SUPPLY &amp; DEMAND INDEX
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
            候选池 / 岗位需求 · 最近 12 周
          </div>
        </div>

        {/* Segmented control */}
        <div style={{
          display: 'flex',
          background: '#e8f0fe',
          borderRadius: 8,
          padding: 3,
          gap: 2,
          flexShrink: 0,
        }}>
          {VIEWS.map((v, i) => {
            const active = i === viewIdx
            return (
              <button
                key={v.key}
                onClick={() => setViewIdx(i)}
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  background: active ? '#fff' : 'transparent',
                  color:      active ? '#1e40af' : '#64748b',
                  boxShadow:  active ? '0 1px 4px rgba(30,64,175,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────── */}
      <div style={{ padding: '22px 18px 10px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -10 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0891b2" stopOpacity={0.20} />
                <stop offset="100%" stopColor="#0891b2" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#eef2f9" vertical={false} strokeWidth={1} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              axisLine={{ stroke: '#dde6f5', strokeWidth: 1 }}
              tickLine={false}
              interval={1}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={30}
              allowDecimals={false}
            />

            {!noData && (
              <Tooltip
                content={<CustomTooltip viewLabel={view.label} />}
                cursor={false}
              />
            )}

            {!noData && (
              <Area
                key={view.key}
                type="monotone"
                dataKey={view.key}
                stroke={view.color}
                strokeWidth={2.8}
                fill={`url(#${view.fillId})`}
                dot={false}
                activeDot={{ r: 5, fill: view.color, stroke: '#fff', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {noData && (
          <div style={{
            position: 'absolute',
            bottom: 36,
            right: 28,
            pointerEvents: 'none',
          }}>
            <span style={{
              fontSize: 10,
              color: '#94a3b8',
              background: 'rgba(248,250,255,0.9)',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid #dde6f5',
            }}>
              暂无{view.label}趋势数据
            </span>
          </div>
        )}
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, padding: '6px 18px 20px' }}>
        <button
          style={{
            ...STAT_BTN,
            borderColor: viewIdx === 0 ? '#2563eb' : '#e8f0fe',
            background:  viewIdx === 0 ? '#f0f5ff' : '#f8faff',
          }}
          onClick={() => navigate('/candidates')}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#2563eb'
            e.currentTarget.style.background  = '#f0f5ff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = viewIdx === 0 ? '#2563eb' : '#e8f0fe'
            e.currentTarget.style.background  = viewIdx === 0 ? '#f0f5ff' : '#f8faff'
          }}
        >
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
            候选池
          </p>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#2563eb', lineHeight: 1, marginBottom: 6 }}>
            {totals.candidates}
          </p>
          <p style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>查看可匹配人才 →</p>
        </button>

        <button
          style={{
            ...STAT_BTN,
            borderColor: viewIdx === 1 ? '#0891b2' : '#e8f0fe',
            background:  viewIdx === 1 ? '#f0fdfe' : '#f8faff',
          }}
          onClick={() => navigate('/jobs')}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#0891b2'
            e.currentTarget.style.background  = '#f0fdfe'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = viewIdx === 1 ? '#0891b2' : '#e8f0fe'
            e.currentTarget.style.background  = viewIdx === 1 ? '#f0fdfe' : '#f8faff'
          }}
        >
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
            岗位需求
          </p>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#0e7490', lineHeight: 1, marginBottom: 6 }}>
            {totals.jobs}
          </p>
          <p style={{ fontSize: 10, color: '#0e7490', fontWeight: 600 }}>查看在招岗位 →</p>
        </button>
      </div>

    </div>
  )
}
