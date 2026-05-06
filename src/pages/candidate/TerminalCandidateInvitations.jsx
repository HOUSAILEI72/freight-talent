import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import MyInvitations from './MyInvitations'

export default function TerminalCandidateInvitations() {
  return (
    <TerminalLayout title="INVITATIONS" activeIconId="invitations" navItems={CANDIDATE_ICON_NAV}>
      <MyInvitations terminal />
    </TerminalLayout>
  )
}
