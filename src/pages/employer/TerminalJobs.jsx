import TerminalLayout from '../../components/terminal/TerminalLayout'
import JobMarketplace from '../jobs/JobMarketplace'

export default function TerminalJobs() {
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs">
      <JobMarketplace terminal showNewJobButton />
    </TerminalLayout>
  )
}
