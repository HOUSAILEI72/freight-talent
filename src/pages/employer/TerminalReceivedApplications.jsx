import TerminalLayout from '../../components/terminal/TerminalLayout'
import { EMPLOYER_ICON_NAV } from '../../components/terminal/navItems'
import ReceivedApplications from './ReceivedApplications'

export default function TerminalReceivedApplications() {
  return (
    <TerminalLayout title="APPLICATIONS" activeIconId="applications" navItems={EMPLOYER_ICON_NAV}>
      <ReceivedApplications terminal />
    </TerminalLayout>
  )
}
