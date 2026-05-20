import { useState, useEffect, useLayoutEffect, useRef } from 'react'

// ── Deterministic pseudo-random (seeded, no Math.random in render) ──
function prand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── Static layout data — computed once at module load ───────────────
const BAR_COUNT      = 22
const PARTICLE_COUNT = 11

// Bell-curve shaped heights with light per-bar noise
const BAR_SHAPES = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t     = i / (BAR_COUNT - 1)
  const bell  = Math.sin(t * Math.PI)
  const noise = (prand(i * 3 + 1) - 0.5) * 0.32
  return Math.max(0.1, Math.min(1, bell + noise))
})

// Per-bar animation timing
const BAR_PARAMS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  baseDur: 0.55 + prand(i * 7 + 2) * 0.55,
  delay:   i * 0.04,
}))

// Per-particle position & timing
const PARTICLE_PARAMS = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x:        6  + prand(i * 13 + 3) * 86,
  delay:    prand(i * 7  + 5) * 3.2,
  duration: 2.8 + prand(i * 11 + 7) * 2.0,
  size:     2   + prand(i * 17 + 9) * 3,
  drift:    (prand(i * 23 + 13) - 0.5) * 28,  // horizontal drift in px
}))

// ── Messages & labels ───────────────────────────────────────────────
const PHASE_MSGS = {
  thinking:   ['正在解析岗位信息', '理解行业背景', '分析岗位需求'],
  generating: ['生成职责描述中', '匹配专业标签库', '优化推荐内容', '整合软技能数据'],
  done:       ['分析完成'],
}
const PHASE_LABELS = {
  thinking:   'THINKING',
  generating: 'GENERATING',
  done:       'COMPLETE',
}

// ── Component ───────────────────────────────────────────────────────
export default function AIGeneratingAnimation({ isGenerating }) {
  const [phase,       setPhase]       = useState('idle')
  const [mounted,     setMounted]     = useState(false)
  const [msgIdx,      setMsgIdx]      = useState(0)
  const [charPos,     setCharPos]     = useState(0)
  const [displayText, setDisplayText] = useState('')
  const phaseRef = useRef('idle')
  useLayoutEffect(() => { phaseRef.current = phase }, [phase])

  // ── State machine: isGenerating → thinking → generating → done ───
  useEffect(() => {
    let t
    Promise.resolve().then(() => {
      if (isGenerating) {
        setMounted(true)
        setPhase('thinking')
        setMsgIdx(0)
        setCharPos(0)
        setDisplayText('')
        t = setTimeout(() => {
          if (phaseRef.current === 'thinking') {
            setPhase('generating')
            setMsgIdx(0)
            setCharPos(0)
            setDisplayText('')
          }
        }, 2400)
      } else if (phaseRef.current !== 'idle') {
        setPhase('done')
        setMsgIdx(0)
        setCharPos(0)
        setDisplayText('')
        t = setTimeout(() => {
          setMounted(false)
          setPhase('idle')
        }, 1800)
      }
    })
    return () => clearTimeout(t)
  }, [isGenerating])

  // ── Message cycling ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'thinking' && phase !== 'generating') return
    const msgs = PHASE_MSGS[phase]
    const t = setInterval(() => {
      setMsgIdx(i => (i + 1) % msgs.length)
      setCharPos(0)
      setDisplayText('')
    }, 2500)
    return () => clearInterval(t)
  }, [phase])

  // ── Typewriter ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'idle') return
    const msgs   = PHASE_MSGS[phase] || ['']
    const target = msgs[msgIdx % msgs.length]
    if (charPos >= target.length) return
    const t = setTimeout(() => {
      setDisplayText(target.slice(0, charPos + 1))
      setCharPos(c => c + 1)
    }, phase === 'done' ? 28 : 52)
    return () => clearTimeout(t)
  }, [phase, msgIdx, charPos])

  if (!mounted) return null

  const isActive  = phase === 'generating'
  const isDone    = phase === 'done'

  // ── Token-based derived values ───────────────────────────────────
  const orbColor  = isDone ? 'var(--t-success)' : 'var(--t-primary)'
  const waveMax   = isDone ? 4 : isActive ? 40 : 22
  const waveColor = isDone ? 'var(--t-border)'
                  : isActive ? 'var(--t-primary)'
                  : 'var(--t-text-muted)'
  const ptclColor = isActive ? 'var(--t-chart-cyan)' : 'var(--t-chart-blue)'
  const textColor = isDone ? 'var(--t-success)' : 'var(--t-text-secondary)'
  const borderClr = isDone ? 'rgba(34,197,94,0.35)' : 'var(--t-border)'

  return (
    <div
      className="ai-gen-root"
      style={{
        position:  'relative',
        overflow:  'hidden',
        background: 'var(--t-bg-panel)',
        border:    `1px solid ${borderClr}`,
        borderRadius: 'var(--t-radius-lg)',
        padding:   '14px 16px',
        display:   'flex',
        flexDirection: 'column',
        gap:       '10px',
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        animation: isDone
          ? 'ai-exit 1.8s ease-out forwards'
          : 'ai-enter 0.3s ease-out both',
        boxShadow: isActive
          ? '0 0 24px rgba(59,130,246,0.07), var(--t-shadow-panel)'
          : 'var(--t-shadow-panel)',
      }}
    >
      {/* ── Scanline texture (thinking / generating only) ─── */}
      {!isDone && (
        <div style={{
          position:   'absolute',
          inset:      0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)',
          backgroundSize:     '100% 4px',
          animation:          'ai-scanline-move 4s linear infinite',
          pointerEvents:      'none',
          borderRadius:       'inherit',
        }} />
      )}

      {/* ── Header: status label + indicators ────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
        position:       'relative',
        zIndex:         1,
      }}>
        {/* Left: orb + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            display:      'inline-block',
            width:         7,
            height:        7,
            borderRadius: '50%',
            background:    orbColor,
            flexShrink:    0,
            transition:    'background 0.4s ease',
            animation:     isDone ? 'none' : 'ai-orb-pulse 1.8s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily:    'var(--t-font-mono)',
            fontSize:      '10px',
            fontWeight:    700,
            letterSpacing: '0.12em',
            color:          orbColor,
            textTransform: 'uppercase',
            transition:    'color 0.4s ease',
          }}>
            {PHASE_LABELS[phase] || ''}
          </span>
        </div>

        {/* Right: bouncing dots or checkmark */}
        {isDone ? (
          <span style={{
            fontFamily: 'var(--t-font-mono)',
            fontSize:   '12px',
            color:      'var(--t-success)',
            lineHeight:  1,
          }}>✓</span>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display:      'inline-block',
                width:         3,
                height:        3,
                borderRadius: '50%',
                background:   'var(--t-primary)',
                animation:    `ai-dot-bounce 1.1s ease-in-out ${(i * 0.17).toFixed(2)}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Waveform ─────────────────────────────────────── */}
      <div style={{
        display:    'flex',
        alignItems: 'flex-end',
        gap:        '3px',
        height:     '44px',
        flexShrink:  0,
        position:   'relative',
        zIndex:      1,
      }}>
        {BAR_SHAPES.map((shape, i) => {
          const h   = 3 + (waveMax - 3) * shape
          const dur = (BAR_PARAMS[i].baseDur * (isActive ? 1 : 1.85)).toFixed(2)
          const del = BAR_PARAMS[i].delay.toFixed(3)
          return (
            <div key={i} style={{
              width:         '4px',
              height:        `${h}px`,
              borderRadius:  '2px',
              flexShrink:     0,
              background:     waveColor,
              transformOrigin:'bottom',
              opacity:        isDone ? 0.28 : 1,
              transition:    'background 0.5s ease, height 0.5s ease, opacity 0.5s ease',
              animation:      isDone
                ? 'none'
                : `ai-wave ${dur}s ease-in-out ${del}s infinite alternate`,
            }} />
          )
        })}
      </div>

      {/* ── Progress bar ─────────────────────────────────── */}
      <div style={{
        height:       '2px',
        background:   'var(--t-border-subtle)',
        borderRadius: '1px',
        overflow:     'hidden',
        flexShrink:    0,
        position:     'relative',
        zIndex:        1,
      }}>
        {isDone ? (
          <div style={{
            height:       '100%',
            background:   'var(--t-success)',
            borderRadius: '1px',
            animation:    'ai-progress-done 0.35s ease-out both',
          }} />
        ) : (
          <div style={{
            position:     'absolute',
            top:           0,
            left:          0,
            height:       '100%',
            width:        '38%',
            background:   'linear-gradient(90deg, transparent, var(--t-primary), transparent)',
            borderRadius: '1px',
            animation:    'ai-progress-slide 1.8s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* ── Floating particles (absolute, renders over bg) ─ */}
      {!isDone && (
        <div style={{
          position:     'absolute',
          inset:         0,
          pointerEvents:'none',
          overflow:     'hidden',
          borderRadius: 'inherit',
        }}>
          {PARTICLE_PARAMS.map((p, i) => (
            <div key={i} style={{
              position:     'absolute',
              left:         `${p.x}%`,
              bottom:        0,
              width:        `${p.size}px`,
              height:       `${p.size}px`,
              borderRadius: '50%',
              background:    ptclColor,
              '--p-drift':  `${p.drift}px`,
              animation:    `ai-particle ${p.duration.toFixed(2)}s ease-in-out ${p.delay.toFixed(2)}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* ── Typewriter text ───────────────────────────────── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        fontFamily: 'var(--t-font-mono)',
        fontSize:   'var(--t-text-sm)',
        color:       textColor,
        letterSpacing: '0.015em',
        minHeight:  '20px',
        flexShrink:  0,
        position:   'relative',
        zIndex:      1,
        transition: 'color 0.4s ease',
      }}>
        <span style={{
          color:       isDone ? 'var(--t-success)' : 'var(--t-text-muted)',
          fontWeight:  700,
          marginRight: 6,
          flexShrink:  0,
          transition: 'color 0.4s ease',
        }}>{'>'}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {displayText}
        </span>
        {!isDone && (
          <span style={{
            display:    'inline-block',
            width:      '1.5px',
            height:     '13px',
            background: 'var(--t-primary)',
            marginLeft: '1px',
            flexShrink:  0,
            animation:  'ai-cursor 1s step-end infinite',
          }} />
        )}
      </div>
    </div>
  )
}
