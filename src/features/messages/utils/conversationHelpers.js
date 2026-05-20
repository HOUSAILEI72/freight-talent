// Group flat conversation list by peer (candidate or employer).
// Returns sorted array of { key, peer, threads, totalUnread }.
export function groupConversations(conversations, userRole) {
  if (!userRole || userRole === 'admin') {
    return conversations.map(c => ({
      key: String(c.id),
      peer: c,
      threads: [c],
      totalUnread: c.unread_count ?? 0,
    }))
  }

  const map = new Map()
  for (const c of conversations) {
    const gk = userRole === 'employer' ? `c_${c.candidate_id}` : `e_${c.employer_id}`
    if (!map.has(gk)) map.set(gk, [])
    map.get(gk).push(c)
  }

  return [...map.entries()].map(([key, threads]) => {
    const sorted = threads.sort((a, b) =>
      (b.latest_message_at ?? '') > (a.latest_message_at ?? '') ? 1 : -1)
    const seen = new Set()
    const deduped = sorted.filter(t => {
      if (seen.has(t.job_id)) return false
      seen.add(t.job_id)
      return true
    })
    return {
      key,
      peer: deduped[0],
      threads: deduped,
      totalUnread: deduped.reduce((s, t) => s + (t.unread_count ?? 0), 0),
    }
  }).sort((a, b) =>
    (b.peer.latest_message_at ?? '') > (a.peer.latest_message_at ?? '') ? 1 : -1)
}

export function sortConversations(list) {
  return [...list].sort((a, b) => {
    const ta = a.latest_message_at ?? a.updated_at ?? ''
    const tb = b.latest_message_at ?? b.updated_at ?? ''
    return tb.localeCompare(ta)
  })
}

export function loadConvSet(storageKey) {
  try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]')) }
  catch { return new Set() }
}

export function saveConvSet(storageKey, set) {
  try { localStorage.setItem(storageKey, JSON.stringify([...set])) }
  catch { /* noop */ }
}
