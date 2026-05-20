const FUNCTION_ZH = {
  'Sea': '海运',
  'Air': '空运',
  'Road': '陆运',
  'Railway': '铁路',
  'Contract Logistics': '合同物流',
  'ContractLogistics': '合同物流',
  'ECOMS': '跨境电商',
  'Customs': '报关',
  'Warehousing': '仓储',
}

const AREA_ZH = {
  'East China': '华东',
  'South China': '华南',
  'North China': '华北',
  'West China': '西部',
  'Central China': '华中',
  'Hong Kong': '香港',
  'Overseas': '海外',
  'Taiwan': '台湾',
}

function toZh(fn, area) {
  const f = FUNCTION_ZH[fn] ?? fn
  const a = AREA_ZH[area] ?? area
  return `${f} · ${a}`
}

const FALLBACK = [
  { function_name: 'Sea',                area_name: 'East China',  candidates: 0, jobs: 0 },
  { function_name: 'Air',                area_name: 'South China', candidates: 0, jobs: 0 },
  { function_name: 'Road',               area_name: 'North China', candidates: 0, jobs: 0 },
  { function_name: 'Railway',            area_name: 'East China',  candidates: 0, jobs: 0 },
  { function_name: 'Contract Logistics', area_name: 'West China',  candidates: 0, jobs: 0 },
  { function_name: 'ECOMS',              area_name: 'South China', candidates: 0, jobs: 0 },
  { function_name: 'Air',                area_name: 'North China', candidates: 0, jobs: 0 },
  { function_name: 'Sea',                area_name: 'Central China', candidates: 0, jobs: 0 },
]

// Duration scales with item count so speed stays constant (~90px/s)
// Each item is roughly 160px wide; total = items * 160
function calcDuration(count) {
  return Math.max(12, Math.round((count * 160) / 90))
}

export default function MarketTicker({ items }) {
  const base = Array.isArray(items) && items.length ? items : FALLBACK
  const dur = calcDuration(base.length)

  return (
    <div style={{
      width: '100%',
      height: 38,
      overflow: 'hidden',
      background: '#0d1829',
      borderBottom: '1px solid #1e2d40',
      flexShrink: 0,
      position: 'relative',
    }}>
      <style>{`
        @keyframes ticker-slide {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          display: inline-flex;
          flex-wrap: nowrap;
          align-items: center;
          height: 38px;
          white-space: nowrap;
          will-change: transform;
          animation: ticker-slide ${dur}s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
      {/* Two copies → seamless loop by sliding -50% */}
      <div className="ticker-track">
        {[...base, ...base].map((item, idx) => (
          <TickerItem key={idx} item={item} />
        ))}
      </div>
    </div>
  )
}

function TickerItem({ item }) {
  return (
    <span style={{
      display: 'inline-flex',
      flexShrink: 0,
      alignItems: 'center',
      gap: 12,
      height: 38,
      padding: '0 24px',
      borderRight: '1px solid #1e2d40',
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
    }}>
      <span style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 600, letterSpacing: '0.03em' }}>
        {toZh(item.function_name, item.area_name)}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <span style={{ color: '#64748b', fontSize: 10 }}>候选人</span>
        <span style={{ color: '#22d3ee', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{item.candidates}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <span style={{ color: '#64748b', fontSize: 10 }}>职位</span>
        <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{item.jobs}</span>
      </span>
    </span>
  )
}
