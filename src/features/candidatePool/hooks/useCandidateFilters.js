import { useState } from 'react'

export function useCandidateFilters() {
  const [q, setQ]                             = useState('')
  const [avail, setAvail]                     = useState('all')
  const [location, setLocation]               = useState(null)
  const [functionCode, setFunctionCode]       = useState('')
  const [gender, setGender]                   = useState('')
  const [poolType, setPoolType]               = useState('all')

  function buildFilters(overrides = {}) {
    const loc   = overrides.location  !== undefined ? overrides.location  : location
    const av    = overrides.avail     !== undefined ? overrides.avail     : avail
    const qv    = overrides.q         !== undefined ? overrides.q         : q
    const fn    = overrides.fn        !== undefined ? overrides.fn        : functionCode
    const gv    = overrides.gender    !== undefined ? overrides.gender    : gender
    const pool  = overrides.poolType  !== undefined ? overrides.poolType  : poolType
    const jobId = overrides.job_id    !== undefined ? overrides.job_id    : undefined
    return {
      availability_status: av,
      ...(qv ? { q: qv } : {}),
      ...(loc?.location_code ? { location_code: loc.location_code } : {}),
      ...(fn ? { function_code: fn } : {}),
      ...(gv ? { gender: gv } : {}),
      ...(pool !== 'all' ? { pool_type: pool } : {}),
      ...(jobId ? { job_id: jobId } : {}),
    }
  }

  function resetFilters() {
    setQ(''); setAvail('all'); setLocation(null); setFunctionCode('')
    setGender('')
    // poolType 保留：重置搜索条件不归零候选人池分类
  }

  const hasFilter = !!(q || avail !== 'all' || location?.location_code || functionCode || gender)

  return {
    q, setQ,
    avail, setAvail,
    location, setLocation,
    functionCode, setFunctionCode,
    gender, setGender,
    poolType, setPoolType,
    buildFilters,
    resetFilters,
    hasFilter,
  }
}
