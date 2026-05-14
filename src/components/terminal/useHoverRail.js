import { useState, useRef, useEffect } from 'react'

/**
 * useHoverRail
 * Provides smooth delayed open/close for hover-expand rail sidebars.
 *
 * Timings match CSS tokens:
 *   open  delay ~90ms  → avoids accidental trigger on mouse-pass-through
 *   close delay ~140ms → gives user time to re-enter without collapse flash
 */
const OPEN_DELAY  = 90
const CLOSE_DELAY = 140

export function useHoverRail() {
  const [open, setOpen]    = useState(false)
  const openTimer          = useRef(null)
  const closeTimer         = useRef(null)

  useEffect(() => () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  function handleMouseEnter() {
    clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY)
  }

  function handleMouseLeave() {
    clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  return { open, handleMouseEnter, handleMouseLeave }
}
