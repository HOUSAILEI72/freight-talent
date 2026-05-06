import TerminalLayout from '../../components/terminal/TerminalLayout'
import PostJob from './PostJob'

export default function TerminalPostJob() {
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs">
      <PostJob terminal />
    </TerminalLayout>
  )
}
