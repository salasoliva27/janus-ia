import { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../store';
import type { ConnectionStatus } from '../hooks/useWebSocket';

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

export function TopBar({ connectionStatus }: { connectionStatus: ConnectionStatus }) {
  const { gitCommits, agents } = useDashboard();
  const processing = agents.some(a => a.status === 'executing' || a.status === 'thinking');

  // Group recent commits by repo, show latest per repo
  const repoCommits = new Map<string, typeof gitCommits[0]>();
  for (const c of gitCommits) {
    if (!repoCommits.has(c.repo)) repoCommits.set(c.repo, c);
  }

  return (
    <div className="top-bar">
      <div className="top-bar__git-lanes">
        {Array.from(repoCommits.entries()).slice(0, 5).map(([repo, commit]) => (
          <div key={repo} className="top-bar__git-lane">
            <div className="top-bar__git-dot" style={{ background: commit.repoColor }} />
            <span style={{ color: commit.repoColor, fontWeight: 600 }}>{repo}</span>
            <span className="top-bar__git-msg">{commit.message}</span>
          </div>
        ))}
        {repoCommits.size === 0 && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)' }}>
            waiting for commits...
          </span>
        )}
      </div>
      <div className="top-bar__right">
        <StatusRing status={connectionStatus} processing={processing} />
        <NotificationBell />
      </div>
    </div>
  );
}
