import { useState, useCallback } from 'react'

export function useCandidateInvite({ selectedJob, markInvited }) {
  const [modal, setModal]   = useState(null)
  const [toast, setToast]   = useState(null)

  const handleConfirm = useCallback((threadId) => {
    if (!modal || !selectedJob) return
    markInvited(selectedJob.id, modal.id, threadId)
    setToast(modal.full_name)
    setModal(null)
  }, [modal, selectedJob, markInvited])

  return { modal, setModal, toast, setToast, handleConfirm }
}
