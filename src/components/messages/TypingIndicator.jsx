/**
 * TypingIndicator.jsx — "对方正在输入..." 气泡，带 3 点 blink 动画
 *
 * Props:
 *   visible: boolean — 是否显示
 */
export default function TypingIndicator({ visible }) {
  if (!visible) return null

  return (
    <div className="flex items-center gap-1.5 px-1 py-1 text-xs text-slate-400 select-none">
      <span>对方正在输入</span>
      <span className="flex items-center gap-0.5">
        <span className="typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="typing-dot" style={{ animationDelay: '160ms' }} />
        <span className="typing-dot" style={{ animationDelay: '320ms' }} />
      </span>

      <style>{`
        .typing-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          background: #94a3b8;
          border-radius: 50%;
          animation: typingBlink 1s infinite ease-in-out;
        }
        @keyframes typingBlink {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
          40%            { opacity: 1;    transform: scale(1);    }
        }
      `}</style>
    </div>
  )
}
