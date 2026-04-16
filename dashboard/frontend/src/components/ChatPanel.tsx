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

const MEMORY_ICON: Record<string, string> = {
  recall: '↺',
  remember: '✎',
  read: '⟵',
  write: '⟶',
  resume: '↻',
};

function MessageContent({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'memory') {
    const icon = MEMORY_ICON[msg.memoryAction || ''] || '·';
    return (
      <span className="chat-memory-pulse__content">
        <span className="chat-memory-pulse__icon">{icon}</span>
        <span className="chat-memory-pulse__action">{msg.memoryAction || 'memory'}</span>
        {msg.memoryRef && <span className="chat-memory-pulse__ref">{msg.memoryRef}</span>}
        <span className="chat-memory-pulse__text">{msg.content}</span>
      </span>
    );
  }

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
  const { chatAuth, sendChatMessage, stopResponse, editMessage, forkChat, getSessionChat, memoryIndex } = dashboard;

  // Read from this session's own chat state
  const sessionChat = getSessionChat(sessionId);
  const messages = sessionChat.messages;
  const chatThinking = sessionChat.thinking;
  const chatStatus = sessionChat.status;
  const chatThinkingStart = sessionChat.thinkingStart;
  const siblingUpdates = sessionChat.siblingUpdates;

  const [input, setInput] = useState('');
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  interface PendingAttachment { name: string; size: number; type: string; path?: string; uploading: boolean; error?: string; file: File }
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dropActive, setDropActive] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function uploadFile(file: File): Promise<{ path?: string; error?: string }> {
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const resp = await fetch('/api/chat/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: file.type, data }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) return { error: json.error || `HTTP ${resp.status}` };
      return { path: json.path };
    } catch (err) { return { error: String(err) }; }
  }

  function acceptFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    // Reject anything over 25MB (server allows 30MB base64 ≈ ~22MB binary)
    const valid = list.filter(f => {
      if (f.size > 25 * 1024 * 1024) { alert(`${f.name} is over 25MB and won't be attached.`); return false; }
      return true;
    });
    const pending: PendingAttachment[] = valid.map(f => ({
      name: f.name, size: f.size, type: f.type, uploading: true, file: f,
    }));
    setAttachments(a => [...a, ...pending]);
    for (const p of pending) {
      uploadFile(p.file).then(r => {
        setAttachments(a => a.map(x => x.file === p.file ? { ...x, uploading: false, path: r.path, error: r.error } : x));
      });
    }
  }

  function removeAttachment(i: number) {
    setAttachments(a => a.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ready = attachments.filter(a => a.path);
    const hasText = input.trim().length > 0;
    if (!hasText && ready.length === 0) return;
    // If uploads are still in flight, wait
    if (attachments.some(a => a.uploading)) return;

    let prompt = input.trim();
    if (ready.length > 0) {
      const list = ready.map(a => `  - ${a.path} (${a.name}, ${a.type || 'file'})`).join('\n');
      prompt = `[User attached ${ready.length} file${ready.length === 1 ? '' : 's'} — use the Read tool to open them]\n${list}\n\n${prompt || '(Please review the attached files.)'}`;
    }
    sendChatMessage(prompt, sessionId);
    setInput('');
    setAttachments([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleEditMessage(msgId: string) {
    const content = editMessage(msgId, sessionId);
    if (content !== null) {
      setInput(content);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const cfg = STATUS_CONFIG[chatStatus] || STATUS_CONFIG.idle;
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnTime, setLearnTime] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(false);
  const isBusy = chatStatus === 'thinking' || chatStatus === 'streaming';
  const memoryCount = memoryIndex?.entries.length || 0;
  const memoryTypes = memoryIndex ? Array.from(new Set(memoryIndex.entries.map(e => e.type))) : [];

  function startLearn() {
    const t = learnTime.trim();
    if (!t || isBusy) return;
    setLearnOpen(false);
    setLearnTime('');
    sendChatMessage(
      `Run /evolve until ${t}. Use all available session time. When a session runs out, write a handoff to .planning/evolve/handoff.md with remaining time and what was done. ` +
      `When the next session starts, read the handoff and continue from where you left off. ` +
      `Consolidate memory, assess gaps, discover and install tools. Keep cycling until ${t}.`,
      sessionId,
    );
  }

  return (
    <div
      className={`chat-panel ${dropActive ? 'chat-panel--drop-active' : ''}`}
      onDragOver={e => { e.preventDefault(); setDropActive(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDropActive(false); }}
      onDrop={e => {
        e.preventDefault(); setDropActive(false);
        if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files);
      }}
    >
      {dropActive && (
        <div className="chat-panel__drop-overlay">
          <div className="chat-panel__drop-text">Drop files to attach</div>
        </div>
      )}
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

      {/* Sibling awareness bar */}
      {siblingUpdates.length > 0 && (
        <div className="chat-panel__sibling-bar">
          {siblingUpdates.slice(0, 2).map((u, i) => (
            <div key={i} className="chat-panel__sibling-update">
              <span className="chat-panel__sibling-id">{u.sessionId.replace('session-', 'S')}</span>
              <span className="chat-panel__sibling-summary">{u.summary.length > 80 ? u.summary.slice(0, 77) + '...' : u.summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* Memory banner — shows what auto-memory is active */}
      {memoryIndex && (
        <div className={`chat-panel__memory-bar ${memoryOpen ? 'chat-panel__memory-bar--open' : ''}`}>
          <button
            className="chat-panel__memory-bar-header"
            onClick={() => setMemoryOpen(v => !v)}
            title="Auto-memory loaded into this session"
          >
            <span className="chat-panel__memory-bar-caret">{memoryOpen ? 'v' : '>'}</span>
            <span className="chat-panel__memory-bar-icon">🧠</span>
            <span className="chat-panel__memory-bar-label">
              {memoryCount === 0
                ? 'No memories yet — Claude will write as it learns'
                : `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} active`}
            </span>
            {memoryTypes.length > 0 && (
              <span className="chat-panel__memory-bar-types">
                {memoryTypes.slice(0, 4).join(' · ')}
              </span>
            )}
          </button>
          {memoryOpen && memoryIndex.entries.length > 0 && (
            <div className="chat-panel__memory-bar-list">
              {memoryIndex.entries.slice(0, 30).map(e => (
                <div key={e.file} className="chat-panel__memory-bar-item">
                  <span className={`chat-panel__memory-bar-type chat-panel__memory-bar-type--${e.type}`}>
                    {e.type}
                  </span>
                  <span className="chat-panel__memory-bar-name" title={e.description}>
                    {e.name}
                  </span>
                  {e.description && (
                    <span className="chat-panel__memory-bar-desc">{e.description}</span>
                  )}
                </div>
              ))}
              {memoryIndex.entries.length > 30 && (
                <div className="chat-panel__memory-bar-more">
                  +{memoryIndex.entries.length - 30} more
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="chat-panel__messages">
        {messages.map(msg => (
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
              onClick={() => stopResponse(sessionId)}
              title="Stop response"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>Stop</span>
            </button>
          )}
        </div>
        {attachments.length > 0 && (
          <div className="chat-panel__attachments">
            {attachments.map((a, i) => (
              <div key={i} className={`chat-panel__chip ${a.error ? 'chat-panel__chip--error' : ''} ${a.uploading ? 'chat-panel__chip--uploading' : ''}`}>
                <span className="chat-panel__chip-icon">{a.type.startsWith('image/') ? '🖼' : a.type.includes('pdf') ? '📄' : '📎'}</span>
                <span className="chat-panel__chip-name" title={a.name}>{a.name}</span>
                <span className="chat-panel__chip-size">{(a.size / 1024).toFixed(0)}kB</span>
                {a.uploading && <span className="chat-panel__chip-status">uploading…</span>}
                {a.error && <span className="chat-panel__chip-status" title={a.error}>error</span>}
                <button type="button" className="chat-panel__chip-x" onClick={() => removeAttachment(i)} title="Remove">×</button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-panel__form">
          <div className="chat-panel__input-wrap">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.length) acceptFiles(e.target.files); e.target.value = ''; }}
            />
            <button
              type="button"
              className="chat-panel__attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files (images, PDFs, docs)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
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
              className={`chat-panel__send-btn ${(input.trim() || attachments.some(a => a.path)) ? 'chat-panel__send-btn--active' : ''}`}
              disabled={(!input.trim() && !attachments.some(a => a.path)) || attachments.some(a => a.uploading)}
              title={attachments.some(a => a.uploading) ? 'Waiting for uploads…' : 'Send message'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
