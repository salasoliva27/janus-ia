import { useEffect, useState } from 'react';

interface EnvVarEntry {
  key: string;
  sourceVar: string | null;
  present: boolean;
  literal: boolean;
}

interface ServerEntry {
  name: string;
  type: string;
  command: string | null;
  args: string[];
  url: string | null;
  envVars: EnvVarEntry[];
  status: 'ready' | 'needs-env';
  missing: string[];
}

export function McpConfigButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="credentials__trigger" onClick={onClick} title="MCP Config">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </button>
  );
}

export function McpConfig({ onClose }: { onClose: () => void }) {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [configPath, setConfigPath] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      const r = await fetch('/api/mcp/list');
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'load failed');
      setServers(j.servers || []);
      setConfigPath(j.configPath || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 15_000);
    return () => clearInterval(i);
  }, []);

  const ready = servers.filter(s => s.status === 'ready').length;

  return (
    <div className="credentials__overlay" onClick={onClose}>
      <div className="credentials__box" onClick={e => e.stopPropagation()}>
        <div className="credentials__header">
          <span className="credentials__title">
            MCP Servers
            <span style={{ marginLeft: 10, fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)' }}>
              {ready}/{servers.length} ready
            </span>
          </span>
          <button className="credentials__close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', color: 'oklch(0.68 0.22 25)', fontFamily: 'var(--font-family-mono)', fontSize: 11 }}>
            {error}
          </div>
        )}

        <div className="credentials__list">
          {servers.length === 0 && !error && (
            <div className="credentials__group">
              <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>loading…</div>
            </div>
          )}

          {servers.map(s => {
            const isOpen = expanded[s.name] ?? (s.status !== 'ready');
            return (
              <div key={s.name} className="credentials__entry" style={{ marginBottom: 6 }}>
                <div className="credentials__entry-head"
                     onClick={() => setExpanded(p => ({ ...p, [s.name]: !isOpen }))}
                     style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div className="credentials__entry-title">
                    <span
                      className={`credentials__entry-status credentials__entry-status--${s.status === 'ready' ? 'complete' : 'partial'}`}
                      title={s.status === 'ready' ? 'All env vars set' : `Missing: ${s.missing.join(', ')}`}
                    />
                    <span className="credentials__key-name">{s.name}</span>
                    <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)' }}>
                      {s.type}
                    </span>
                  </div>
                  <div className="credentials__entry-actions">
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)' }}>
                      {s.status === 'ready' ? '✓ ready' : `⚠ ${s.missing.length} missing`}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <>
                    {(s.command || s.url) && (
                      <div className="credentials__scope" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 10 }}>
                        <span className="credentials__scope-label">{s.url ? 'URL:' : 'Command:'}</span>{' '}
                        {s.url ? s.url : `${s.command} ${s.args.join(' ')}`}
                      </div>
                    )}

                    {s.envVars.length > 0 && (
                      <div style={{ padding: '4px 16px 8px' }}>
                        {s.envVars.map(v => (
                          <div key={v.key} className="credentials__field">
                            <div className="credentials__row-info">
                              <span className={`credentials__dot credentials__dot--${v.present ? 'set' : 'unset'}`} />
                              <span className="credentials__field-label">{v.key}</span>
                              {v.sourceVar && (
                                <span className="credentials__env-var">{v.sourceVar}</span>
                              )}
                              {v.literal && (
                                <span className="credentials__env-var" style={{ opacity: 0.6 }}>literal</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {s.envVars.length === 0 && (
                      <div className="credentials__scope" style={{ fontSize: 10, opacity: 0.7 }}>
                        No env vars required.
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="credentials__footer">
          Source of truth: <code style={{ fontFamily: 'var(--font-family-mono)' }}>{configPath || '.mcp.json'}</code>.
          Edit via the File Editor panel; changes take effect on the next agent turn (CLI reloads <code>.mcp.json</code> per spawn).
        </div>
      </div>
    </div>
  );
}
