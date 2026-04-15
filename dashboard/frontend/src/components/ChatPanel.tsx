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

export function ChatPanel() {
  const dashboard = useDashboard();
  const { chatMessages, chatThinking, chatAuth, chatStatus, chatThinkingStart, agents, sendChatMessage } = dashboard;
  const [input, setInput] = useState('');
  const [showAgents, setShowAgents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const recentAgents = agents.slice(0, 6);
  const cfg = STATUS_CONFIG[chatStatus] || STATUS_CONFIG.idle;

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        <span>Venture OS{chatAuth ? <span className="chat-panel__auth-badge">{chatAuth}</span> : null}</span>
        <button
          style={{
            background: 'none', border: 'none', color: 'var(--color-text-muted)',
            fontSize: 10, fontFamily: 'var(--font-family-mono)', cursor: 'pointer',
          }}
          onClick={() => setShowAgents(!showAgents)}
        >
          {showAgents ? 'hide agents' : 'show agents'}
        </button>
      </div>

      {/* Messages */}
      <div className="chat-panel__messages">
        {chatMessages.map(msg => (
          <div key={msg.id} className={`chat-panel__msg chat-panel__msg--${msg.role}`}>
            <MessageContent msg={msg} />
          </div>
        ))}

        {/* Thinking indicator — prominent */}
        {chatThinking && (
          <div className="chat-panel__thinking-bar">
            <div className="chat-panel__thinking-pulse" />
            <span className="chat-panel__thinking-label">
              thinking
              {chatThinkingStart && (
                <>
                  {' '}<ElapsedTimer start={chatThinkingStart} />
                </>
              )}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Agent Stream */}
      {showAgents && recentAgents.length > 0 && (
        <div className="chat-panel__agents">
          {recentAgents.map(agent => (
            <div key={agent.id} className="chat-panel__agent-card">
              <span className="chat-panel__agent-icon">{agent.icon}</span>
              <div className="chat-panel__agent-info">
                <div className="chat-panel__agent-name">
                  {agent.agent}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>
                    {agent.project}
                  </span>
                </div>
                <div className="chat-panel__agent-msg">{agent.message}</div>
              </div>
              <span className={`chat-panel__agent-status chat-panel__agent-status--${agent.status}`}>
                {agent.phase}
              </span>
            </div>
          ))}
        </div>
      )}

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
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <textarea
            className="chat-panel__input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (add skill, paste key, build project)"
            rows={2}
          />
        </form>
      </div>
    </div>
  );
}
