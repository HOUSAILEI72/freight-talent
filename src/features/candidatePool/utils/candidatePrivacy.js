// Returns true when the candidate's private fields have been unlocked for this employer
export function isUnlocked(candidate) {
  return !!candidate.private_visible
}

export function buildInviteKey(jobId, candidateId) {
  return `${jobId}_${candidateId}`
}

export function loadArchivedSet(userId) {
  try {
    const raw = localStorage.getItem(`archived_${userId}`)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export function saveArchivedSet(userId, set) {
  try {
    localStorage.setItem(`archived_${userId}`, JSON.stringify([...set]))
  } catch { /* noop */ }
}
