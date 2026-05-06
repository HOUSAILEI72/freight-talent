import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import CandidateProfileBuilder from './CandidateProfileBuilder'

export default function TerminalCandidateProfileBuilder() {
  return (
    <TerminalLayout title="RESUME" activeIconId="resume" navItems={CANDIDATE_ICON_NAV}>
      <CandidateProfileBuilder terminal />
    </TerminalLayout>
  )
}
