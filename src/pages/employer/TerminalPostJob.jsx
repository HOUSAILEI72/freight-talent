import TerminalLayout from '../../components/terminal/TerminalLayout'
import PostJob from './PostJob'

export default function TerminalPostJob({ mode = 'create' }) {
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs">
      <PostJob terminal mode={mode} />
    </TerminalLayout>
  )
}
