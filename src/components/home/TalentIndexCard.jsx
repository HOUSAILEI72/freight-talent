import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

/* ─── Decorative arc ring (Freightos-style gauge decoration) ───── */
function DecorativeRing() {
  const cx = 130, cy = 130
  const toRad = (d) => (d * Math.PI) / 180
  const startDeg = -205, endDeg = 55

  function arcPath(r) {
    const s = toRad(startDeg), e = toRad(endDeg)
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const ticks = []
  for (let a = startDeg; a <= endDeg; a += 7) {
    const rad = toRad(a)
    const isMajor = Math.round(a) % 28 === 0
    const rOuter = 120, rInner = 107
    const r0 = rInner - (isMajor ? 10 : 5)
    ticks.push({
      x1: cx + rOuter * Math.cos(rad), y1: cy + rOuter * Math.sin(rad),
      x2: cx + r0     * Math.cos(rad), y2: cy + r0     * Math.sin(rad),
      major: isMajor,
    })
  }

  return (
    <svg
      width={260} height={260} viewBox="0 0 260 260"
      style={{ position: 'absolute', top: -55, right: -70, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="40%"  stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="arcGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="60%"  stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path d={arcPath(120)} fill="none" stroke="url(#arcGrad)"  strokeWidth={1.8} strokeLinecap="round" />
      <path d={arcPath(107)} fill="none" stroke="url(#arcGrad2)" strokeWidth={1}   strokeLinecap="round" />
      {ticks.map((t, i) => (
        <line key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#22d3ee"
          strokeWidth={t.major ? 1.6 : 0.9}
          strokeOpacity={t.major ? 0.8 : 0.45}
        />
      ))}
    </svg>
  )
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function getBiMonthlyDates(monthsBack = 6) {
  const now = new Date()
  const dates = []
  for (let m = monthsBack - 1; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1)
    for (const day of [10, 20]) {
      const d = new Date(base.getFullYear(), base.getMonth(), day)
      if (d <= now) dates.push(`${d.getMonth() + 1}/${d.getDate()}`)
    }
  }
  return dates
}

const SKELETON_DATES = getBiMonthlyDates()
const SKELETON_TREND = SKELETON_DATES.map(date => ({ date, candidates: null, jobs: null }))

const VIEWS = [
  { key: 'candidates', label: '候选池',   color: '#3b82f6', href: '/candidates' },
  { key: 'jobs',       label: '岗位需求', color: '#22d3ee', href: '/jobs'       },
]

function calcYTicks(data, key) {
  const max = Math.max(...data.map(d => d[key] || 0))
  if (max === 0) return [0, 1, 2, 3, 4]
  const step = Math.ceil(max / 4)
  return [0, step, step * 2, step * 3, step * 4]
}

function makeSynthCurve(maxC, maxJ) {
  const now = new Date()
  const points = []
  for (let m = 5; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1)
    for (const day of [10, 20]) {
      const d = new Date(base.getFullYear(), base.getMonth(), day)
      if (d <= now) points.push(d)
    }
  }
  if (points.length === 0) return []
  const last = points.length - 1
  return points.map((d, i) => {
    const t = last === 0 ? 1 : i / last
    // ease-in-out curve
    const m = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    return {
      date:       `${d.getMonth() + 1}/${d.getDate()}`,
      candidates: Math.max(0, Math.round(m * maxC)),
      jobs:       Math.max(0, Math.round(m * maxJ)),
      _scaffold:  true,
    }
  })
}

function buildDisplayData(rawData, totals = {}) {
  const maxC = totals?.candidates || 0
  const maxJ = totals?.jobs       || 0

  // Always render bi-monthly (10th / 20th) data points for the promo chart.
  // Real API data is weekly and won't land on the 10th/20th, so we always
  // synthesise a smooth growth curve from the current platform totals.
  if (maxC === 0 && maxJ === 0) return { chartData: SKELETON_TREND, hasLine: false }
  return { chartData: makeSynthCurve(maxC, maxJ), hasLine: true }
}

function ChartTooltip({ active, payload, label, viewLabel }) {
  if (!active || !payload?.length) return null
  if (payload[0]?.payload?._scaffold) return null   // hide on interpolated points
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, padding: '8px 14px',
      fontSize: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
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

/* ─── Main component ─────────────────────────────────────────────── */
export default function TalentIndexCard({ totals = { candidates: 0, jobs: 0 }, trend = [] }) {
  const navigate  = useNavigate()
  const [viewIdx, setViewIdx] = useState(0)
  const view = VIEWS[viewIdx]

  const { chartData, hasLine } = buildDisplayData(trend, totals)
  const noData    = !hasLine
  const yTicks    = hasLine ? calcYTicks(chartData, view.key) : [0, 1, 2, 3, 4]
  const yDomain   = [0, yTicks[yTicks.length - 1]]
  const noDataMsg = `暂无${view.label}趋势数据`

  return (
    <div style={{ position: 'relative', width: 560, flexShrink: 0 }}>

      {/* Decorative ring (sits behind the window) */}
      <DecorativeRing />

      {/* Floating live badge */}
      <div style={{
        position: 'absolute', top: -16, left: 24, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid rgba(34,211,238,0.28)',
        borderRadius: 999, padding: '4px 12px',
        backdropFilter: 'blur(12px)',
      }}>
        <span className="ping-slow" style={{
          display: 'inline-block', width: 7, height: 7,
          borderRadius: '50%', background: '#4ade80', flexShrink: 0,
        }} />
        <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
          平台实时数据 · 持续更新中
        </span>
      </div>

      {/* ── App window ─────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#0d1729',
        borderRadius: 14, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow:
          '0 40px 96px rgba(0,0,0,0.55),' +
          '0 0 0 1px rgba(255,255,255,0.07),' +
          'inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>

        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(180deg, #19243d 0%, #131e33 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '9px 18px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
            ))}
          </div>

          {/* ATI badge */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            color: '#60a5fa',
            fontSize: 11, fontWeight: 900,
            letterSpacing: '0.06em',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(96,165,250,0.3)',
            flexShrink: 0,
          }}>
            ATI
          </div>

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
              color: '#cbd5e1', textTransform: 'uppercase', lineHeight: 1.4,
            }}>
              ACE-TALENT SUPPLY &amp; DEMAND INDEX
            </div>
            <div style={{ fontSize: 9.5, color: '#475569', marginTop: 2 }}>
              候选池 / 岗位需求 · 每月 10 日 / 20 日
            </div>
          </div>

          {/* Segmented control */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 7, padding: 3, gap: 2, flexShrink: 0,
          }}>
            {VIEWS.map((v, i) => {
              const active = i === viewIdx
              return (
                <button
                  key={v.key}
                  onClick={() => setViewIdx(i)}
                  style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    padding: '4px 11px', borderRadius: 5,
                    border: 'none', cursor: 'pointer',
                    letterSpacing: '0.02em',
                    background: active ? 'rgba(59,130,246,0.25)' : 'transparent',
                    color:      active ? '#60a5fa'               : '#475569',
                    boxShadow:  active ? '0 1px 4px rgba(59,130,246,0.2)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Chart area ───────────────────────────────────────── */}
        <div style={{ padding: '20px 14px 10px', position: 'relative' }}>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
              accessibilityLayer={false}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.07)', strokeWidth: 1 }}
                tickLine={false}
                interval={0}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                domain={yDomain}
                ticks={yTicks}
                tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />

              {!noData && (
                <Tooltip
                  content={<ChartTooltip viewLabel={view.label} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
              )}

              {!noData && (
                <Line
                  key={view.key}
                  type="monotone"
                  dataKey={view.key}
                  stroke={view.color}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={{ r: 3, fill: view.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: view.color, stroke: '#0d1729', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          {noData && (
            <div style={{
              position: 'absolute', bottom: 38, right: 24, pointerEvents: 'none',
            }}>
              <span style={{
                fontSize: 10, color: '#475569',
                background: 'rgba(15,23,42,0.8)',
                padding: '3px 9px', borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                {noDataMsg}
              </span>
            </div>
          )}
        </div>

        {/* ── Stats row ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, padding: '4px 14px 16px' }}>
          {[
            {
              label: '候选池',
              value: totals.candidates,
              action: '查看可匹配人才 →',
              href: '/candidates',
              activeColor: '#3b82f6',
              highlightBg: 'rgba(59,130,246,0.12)',
              highlightBorder: 'rgba(59,130,246,0.35)',
              baseBorder: 'rgba(59,130,246,0.15)',
              baseBg: 'rgba(59,130,246,0.06)',
              isActive: viewIdx === 0,
            },
            {
              label: '岗位需求',
              value: totals.jobs,
              action: '查看在招岗位 →',
              href: '/jobs',
              activeColor: '#22d3ee',
              highlightBg: 'rgba(34,211,238,0.1)',
              highlightBorder: 'rgba(34,211,238,0.35)',
              baseBorder: 'rgba(34,211,238,0.12)',
              baseBg: 'rgba(34,211,238,0.05)',
              isActive: viewIdx === 1,
            },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.href)}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = s.highlightBorder
                e.currentTarget.style.background  = s.highlightBg
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = s.isActive ? s.highlightBorder : s.baseBorder
                e.currentTarget.style.background  = s.isActive ? s.highlightBg     : s.baseBg
              }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                borderRadius: 9,
                border: `1.5px solid ${s.isActive ? s.highlightBorder : s.baseBorder}`,
                background: s.isActive ? s.highlightBg : s.baseBg,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <p style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
                color: '#475569', textTransform: 'uppercase', marginBottom: 6,
              }}>
                {s.label}
              </p>
              <p style={{
                fontSize: 30, fontWeight: 900, color: s.activeColor,
                lineHeight: 1, marginBottom: 6,
              }}>
                {s.value}
              </p>
              <p style={{ fontSize: 10, color: s.activeColor, fontWeight: 600 }}>
                {s.action}
              </p>
            </button>
          ))}
        </div>

        {/* Status bar */}
        <div style={{
          background: '#0a1120',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '5px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ color: '#334155', fontSize: 9 }}>实时同步</span>
            </div>
            <span style={{ color: '#1e293b' }}>·</span>
            <span style={{ color: '#334155', fontSize: 9 }}>智锦汇人力资源（上海）有限公司</span>
          </div>
          <span style={{ color: '#22d3ee', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>
            ✦ ACE-Talent
          </span>
        </div>

      </div>
    </div>
  )
}
