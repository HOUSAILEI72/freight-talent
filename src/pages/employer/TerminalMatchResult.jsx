import TerminalLayout from '../../components/terminal/TerminalLayout'
import MatchResult from './MatchResult'

export default function TerminalMatchResult() {
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs">
      <MatchResult terminal messagesBasePath="/employer/messages" />
    </TerminalLayout>
  )
}
