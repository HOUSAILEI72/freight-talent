import { useState, useEffect } from 'react'
import { candidatesApi } from '../../../api/candidates'
import { jobsApi } from '../../../api/jobs'
import { invitationsApi } from '../../../api/invitations'
import { subscriptionsApi } from '../../../api/subscriptions'
import { buildInviteMap } from './useCandidateSelection'

export function useCandidatePool() {
  const [candidates, setCandidates]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [myJobs, setMyJobs]               = useState([])
  const [selectedJob, setSelectedJob]     = useState(null)
  const [jobsReady, setJobsReady]         = useState(false)
  const [invited, setInvited]             = useState({})
  const [hasSubscription, setHasSubscription] = useState(false)
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [total, setTotal]                 = useState(0)
  const [poolCounts, setPoolCounts]       = useState({})
  const [quota, setQuota]                 = useState(null)

  function fetchCandidates(filters, targetPage = 1) {
    setLoading(true)
    setError('')
    candidatesApi.getCandidates({ ...filters, page: targetPage, page_size: 20 })
      .then(res => {
        setCandidates(res.data.candidates)
        setPage(res.data.page ?? targetPage)
        setTotalPages(res.data.total_pages ?? 1)
        setTotal(res.data.total ?? 0)
        setPoolCounts(res.data.pool_counts ?? {})
      })
      .catch(err => {
        console.error('Failed to load candidate pool:', {
          status: err.response?.status,
          data: err.response?.data,
          code: err.code,
          message: err.message,
        })
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载失败，请刷新重试'
        setError(errMsg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCandidates({ availability_status: 'open', pool_type: 'all' }, 1)
    Promise.all([
      jobsApi.getMyJobs(),
      invitationsApi.getSentInvitations(),
      subscriptionsApi.getMySubscription().catch(() => ({ data: { has_active: false } })),
      subscriptionsApi.getQuota().catch(() => ({ data: null })),
    ]).then(([jobsRes, sentRes, subRes, quotaRes]) => {
      const published = (jobsRes.data.jobs ?? []).filter(j => j.status === 'published')
      setMyJobs(published)
      if (published.length > 0) setSelectedJob(published[0])
      setInvited(buildInviteMap(sentRes.data.invitations ?? []))
      setHasSubscription(!!(subRes.data?.has_active))
      if (quotaRes.data) setQuota(quotaRes.data)
    }).catch(err => {
      console.error('Failed to load employer jobs or sent invitations:', {
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
    }).finally(() => setJobsReady(true))
  }, [])

  function markInvited(jobId, candidateId, threadId) {
    const key = `${jobId}_${candidateId}`
    setInvited(prev => ({ ...prev, [key]: threadId ?? true }))
  }

  return {
    candidates, setCandidates,
    loading, error,
    myJobs, selectedJob, setSelectedJob, jobsReady,
    invited, markInvited,
    hasSubscription,
    fetchCandidates,
    page, totalPages, total,
    poolCounts,
    quota,
  }
}
