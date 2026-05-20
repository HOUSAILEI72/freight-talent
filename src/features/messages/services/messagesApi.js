import { conversationsApi } from '../../../api/conversations'

export function fetchConversationList() {
  return conversationsApi.getMyConversations()
    .then(res => res.data.conversations ?? [])
}

export function fetchMessages(threadId, params) {
  return conversationsApi.getConversationMessages(threadId, params)
    .then(res => res.data)
}

export function sendMessage(threadId, content) {
  return conversationsApi.sendConversationMessage(threadId, content)
    .then(res => res.data.message)
}
