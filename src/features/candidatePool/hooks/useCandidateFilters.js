import { useState } from 'react'

export function useCandidateFilters() {
  const [q, setQ]                             = useState('')
  const [avail, setAvail]                     = useState('open')
  const [location, setLocation]               = useState(null)
  const [functionCode, setFunctionCode]       = useState('')
  const [archiveFilter, setArchiveFilter]     = useState('all')
  const [inviteFilter, setInviteFilter]       = useState('all')
  const [gender, setGender]                   = useState('')

  function buildFilters(overrides = {}) {
    const loc = overrides.location  !== undefined ? overrides.location  : location
    const av  = overrides.avail     !== undefined ? overrides.avail     : avail
    const qv  = overrides.q         !== undefined ? overrides.q         : q
    const fn  = overrides.fn        !== undefined ? overrides.fn        : functionCode
    const gv  = overrides.gender    !== undefined ? overrides.gender    : gender
    return {
      availability_status: av,
      ...(qv ? { q: qv } : {}),
      ...(loc?.location_code ? { location_code: loc.location_code } : {}),
      ...(fn ? { function_code: fn } : {}),
      ...(gv ? { gender: gv } : {}),
    }
  }

  function resetFilters() {
    setQ(''); setAvail('open'); setLocation(null); setFunctionCode('')
    setArchiveFilter('all'); setInviteFilter('all'); setGender('')
  }

  const hasFilter = !!(q || avail !== 'open' || location?.location_code || functionCode || archiveFilter !== 'all' || inviteFilter !== 'all' || gender)

  return {
    q, setQ,
    avail, setAvail,
    location, setLocation,
    functionCode, setFunctionCode,
    archiveFilter, setArchiveFilter,
    inviteFilter, setInviteFilter,
    gender, setGender,
    buildFilters,
    resetFilters,
    hasFilter,
  }
}
