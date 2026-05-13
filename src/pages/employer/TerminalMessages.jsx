import TerminalLayout from '../../components/terminal/TerminalLayout'
import Messages from '../../features/messages'

export default function TerminalMessages() {
  return (
    <TerminalLayout title="MESSAGES" activeIconId="messages">
      <Messages terminal basePath="/employer/messages" />
    </TerminalLayout>
  )
}
