import TerminalLayout from '../../components/terminal/TerminalLayout'
import CandidatePoolPage from '../../features/candidatePool'

export default function TerminalCandidates() {
  return (
    <TerminalLayout title="CANDIDATES" activeIconId="candidates">
      <CandidatePoolPage terminal />
    </TerminalLayout>
  )
}
