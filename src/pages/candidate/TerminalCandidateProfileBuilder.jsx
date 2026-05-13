import { Navigate } from 'react-router-dom'

export default function TerminalCandidateProfileBuilder() {
  return <Navigate to="/candidate/profile/me?tab=edit" replace />
}
