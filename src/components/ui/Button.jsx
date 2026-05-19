const BASE = 'inline-flex items-center justify-center font-medium rounded-lg transition-[background-color,border-color,color,box-shadow,transform] duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.975]'

const LIGHT_VARIANTS = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  secondary: 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
  ghost:     'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 active:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  xl: 'px-8 py-4 text-base gap-2.5',
}

// Inline styles for each variant when terminal=true (no Tailwind hover pollution)
const TERMINAL_VARIANT_STYLE = {
  primary:   { background: 'var(--t-primary)',      color: '#fff',                    border: 'none' },
  secondary: { background: 'transparent',           color: 'var(--t-text-secondary)', border: '1px solid var(--t-border)' },
  ghost:     { background: 'transparent',           color: 'var(--t-text-secondary)', border: 'none' },
  danger:    { background: 'var(--t-danger)',        color: '#fff',                    border: 'none' },
  success:   { background: 'var(--t-success)',       color: 'var(--t-text-inverse)',   border: 'none' },
}

const TERMINAL_HOVER_STYLE = {
  primary:   { background: 'var(--t-primary-hover)' },
  secondary: { background: 'var(--t-bg-hover)' },
  ghost:     { background: 'var(--t-bg-hover)' },
  danger:    { background: '#dc2626' },
  success:   { background: '#16a34a' },
}

export function Button({ children, variant = 'primary', size = 'md', className = '', terminal = false, style: styleProp, ...props }) {
  if (terminal) {
    const base = TERMINAL_VARIANT_STYLE[variant] ?? TERMINAL_VARIANT_STYLE.primary
    const hoverStyle = TERMINAL_HOVER_STYLE[variant] ?? TERMINAL_HOVER_STYLE.primary
    return (
      <button
        className={`${BASE} ${SIZES[size]} ${className}`}
        style={{
          ...base,
          borderRadius: 'var(--t-radius-sm)',
          transition: 'background 150ms ease-out, border-color 150ms ease-out, color 150ms ease-out, box-shadow 150ms ease-out, transform 80ms ease-out, opacity 80ms ease-out',
          outline: 'none',
          ...styleProp,
        }}
        onMouseEnter={e => {
          if (props.disabled) return
          Object.assign(e.currentTarget.style, hoverStyle)
        }}
        onMouseLeave={e => {
          Object.assign(e.currentTarget.style, base)
          e.currentTarget.style.borderRadius = 'var(--t-radius-sm)'
          e.currentTarget.style.transform = ''
          e.currentTarget.style.opacity = ''
        }}
        onMouseDown={e => {
          if (props.disabled) return
          e.currentTarget.style.transform = 'scale(0.975)'
          e.currentTarget.style.opacity = '0.88'
        }}
        onMouseUp={e => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.opacity = ''
        }}
        {...props}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      className={`${BASE} ${LIGHT_VARIANTS[variant]} ${SIZES[size]} ${className}`}
      style={styleProp}
      {...props}
    >
      {children}
    </button>
  )
}
