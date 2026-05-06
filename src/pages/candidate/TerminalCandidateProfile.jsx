import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import CandidateProfile from './CandidateProfile'

export default function TerminalCandidateProfile() {
  return (
    <TerminalLayout title="PROFILE" activeIconId="profile" navItems={CANDIDATE_ICON_NAV}>
      <CandidateProfile viewMode="self" />
    </TerminalLayout>
  )
}
