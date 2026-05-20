export default function LockedInsightsPanel({ locked, onPricingClick, children }) {
  return (
    <section className="relative shrink-0 overflow-visible rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-[var(--t-shadow-panel)]">
      <div className={locked ? 'pointer-events-none select-none blur-[5px] opacity-35' : ''}>
        {children}
      </div>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)', borderRadius: 'var(--t-radius-lg)' }}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-[15px] font-semibold text-[color:var(--t-text)]">
              Unlock market insights
            </div>
            <button
              type="button"
              onClick={onPricingClick}
              className="h-8 rounded-[var(--t-radius)] border px-4 text-[12px] font-bold uppercase tracking-[0.06em] hover:opacity-90"
              style={{ borderColor: 'var(--t-primary)', color: 'var(--t-text)', background: 'transparent' }}
            >
              View Pricing
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
