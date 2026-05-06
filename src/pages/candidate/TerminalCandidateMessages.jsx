import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import Messages from '../messages/Messages'

export default function TerminalCandidateMessages() {
  return (
    <TerminalLayout title="MESSAGES" activeIconId="messages" navItems={CANDIDATE_ICON_NAV}>
      <Messages terminal basePath="/candidate/messages" backPath="/candidate/home" />
    </TerminalLayout>
  )
}
