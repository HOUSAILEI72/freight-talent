import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { loadArchivedSet, saveArchivedSet, buildInviteKey } from '../utils/candidatePrivacy'

export function useCandidateSelection() {
  const [selected, setSelected] = useState(null)
  return { selected, setSelected }
}

export function useCandidateArchive() {
  const { user } = useAuth()
  const [archivedSet, setArchivedSet] = useState(() => loadArchivedSet(user?.id))

  function handleArchive(candidateId) {
    setArchivedSet(prev => {
      const next = new Set(prev)
      next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId)
      saveArchivedSet(user?.id, next)
      return next
    })
  }

  return { archivedSet, handleArchive }
}

export function buildInviteMap(invitations) {
  const map = {}
  for (const inv of invitations) {
    if (inv.status !== 'declined') {
      map[buildInviteKey(inv.job_id, inv.candidate_id)] = inv.thread_id ?? true
    }
  }
  return map
}
