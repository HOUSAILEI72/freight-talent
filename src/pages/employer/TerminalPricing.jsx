import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, XCircle, Loader2, Puzzle, Building2,
  AlertCircle, CheckCircle, ChevronDown,
} from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { subscriptionsApi } from '../../api/subscriptions'

// ─── Layout constants ─────────────────────────────────────────────────────────
const HEADER_HEIGHT = 220
const ROW_HEIGHT = 42

// ─── Functions ────────────────────────────────────────────────────────────────
const FUNCTIONS = [
  { code: 'Sea', label: 'Sea' },
  { code: 'Air', label: 'Air' },
  { code: 'Road', label: 'Road' },
  { code: 'Railway', label: 'Railway' },
  { code: 'Contract Logistics', label: 'Contract Logistics' },
  { code: 'ECOMS', label: 'ECOMS' },
]

// ─── Feature rows ─────────────────────────────────────────────────────────────
const FEATURES = [
  { key: 'area',        label: 'Area Coverage' },
  { key: 'functions',    label: 'Functions' },
  { key: 'full_profiles', label: 'Full Candidate Profiles' },
  { key: 'jobs_ai',      label: 'Jobs & AI Matching' },
  { key: 'invitations',  label: 'Invitations & Messages' },
  { key: 'dashboard',    label: 'Dashboard & Filters' },
]

// ─── Plans ────────────────────────────────────────────────────────────────────
const ANNUAL_DISCOUNT = 0.85

const PLANS = [
  {
    id: 'china_function',
    icon: Puzzle,
    title: 'CHINA\n+ FUNCTION',
    subtitle: 'China region + 1 function',
    monthlyPrice: 700,
    annualPrice: Math.round(700 * 12 * ANNUAL_DISCOUNT),
    features: {
      area:           { type: 'text',  value: 'All China' },
      functions:      { type: 'text',  value: '1 selected function' },
      full_profiles:  { type: 'check', value: true },
      jobs_ai:        { type: 'check', value: true },
      invitations:    { type: 'check', value: true },
      dashboard:      { type: 'check', value: true },
    },
  },
  {
    id: 'china_all_functions',
    icon: Building2,
    title: 'CHINA\nALL FUNCTIONS',
    subtitle: 'China region + all functions',
    monthlyPrice: 850,
    annualPrice: Math.round(850 * 12 * ANNUAL_DISCOUNT),
    highlighted: true,
    features: {
      area:           { type: 'text',  value: 'All China' },
      functions:      { type: 'text',  value: 'ALL functions' },
      full_profiles:  { type: 'check', value: true },
      jobs_ai:        { type: 'check', value: true },
      invitations:    { type: 'check', value: true },
      dashboard:      { type: 'check', value: true },
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(amount) {
  return '¥' + amount.toLocaleString()
}

function isPlanCurrent(plan, subscription) {
  if (!subscription?.is_active) return false
  const tier = subscription.tier
  // tier now stores plan_id (china_function / china_all_functions)
  return tier === plan.id
}

// ─── RowCell ──────────────────────────────────────────────────────────────────
function RowCell({ cell }) {
  if (!cell) return <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>—</span>
  if (cell.type === 'check') {
    return cell.value
      ? <CheckCircle2 size={16} style={{ color: 'var(--t-success)' }} />
      : <XCircle size={16} style={{ color: '#ff3366' }} />
  }
  return (
    <span style={{
      fontFamily: 'var(--t-font-sans)', fontSize: 11,
      color: 'var(--t-text-secondary)',
    }}>
      {cell.value}
    </span>
  )
}

// ─── BillingToggle ────────────────────────────────────────────────────────────
function BillingToggle({ annual, onChange }) {
  const [hoverAnnual, setHoverAnnual] = useState(false)
  const [hoverMonthly, setHoverMonthly] = useState(false)

  const baseBtn = {
    height: 30, padding: '0 16px',
    fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    border: '1px solid var(--t-border)',
    cursor: 'pointer', transition: 'all 120ms',
  }

  const activeStyle = {
    background: 'rgba(37,99,235,0.15)',
    border: '1px solid var(--t-primary)',
    color: 'var(--t-chart-blue)',
    borderRadius: 'var(--t-radius-sm) 0 0 var(--t-radius-sm)',
  }

  const activeStyle2 = {
    background: 'rgba(37,99,235,0.15)',
    border: '1px solid var(--t-primary)',
    color: 'var(--t-chart-blue)',
    borderRadius: '0 var(--t-radius-sm) var(--t-radius-sm) 0',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <button
        type="button"
        onClick={() => onChange(false)}
        onMouseEnter={() => setHoverMonthly(true)}
        onMouseLeave={() => setHoverMonthly(false)}
        style={{
          ...baseBtn,
          ...(annual ? {
            background: hoverMonthly ? 'rgba(37,99,235,0.06)' : 'transparent',
            borderColor: 'var(--t-border)',
            color: 'var(--t-text-secondary)',
            borderRadius: 'var(--t-radius-sm) 0 0 var(--t-radius-sm)',
          } : activeStyle),
        }}
      >
        MONTHLY
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        onMouseEnter={() => setHoverAnnual(true)}
        onMouseLeave={() => setHoverAnnual(false)}
        style={{
          ...baseBtn,
          ...(annual ? activeStyle2 : {
            background: hoverAnnual ? 'rgba(37,99,235,0.06)' : 'transparent',
            borderColor: 'var(--t-border)',
            color: 'var(--t-text-secondary)',
            borderRadius: '0 var(--t-radius-sm) var(--t-radius-sm) 0',
          }),
        }}
      >
        ANNUAL — 15% OFF
      </button>
    </div>
  )
}

// ─── FunctionSelector ─────────────────────────────────────────────────────────
function FunctionSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)

  const selected = FUNCTIONS.find(f => f.code === value)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        onMouseEnter={() => !disabled && setHover(true)}
        onMouseLeave={() => !disabled && setHover(false)}
        style={{
          width: '100%', height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px',
          background: disabled ? 'rgba(148,163,184,0.04)' : (hover || open ? 'rgba(37,99,235,0.08)' : 'transparent'),
          border: `1px solid ${open ? 'var(--t-primary)' : hover ? 'var(--t-primary)' : 'var(--t-border)'}`,
          borderRadius: 'var(--t-radius-sm)',
          color: disabled ? 'var(--t-text-muted)' : 'var(--t-text)',
          fontFamily: 'var(--t-font-sans)', fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 120ms, background 120ms',
        }}
      >
        <span>{selected ? selected.label : 'Select function...'}</span>
        <ChevronDown size={14} style={{
          color: 'var(--t-text-muted)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 150ms',
        }} />
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            marginTop: 4,
            background: '#1a2230',
            border: '1px solid var(--t-border)',
            borderRadius: 'var(--t-radius)',
            overflow: 'hidden',
          }}>
            {FUNCTIONS.map(f => (
              <div
                key={f.code}
                onClick={() => { onChange(f.code); setOpen(false) }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(37,99,235,0.1)' }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent' }}
                style={{
                  padding: '8px 12px',
                  fontFamily: 'var(--t-font-sans)', fontSize: 12,
                  color: f.code === value ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--t-border-subtle)',
                  background: f.code === value ? 'rgba(37,99,235,0.06)' : 'transparent',
                }}
              >
                {f.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, annual, selectedFunction, onSelectFunction, onActivate, activating, subscription }) {
  const [hover, setHover] = useState(false)
  const [ctaHover, setCtaHover] = useState(false)
  const Icon = plan.icon
  const isCurrent = isPlanCurrent(plan, subscription)
  const isHighlighted = !!plan.highlighted
  const needsFunction = plan.id === 'china_function'
  const canActivate = needsFunction ? !!selectedFunction : true

  const price = annual ? plan.annualPrice : plan.monthlyPrice
  const period = annual ? '/ yr' : '/ mo'

  const borderCol = isCurrent
    ? 'var(--t-success)'
    : hover
    ? 'var(--t-primary)'
    : isHighlighted
    ? 'rgba(37,99,235,0.45)'
    : 'var(--t-border)'

  let ctaLabel = 'ACTIVATE'
  if (isCurrent) ctaLabel = 'CURRENT PLAN'
  else if (needsFunction && !selectedFunction) ctaLabel = 'SELECT FUNCTION'

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 0, maxWidth: 480,
        background: '#151a24',
        border: `1px solid ${borderCol}`,
        borderRadius: 'var(--t-radius-lg)',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 150ms',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        height: HEADER_HEIGHT,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 28px',
        borderBottom: '1px solid var(--t-border-subtle)',
        position: 'relative',
        gap: 0,
      }}>
        {/* Badge: POPULAR or ACTIVE */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          {isCurrent ? (
            <span style={{
              fontSize: 9, fontFamily: 'var(--t-font-sans)', fontWeight: 700,
              color: 'var(--t-success)', background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 9999, padding: '2px 9px',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              ACTIVE
            </span>
          ) : isHighlighted ? (
            <span style={{
              fontSize: 9, fontFamily: 'var(--t-font-sans)', fontWeight: 700,
              color: '#2563eb', background: 'rgba(37,99,235,0.15)',
              border: '1px solid rgba(37,99,235,0.35)',
              borderRadius: 9999, padding: '2px 9px',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              POPULAR
            </span>
          ) : null}
        </div>

        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--t-radius)',
          background: isHighlighted ? 'rgba(37,99,235,0.15)' : 'var(--t-bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 6,
        }}>
          <Icon size={18} style={{ color: isHighlighted ? '#60a5fa' : 'var(--t-text-secondary)' }} />
        </div>

        {/* Title */}
        <p style={{
          fontFamily: 'var(--t-font-sans)',
          fontSize: 20,
          lineHeight: 1.12,
          letterSpacing: '0.08em',
          color: 'var(--t-chart-blue)',
          textAlign: 'center',
          textTransform: 'uppercase',
          fontWeight: 700,
          whiteSpace: 'pre-line',
          marginBottom: 4,
        }}>
          {plan.title}
        </p>

        {/* Subtitle */}
        <p style={{
          fontSize: 11, color: 'var(--t-text-muted)',
          textAlign: 'center', letterSpacing: '0.04em',
          marginBottom: 10,
        }}>
          {plan.subtitle}
        </p>

        {/* Price */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 5,
          justifyContent: 'center', marginBottom: 6,
        }}>
          <span style={{
            fontFamily: 'var(--t-font-sans)', fontSize: 28, fontWeight: 800,
            color: 'var(--t-text)',
          }}>
            {formatPrice(price)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{period}</span>
        </div>

        {annual && (
          <p style={{
            fontSize: 10, color: 'var(--t-success)',
            fontFamily: 'var(--t-font-sans)',
            marginBottom: 8,
          }}>
            Save {Math.round(100 - ANNUAL_DISCOUNT * 100)}% with annual billing
          </p>
        )}

        {/* Function selector for Plan A */}
        {needsFunction && (
          <div style={{ width: 'calc(100% - 56px)', marginBottom: 10 }}>
            <FunctionSelector
              value={selectedFunction}
              onChange={onSelectFunction}
              disabled={isCurrent || !!activating}
            />
          </div>
        )}

        {/* CTA button */}
        {isCurrent ? (
          <div style={{
            height: 36, width: 'calc(100% - 56px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            background: 'rgba(34,197,94,0.18)',
            border: '1px solid var(--t-success)',
            color: 'var(--t-success)',
            borderRadius: 'var(--t-radius-sm)',
          }}>
            CURRENT PLAN
          </div>
        ) : (
          <button
            type="button"
            disabled={!!activating || !canActivate}
            onClick={() => canActivate && onActivate(plan)}
            onMouseEnter={() => setCtaHover(true)}
            onMouseLeave={() => setCtaHover(false)}
            style={{
              width: 'calc(100% - 56px)', height: 36,
              borderRadius: 'var(--t-radius-sm)',
              border: isHighlighted
                ? '1px solid var(--t-primary)'
                : `1px solid ${ctaHover ? 'var(--t-primary)' : 'var(--t-border)'}`,
              background: isHighlighted
                ? (ctaHover ? '#0f74e8' : '#1e88ff')
                : (ctaHover ? 'rgba(37,99,235,0.08)' : 'transparent'),
              color: isHighlighted ? '#fff' : (ctaHover ? '#60a5fa' : 'var(--t-text-secondary)'),
              fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 800,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              cursor: (activating || !canActivate) ? 'not-allowed' : 'pointer',
              opacity: activating && activating !== plan.id ? 0.45 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 120ms, color 120ms, border-color 120ms',
            }}
          >
            {activating === plan.id ? <Loader2 size={13} className="animate-spin" /> : null}
            {ctaLabel}
          </button>
        )}

        {/* Demo note */}
        <p style={{
          marginTop: 4, fontSize: 10,
          color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)',
          textAlign: 'center',
        }}>
          Demo mode · instant activation
        </p>
      </div>

      {/* ── Feature rows ── */}
      {FEATURES.map(f => (
        <div key={f.key} style={{
          height: ROW_HEIGHT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderTop: '1px solid var(--t-border-subtle)',
          padding: '0 20px',
        }}>
          <RowCell cell={plan.features[f.key]} />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TerminalPricing() {
  const navigate = useNavigate()

  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(null)
  const [toast, setToast] = useState(null)
  const [annual, setAnnual] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState('Sea')

  useEffect(() => {
    subscriptionsApi.getMySubscription()
      .then(res => setSubscription(res.data.subscription))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleActivate(plan) {
    setActivating(plan.id)
    setToast(null)

    const payload = {
      plan_id: plan.id,
      billing_cycle: annual ? 'annual' : 'monthly',
    }

    if (plan.id === 'china_function') {
      payload.function_codes = [selectedFunction]
    }
    // china_all_functions: function_codes=["ALL"] is forced server-side

    try {
      const res = await subscriptionsApi.devActivate(payload)
      setSubscription(res.data.subscription)
      const cycleLabel = annual ? '年度' : '月度'
      setToast({ type: 'ok', text: `${plan.title.replace('\n', ' ')} ${cycleLabel}订阅已激活（演示模式）` })
    } catch (e) {
      setToast({ type: 'err', text: e.response?.data?.message ?? '激活失败，请重试' })
    } finally {
      setActivating(null)
    }
  }

  const hasActive = subscription?.is_active ?? false
  const currentTier = subscription?.tier ?? null

  return (
    <TerminalLayout title="SUBSCRIPTION PLANS" activeIconId="">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Sub-header strip */}
        <div style={{
          height: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--t-border-subtle)',
          padding: '0 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontFamily: 'var(--t-font-sans)', fontSize: 10,
              color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              CHOOSE A PLAN
            </span>
            {hasActive && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--t-font-sans)', fontWeight: 700,
                color: 'var(--t-success)', background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 9999, padding: '1px 10px',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                ACTIVE · {currentTier?.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BillingToggle annual={annual} onChange={setAnnual} />
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                fontFamily: 'var(--t-font-sans)', fontSize: 10,
                color: 'var(--t-text-muted)', background: 'none',
                border: '1px solid var(--t-border)',
                borderRadius: 'var(--t-radius-sm)', padding: '3px 10px', cursor: 'pointer',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}
            >
              ← BACK
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="terminal-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '16px 24px 24px' }}>

          {/* Toast */}
          {toast && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 20, padding: '10px 16px',
              borderRadius: 'var(--t-radius)', fontSize: 13,
              background: toast.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: toast.type === 'ok' ? 'var(--t-success)' : 'var(--t-danger)',
            }}>
              {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {toast.text}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t-text-muted)', fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />加载中…
            </div>
          ) : (
            <>
              {/* Region scope banner */}
              <div style={{
                marginBottom: 20,
                padding: '10px 16px',
                borderRadius: 'var(--t-radius)',
                border: '1px solid rgba(96,165,250,0.2)',
                background: 'rgba(37,99,235,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
                  color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  Region
                </span>
                <span style={{
                  fontFamily: 'var(--t-font-sans)', fontSize: 13,
                  color: 'var(--t-text)',
                }}>
                  China — covering East, North, South, West, Central China, Hong Kong, Taiwan & Macau
                </span>
              </div>

              {/* Two plan cards */}
              <div style={{
                display: 'flex',
                gap: 24,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}>
                {PLANS.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    annual={annual}
                    selectedFunction={selectedFunction}
                    onSelectFunction={setSelectedFunction}
                    onActivate={handleActivate}
                    activating={activating}
                    subscription={subscription}
                  />
                ))}
              </div>

              {/* Feature legend */}
              <div style={{
                marginTop: 24,
                display: 'flex', flexDirection: 'column', gap: 6,
                maxWidth: 960, marginLeft: 'auto', marginRight: 'auto',
              }}>
                {FEATURES.map(f => (
                  <div key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 12px',
                    borderTop: '1px solid var(--t-border-subtle)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--t-font-sans)', fontSize: 10,
                      color: 'var(--t-text-muted)', textTransform: 'uppercase',
                      letterSpacing: '0.04em', width: 200, flexShrink: 0,
                    }}>
                      {f.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
                      {f.key === 'area'
                        ? 'China · East China · North · South · West · Central · HK · TW · Macau'
                        : f.key === 'functions'
                        ? 'Sea · Air · Road · Railway · Contract Logistics · ECOMS'
                        : 'Included in all plans'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </TerminalLayout>
  )
}
