import TerminalLayout from '../../components/terminal/TerminalLayout'
import CandidatePool from './CandidatePool'

export default function TerminalCandidates() {
  return (
    <TerminalLayout title="CANDIDATES" activeIconId="candidates">
      <CandidatePool terminal messagesBasePath="/employer/messages" />
    </TerminalLayout>
  )
}
