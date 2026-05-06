import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import MyApplications from './MyApplications'

export default function TerminalCandidateApplications() {
  return (
    <TerminalLayout title="APPLICATIONS" activeIconId="applications" navItems={CANDIDATE_ICON_NAV}>
      <MyApplications terminal />
    </TerminalLayout>
  )
}
