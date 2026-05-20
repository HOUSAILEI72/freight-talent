import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import Messages from '../../features/messages'

export default function TerminalCandidateMessages() {
  return (
    <TerminalLayout title="MESSAGES" activeIconId="messages" navItems={CANDIDATE_ICON_NAV}>
      <Messages terminal basePath="/candidate/messages" />
    </TerminalLayout>
  )
}
