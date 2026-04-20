import { useState, useRef, useEffect, useCallback } from 'react';
import { useDashboard } from '../store';
import { useActiveTheme } from './ThemeEngine';
import type { ConnectionStatus } from '../hooks/useWebSocket';
import type { ServerMessage } from '../types/bridge';

type DevStatus = 'idle' | 'updating' | 'ready' | 'error';

function useDevStatus(lastMessage: ServerMessage | null): DevStatus {
  const [status, setStatus] = useState<DevStatus>('idle');
  const settleRef = useRef<ReturnType<typeof setTimeout>>();
  const dismissRef = useRef<ReturnType<typeof setTimeout>>();
  const hmrCooldownRef = useRef(false);

  const clearTimers = useCallback(() => {
    clearTimeout(settleRef.current);
    clearTimeout(dismissRef.current);
  }, []);

  // Transition to "updating", then settle to "ready" after quiet period
  const markUpdating = useCallback((needsReload: boolean) => {
    setStatus('updating');
    clearTimers();
    settleRef.current = setTimeout(() => {
      setStatus('ready');
      dismissRef.current = setTimeout(() => setStatus('idle'), needsReload ? 10000 : 3000);
    }, 1500);
  }, [clearTimers]);

  // Vite HMR events (frontend source changes — auto-applied, no reload needed)
  useEffect(() => {
    if (!import.meta.hot) return;

    import.meta.hot.on('vite:beforeUpdate', () => {
      hmrCooldownRef.current = true;
      markUpdating(false);
    });

    import.meta.hot.on('vite:afterUpdate', () => {
      setStatus('ready');
      clearTimers();
      dismissRef.current = setTimeout(() => {
        setStatus('idle');
        hmrCooldownRef.current = false;
      }, 3000);
    });

    import.meta.hot.on('vite:error', () => {
      hmrCooldownRef.current = false;
      setStatus('error');
      clearTimers();
      dismissRef.current = setTimeout(() => setStatus('idle'), 12000);
    });

    import.meta.hot.on('vite:beforeFullReload', () => {
      hmrCooldownRef.current = false;
      setStatus('ready');
      clearTimers();
    });

    return () => clearTimers();
  }, [markUpdating, clearTimers]);

  // WebSocket events — file changes from codespace or tool use
  useEffect(() => {
    if (!lastMessage) return;
    // Skip if HMR already handled this change cycle
    if (hmrCooldownRef.current) return;

    if (lastMessage.type === 'fs_event') {
      const p = lastMessage.path;
      if (p && (p.includes('/dashboard/frontend/src/') || p.includes('/dashboard/bridge/'))) {
        markUpdating(true);
      }
    } else if (lastMessage.type === 'tool_event') {
      const tool = lastMessage.toolName;
      if (tool === 'Write' || tool === 'Edit' || tool.includes('write_file') || tool.includes('edit_file')) {
        markUpdating(true);
      }
    }
  }, [lastMessage, markUpdating]);

  return status;
}

function DevIndicator({ lastMessage }: { lastMessage: ServerMessage | null }) {
  const status = useDevStatus(lastMessage);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  if (status === 'idle') return null;

  return (
    <div className={`dev-indicator dev-indicator--${status}`}>
      <div className="dev-indicator__dot" />
      <span className="dev-indicator__label">
        {status === 'updating' && 'building...'}
        {status === 'ready' && 'updated'}
        {status === 'error' && 'build error'}
      </span>
      {status === 'ready' && (
        <button className="dev-indicator__reload" onClick={handleReload}>
          Reload
        </button>
      )}
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function StatusRing({ status, processing }: { status: ConnectionStatus; processing: boolean }) {
  const cls = status === 'disconnected' ? 'status-ring--disconnected' : processing ? 'status-ring--processing' : '';
  return (
    <div className={`status-ring ${cls}`} title={`Bridge: ${status}`}>
      <div className="status-ring__circle" />
      <div className="status-ring__inner" />
    </div>
  );
}

interface AgentInfo {
  id: string;
  label: string;
  envVar: string | null;
  available: boolean;
  authMethod: 'oauth' | 'api-key';
  reason?: string;
}

function AgentPicker({ onCredentials }: { onCredentials?: () => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [active, setActive] = useState<string>(() => localStorage.getItem('venture-os-agent') || 'claude');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch('/api/agents');
        const j = await r.json();
        if (!cancelled && Array.isArray(j.agents)) setAgents(j.agents);
      } catch { /* bridge warming up */ }
    }
    load();
    const i = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pick(id: string) {
    localStorage.setItem('venture-os-agent', id);
    setActive(id);
    setOpen(false);
    // Broadcast so the store can pick it up without prop-drilling
    window.dispatchEvent(new CustomEvent('venture-os:agent-change', { detail: { agentId: id } }));
  }

  const activeAgent = agents.find(a => a.id === active);
  const activeLabel = activeAgent?.label || 'Claude Code';

  return (
    <div ref={ref} className="agent-picker">
      <button
        className="agent-picker__btn"
        onClick={() => setOpen(v => !v)}
        title={activeAgent?.reason || `Agent: ${activeLabel}`}
      >
        <span className="agent-picker__dot" style={{
          background: activeAgent?.available === false ? 'oklch(0.65 0.2 25)' : 'var(--color-accent)',
        }} />
        <span>{activeLabel}</span>
        <span className="agent-picker__caret">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="agent-picker__menu">
          {agents.length === 0 && <div className="agent-picker__empty">loading…</div>}
          {agents.map(a => (
            <button
              key={a.id}
              className={`agent-picker__item ${a.id === active ? 'agent-picker__item--active' : ''} ${!a.available ? 'agent-picker__item--disabled' : ''}`}
              onClick={() => a.available && pick(a.id)}
              disabled={!a.available}
            >
              <span className="agent-picker__item-dot" style={{
                background: a.available ? 'var(--color-accent)' : 'oklch(0.65 0.2 25)',
              }} />
              <span className="agent-picker__item-label">{a.label}</span>
              {!a.available && a.envVar && (
                <span className="agent-picker__item-missing">
                  needs {a.envVar}
                  {onCredentials && (
                    <span
                      className="agent-picker__item-connect"
                      onClick={(e) => { e.stopPropagation(); setOpen(false); onCredentials(); }}
                    >Connect</span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { notifications, dismissNotification } = useDashboard();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="notif-bell" onClick={() => setOpen(!open)}>
        <span style={{ fontFamily: 'var(--font-family-mono)' }}>{'[!]'}</span>
        {unread > 0 && <span className="notif-bell__badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          {notifications.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>No notifications</div>
          )}
          {notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.read ? 'notif-item--unread' : ''}`}
              onClick={() => dismissNotification(n.id)}
            >
              <div className="notif-item__title">{n.title}</div>
              <div className="notif-item__msg">{n.message}</div>
              <div className="notif-item__time">{timeAgo(n.timestamp)} ago{n.project ? ` | ${n.project}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionUsage() {
  const { chatMessages, tools } = useDashboard();
  const [elapsed, setElapsed] = useState(0);

  // Track session start from first user message
  const sessionStart = useRef<number | null>(null);
  const firstUserMsg = chatMessages.find(m => m.role === 'user');
  if (firstUserMsg && !sessionStart.current) sessionStart.current = firstUserMsg.timestamp;

  useEffect(() => {
    if (!sessionStart.current) return;
    const tick = () => setElapsed(Math.floor((Date.now() - sessionStart.current!) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [firstUserMsg]);

  const totalCalls = tools.reduce((sum, t) => sum + t.callCount, 0);
  const msgs = chatMessages.filter(m => m.role === 'user').length;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);

  return (
    <div className="session-usage" title="Session duration and usage">
      <span className="session-usage__time">{h}h {m.toString().padStart(2, '0')}m</span>
      <span className="session-usage__sep">&middot;</span>
      <span className="session-usage__stat">{msgs} msg{msgs !== 1 ? 's' : ''}</span>
      <span className="session-usage__sep">&middot;</span>
      <span className="session-usage__stat">{totalCalls} calls</span>
    </div>
  );
}

function ContextUsage() {
  const { chatMessages, tools } = useDashboard();

  // Rough token estimate: ~1 token per 4 chars of content, plus overhead per message/tool call
  const BASE_TOKENS = 20_000; // system prompt + CLAUDE.md
  const CONTEXT_LIMIT = 1_000_000; // Opus 4.6 1M
  const msgTokens = chatMessages.reduce((sum, m) => {
    const contentTokens = Math.ceil(m.content.length / 4);
    const overhead = m.role === 'assistant' ? 200 : 100;
    return sum + contentTokens + overhead;
  }, 0);
  const toolTokens = tools.reduce((sum, t) => sum + t.callCount * 800, 0);
  const totalTokens = BASE_TOKENS + msgTokens + toolTokens;
  const pct = Math.min(99, Math.round((totalTokens / CONTEXT_LIMIT) * 100));

  const color = pct > 80 ? 'oklch(0.75 0.2 25)' : pct > 50 ? 'oklch(0.8 0.15 85)' : 'var(--color-text-muted)';

  return (
    <span style={{ fontSize: 10, fontFamily: 'var(--font-family-mono)', color }} title={`~${Math.round(totalTokens / 1000)}k / 1M tokens`}>
      {pct}%
    </span>
  );
}

export function TopBar({ connectionStatus, onThemeToggle, lastMessage, onCredentials }: { connectionStatus: ConnectionStatus; onThemeToggle?: () => void; lastMessage: ServerMessage | null; onCredentials?: () => void }) {
  const { gitCommits, agents } = useDashboard();
  const processing = agents.some(a => a.status === 'executing' || a.status === 'thinking');
  const theme = useActiveTheme();

  // Group recent commits by repo, show latest per repo
  const repoCommits = new Map<string, typeof gitCommits[0]>();
  for (const c of gitCommits) {
    if (!repoCommits.has(c.repo)) repoCommits.set(c.repo, c);
  }

  return (
    <div className="top-bar">
      {theme?.logo && (
        <img className="top-bar__brand-logo" src={theme.logo} alt={`${theme.name} logo`} />
      )}
      <div className="top-bar__git-lanes">
        {Array.from(repoCommits.entries()).slice(0, 5).map(([repo, commit]) => (
          <div key={repo} className="top-bar__git-lane">
            <div className="top-bar__git-dot" style={{ background: commit.repoColor }} />
            <span style={{ color: commit.repoColor, fontWeight: 600 }}>{repo}</span>
            <span className="top-bar__git-msg">{commit.message}</span>
          </div>
        ))}
        {repoCommits.size === 0 && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
            waiting for commits... <ContextUsage />
          </span>
        )}
      </div>
      <div className="top-bar__right">
        <AgentPicker onCredentials={onCredentials} />
        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            title="Theme (Ctrl+T)"
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-family-mono)', fontSize: 12, cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            [T]
          </button>
        )}
        <SessionUsage />
        {onCredentials && (
          <button
            onClick={onCredentials}
            title="Credentials"
            className="top-bar__icon-btn"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </button>
        )}
        <DevIndicator lastMessage={lastMessage} />
        <StatusRing status={connectionStatus} processing={processing} />
        <NotificationBell />
      </div>
    </div>
  );
}
