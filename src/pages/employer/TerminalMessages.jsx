import TerminalLayout from '../../components/terminal/TerminalLayout'
import Messages from '../messages/Messages'

export default function TerminalMessages() {
  return (
    <TerminalLayout title="MESSAGES" activeIconId="messages">
      <Messages terminal basePath="/employer/messages" backPath="/employer/dashboard" />
    </TerminalLayout>
  )
}
