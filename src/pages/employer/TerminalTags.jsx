import TerminalLayout from '../../components/terminal/TerminalLayout'
import MyTags from '../tags/MyTags'

export default function TerminalTags() {
  return (
    <TerminalLayout title="TAGS" activeIconId="tags">
      <MyTags terminal />
    </TerminalLayout>
  )
}
