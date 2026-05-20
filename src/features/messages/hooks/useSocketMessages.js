// Thin re-export that centralises the socket dependency for the messages feature.
// Actual socket management lives in the shared useSocket hook.
export { useSocket as useSocketMessages } from '../../../hooks/useSocket'
