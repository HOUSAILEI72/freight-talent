import { useRef, useEffect } from 'react'

/**
 * Attaches to a <textarea> and auto-resizes its height to fit content.
 * @param {string|number} value - The textarea value (triggers recalc on change).
 * @param {{ minRows?: number, maxRows?: number, lineHeight?: number }} [opts]
 */
export function useAutoResize(value, opts = {}) {
  const { maxRows, lineHeight = 20 } = opts
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = el.scrollHeight
    if (maxRows) {
      el.style.height = Math.min(next, maxRows * lineHeight) + 'px'
      el.style.overflowY = next > maxRows * lineHeight ? 'auto' : 'hidden'
    } else {
      el.style.height = next + 'px'
      el.style.overflowY = 'hidden'
    }
  }, [value, maxRows, lineHeight])

  return ref
}
