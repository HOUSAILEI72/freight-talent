import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import UploadResume from './UploadResume'

export default function TerminalCandidateUpload() {
  return (
    <TerminalLayout title="UPLOAD" activeIconId="upload" navItems={CANDIDATE_ICON_NAV}>
      <UploadResume terminal />
    </TerminalLayout>
  )
}
