import { useEffect, useRef } from 'react'

const FALLBACK_TICKER = [
  { function_name: 'Sea',                area_name: 'East China',  candidates: 0, jobs: 0 },
  { function_name: 'Air',                area_name: 'South China', candidates: 0, jobs: 0 },
  { function_name: 'Road',               area_name: 'North China', candidates: 0, jobs: 0 },
  { function_name: 'Railway',            area_name: 'East China',  candidates: 0, jobs: 0 },
  { function_name: 'Contract Logistics', area_name: 'West China',  candidates: 0, jobs: 0 },
  { function_name: 'ECOMS',              area_name: 'South China', candidates: 0, jobs: 0 },
  { function_name: 'Sea',                area_name: 'North China', candidates: 0, jobs: 0 },
  { function_name: 'Air',                area_name: 'South China', candidates: 0, jobs: 0 },
]

// px per second
const SPEED = 80

export default function MarketTicker({ items }) {
  const base = Array.isArray(items) && items.length ? items : FALLBACK_TICKER
  // 重复到至少能循环
  const list = Array.from({ length: 6 }, () => base).flat()

  const trackRef = useRef(null)
  const rafRef   = useRef(null)
  const xRef     = useRef(0)
  const lastTRef = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const step = (ts) => {
      if (lastTRef.current == null) lastTRef.current = ts
      const dt = (ts - lastTRef.current) / 1000   // seconds
      lastTRef.current = ts

      xRef.current -= SPEED * dt
      // 当滚出 track 一半时重置，实现无缝循环
      const halfW = track.scrollWidth / 2
      if (Math.abs(xRef.current) >= halfW) {
        xRef.current += halfW
      }
      track.style.transform = `translateX(${xRef.current}px)`
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{
      width: '100%',
      height: 40,
      overflow: 'hidden',
      background: '#0d1829',
      borderBottom: '1px solid #1e2d40',
      flexShrink: 0,
    }}>
      {/* double the list so half-width reset is always seamless */}
      <div
        ref={trackRef}
        style={{
          display: 'inline-flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          height: 40,
          whiteSpace: 'nowrap',
        }}
      >
        {[...list, ...list].map((item, idx) => (
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
      gap: 10,
      height: 40,
      padding: '0 28px',
      borderRight: '1px solid #1e2d40',
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
    }}>
      <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
        {item.function_name}&nbsp;·&nbsp;{item.area_name}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: '#4b5a6e', fontSize: 10 }}>Candidates</span>
        <span style={{ color: '#22d3ee', fontSize: 12, fontWeight: 700 }}>{item.candidates}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: '#4b5a6e', fontSize: 10 }}>Jobs</span>
        <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>{item.jobs}</span>
      </span>
    </span>
  )
}
