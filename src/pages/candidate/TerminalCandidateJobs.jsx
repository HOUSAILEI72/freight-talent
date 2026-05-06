import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import JobMarketplace from '../jobs/JobMarketplace'

export default function TerminalCandidateJobs() {
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs" navItems={CANDIDATE_ICON_NAV}>
      <JobMarketplace terminal canApply />
    </TerminalLayout>
  )
}
