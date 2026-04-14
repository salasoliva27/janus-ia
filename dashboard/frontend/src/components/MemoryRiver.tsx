import { useDashboard } from '../store';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function MemoryRiver() {
  const { memories } = useDashboard();

  return (
    <div className="memory-river">
      <div className="memory-river__header">
        Memory Stream ({memories.length})
      </div>
      {memories.map(mem => (
        <div key={mem.id} className={`memory-river__card memory-river__card--${mem.type}`}>
          <div className="memory-river__card-type">
            {mem.type}
            <span className="memory-river__card-dir">
              {mem.direction === 'in' ? 'recalled' : 'written'}
            </span>
          </div>
          <div className="memory-river__card-content">{mem.content}</div>
          {mem.project && (
            <div className="memory-river__card-project">{mem.project} | {timeAgo(mem.timestamp)}</div>
          )}
        </div>
      ))}
      {memories.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flex: 1, color: 'var(--color-text-muted)', fontSize: 12,
          fontFamily: 'var(--font-family-mono)',
        }}>
          waiting for memory activity...
        </div>
      )}
    </div>
  );
}
