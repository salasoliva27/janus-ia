import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDashboard } from '../store';
import type { ChatMessage } from '../types/dashboard';

function ToolCallCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const toolLine = lines[0]?.replace('Permission needed: ', '') || 'Tool Call';
  const inputLine = lines.slice(1).join('\n');

  return (
    <div className="chat-panel__tool-card">
      <button
        className="chat-panel__tool-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="chat-panel__tool-card-icon">{expanded ? 'v' : '>'}</span>
        <span className="chat-panel__tool-card-name">{toolLine}</span>
      </button>
      {expanded && inputLine && (
        <pre className="chat-panel__tool-card-body">{inputLine}</pre>
      )}
    </div>
  );
}

function MessageContent({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'system') {
    if (msg.content.startsWith('Permission needed:')) {
      return <ToolCallCard content={msg.content} />;
    }
    return <span>{msg.content}</span>;
  }

  if (msg.role === 'user') {
    return <span>{msg.content}</span>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !className;
          if (isInline) {
            return <code className="chat-inline-code" {...props}>{children}</code>;
          }
          return (
            <div className="chat-code-block">
              {match && <div className="chat-code-block__lang">{match[1]}</div>}
              <pre><code className={className} {...props}>{children}</code></pre>
            </div>
          );
        },
        a({ href, children, ...props }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
        },
        table({ children, ...props }) {
          return <div className="chat-table-wrap"><table {...props}>{children}</table></div>;
        },
      }}
    >
      {msg.content}
    </ReactMarkdown>
  );
}

function ElapsedTimer({ start }: { start: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [start]);

  if (elapsed < 1) return null;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span>{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

const STATUS_CONFIG = {
  idle: { label: 'ready', color: 'var(--color-text-muted)', dot: 'var(--color-text-muted)' },
  thinking: { label: 'thinking', color: 'var(--color-accent)', dot: 'var(--color-accent)' },
  streaming: { label: 'responding', color: 'oklch(0.72 0.18 145)', dot: 'oklch(0.72 0.18 145)' },
  done: { label: 'done', color: 'var(--color-text-muted)', dot: 'oklch(0.72 0.18 145)' },
};

interface ChatPanelProps {
  sessionId?: string;
  lineageLabel?: string;
  lineageColor?: string;
}

export function ChatPanel({ sessionId = 'session-0', lineageLabel, lineageColor }: ChatPanelProps) {
  const dashboard = useDashboard();
  const { chatMessages, chatThinking, chatAuth, chatStatus, chatThinkingStart, sendChatMessage, stopResponse, editMessage, forkChat } = dashboard;
  const [input, setInput] = useState('');
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendChatMessage(input);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleEditMessage(msgId: string) {
    const content = editMessage(msgId);
    if (content !== null) {
      setInput(content);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const cfg = STATUS_CONFIG[chatStatus] || STATUS_CONFIG.idle;
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnTime, setLearnTime] = useState('');
  const isBusy = chatStatus === 'thinking' || chatStatus === 'streaming';

  function startLearn() {
    const t = learnTime.trim();
    if (!t || isBusy) return;
    setLearnOpen(false);
    setLearnTime('');
    sendChatMessage(
      `Run /evolve until ${t}. Use all available session time. When a session runs out, write a handoff to .planning/evolve/handoff.md with remaining time and what was done. ` +
      `When the next session starts, read the handoff and continue from where you left off. ` +
      `Consolidate memory, assess gaps, discover and install tools. Keep cycling until ${t}.`
    );
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        <span>
          {lineageLabel
            ? <><span className="chat-panel__lineage" style={{ color: lineageColor }}>{lineageLabel}</span></>
            : <>Venture OS{chatAuth ? <span className="chat-panel__auth-badge">{chatAuth}</span> : null}</>
          }
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            className={`chat-panel__fork-btn ${isBusy ? 'chat-panel__fork-btn--disabled' : ''}`}
            onClick={() => !isBusy && forkChat(sessionId, `Fork ${Date.now().toString(36).slice(-4)}`)}
            title="Fork conversation into new window"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="6" r="3" />
              <path d="M6 9v6c0 1.657 1.343 3 3 3h3" />
              <line x1="18" y1="9" x2="18" y2="15" />
            </svg>
            <span>Fork</span>
          </button>
          <button
            className={`chat-panel__learn-btn ${isBusy ? 'chat-panel__learn-btn--disabled' : ''}`}
            onClick={() => !isBusy && setLearnOpen(v => !v)}
            title="Start learning mode"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span>Learn</span>
          </button>
          {learnOpen && (
            <div className="chat-panel__learn-menu">
              <input
                className="chat-panel__learn-input"
                value={learnTime}
                onChange={e => setLearnTime(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startLearn()}
                placeholder="e.g. 7am, 2 hours, 30m"
                autoFocus
              />
              <button
                className="chat-panel__learn-option"
                onClick={startLearn}
                disabled={!learnTime.trim()}
              >
                Go
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-panel__messages">
        {chatMessages.map(msg => (
          <div
            key={msg.id}
            className={`chat-panel__msg chat-panel__msg--${msg.role}`}
            onMouseEnter={() => msg.role === 'user' && setHoveredMsgId(msg.id)}
            onMouseLeave={() => setHoveredMsgId(null)}
          >
            <MessageContent msg={msg} />
            {msg.role === 'user' && hoveredMsgId === msg.id && (
              <button
                className="chat-panel__edit-btn"
                onClick={(e) => { e.stopPropagation(); handleEditMessage(msg.id); }}
                title="Edit and resend"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Thinking indicator — 3 dots */}
        {chatThinking && (
          <div className="chat-panel__thinking-dots">
            <span className="chat-panel__dot" />
            <span className="chat-panel__dot" />
            <span className="chat-panel__dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Status bar + Input */}
      <div className="chat-panel__input-area">
        <div className="chat-panel__status-bar">
          <span
            className={`chat-panel__status-dot ${chatStatus === 'thinking' ? 'chat-panel__status-dot--pulse' : ''}`}
            style={{ background: cfg.dot }}
          />
          <span className="chat-panel__status-label" style={{ color: cfg.color }}>
            {cfg.label}
            {chatStatus === 'thinking' && chatThinkingStart && (
              <> — <ElapsedTimer start={chatThinkingStart} /></>
            )}
          </span>
          {(chatStatus === 'thinking' || chatStatus === 'streaming') && (
            <button
              type="button"
              className="chat-panel__stop-btn"
              onClick={stopResponse}
              title="Stop response"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              <span>stop</span>
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="chat-panel__form">
          <div className="chat-panel__input-wrap">
            <textarea
              ref={inputRef}
              className="chat-panel__input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={2}
            />
            <button
              type="submit"
              className={`chat-panel__send-btn ${input.trim() ? 'chat-panel__send-btn--active' : ''}`}
              disabled={!input.trim()}
              title="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
