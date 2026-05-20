import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { loadArchivedSet, saveArchivedSet, buildInviteKey } from '../utils/candidatePrivacy'
import { candidatesApi } from '../../../api/candidates'

export function useCandidateSelection() {
  const [selected, setSelected] = useState(null)
  return { selected, setSelected }
}

export function useCandidateArchive() {
  const { user } = useAuth()
  // Optimistic local set — seeded from localStorage, then overwritten by server on mount
  const [archivedSet, setArchivedSet] = useState(() => loadArchivedSet(user?.id))

  // On mount: migrate localStorage → backend, then sync authoritative list from server
  useEffect(() => {
    if (!user?.id) return
    const localIds = [...loadArchivedSet(user.id)]

    const doSync = async () => {
      try {
        // If there are local ids not yet on server, push them first
        if (localIds.length > 0) {
          const syncRes = await candidatesApi.syncFavorites(localIds)
          const serverIds = new Set(syncRes.data.favorited_ids ?? [])
          setArchivedSet(serverIds)
          saveArchivedSet(user.id, serverIds)
        } else {
          // No local ids — just fetch from server
          const favRes = await candidatesApi.getFavorites()
          const serverIds = new Set(favRes.data.favorited_ids ?? [])
          setArchivedSet(serverIds)
          saveArchivedSet(user.id, serverIds)
        }
      } catch {
        // Network fail — keep local set as fallback, no crash
      }
    }
    doSync()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleArchive(candidateId) {
    // Optimistic update
    setArchivedSet(prev => {
      const next = new Set(prev)
      next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId)
      saveArchivedSet(user?.id, next)
      return next
    })
    // Persist to server (fire-and-forget; on error the UI stays toggled — acceptable for MVP)
    try {
      await candidatesApi.toggleFavorite(candidateId)
    } catch {
      // Rollback optimistic update on failure
      setArchivedSet(prev => {
        const next = new Set(prev)
        next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId)
        saveArchivedSet(user?.id, next)
        return next
      })
    }
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
