import TerminalLayout from '../../components/terminal/TerminalLayout'
import EmployerCandidateDetail from '../../features/candidateProfile/EmployerCandidateDetail'

export default function TerminalCandidateProfile() {
  return (
    <TerminalLayout title="CANDIDATES" activeIconId="candidates">
      <EmployerCandidateDetail />
    </TerminalLayout>
  )
}
