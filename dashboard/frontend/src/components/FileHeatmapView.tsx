import { useDashboard } from '../store';
import type { CenterView } from '../types/dashboard';

export function FileHeatmapView() {
  const { fileActivities, centerView, setCenterView } = useDashboard();
  const maxChanges = Math.max(...fileActivities.map(f => f.changes), 1);

  // Group by repo
  const repos = new Map<string, typeof fileActivities>();
  for (const f of fileActivities) {
    if (!repos.has(f.repo)) repos.set(f.repo, []);
    repos.get(f.repo)!.push(f);
  }

  const views: { id: CenterView; label: string }[] = [
    { id: 'constellation', label: 'Constellation' },
    { id: 'brain', label: 'Brain' },
    { id: 'files', label: 'Files' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--color-bg-secondary)', overflow: 'auto', padding: 12 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-muted)', marginBottom: 12 }}>
        File Activity Across Repos
      </div>

      {Array.from(repos.entries()).map(([repo, files]) => (
        <div key={repo} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-family-mono)', color: files[0].repoColor, marginBottom: 6 }}>
            {repo}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {files.map((f, i) => {
              const intensity = f.changes / maxChanges;
              const age = (Date.now() - f.lastModified) / 604800000;
              const heat = Math.max(0.15, 1 - age);

              return (
                <div
                  key={i}
                  style={{
                    width: Math.max(40, f.size / 4),
                    height: Math.max(22, 18 + intensity * 20),
                    borderRadius: 3,
                    background: `rgba(255,255,255,${0.03 + heat * 0.1 + intensity * 0.08})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                    transition: 'transform 0.15s',
                    fontSize: 8,
                    fontFamily: 'var(--font-family-mono)',
                    color: 'rgba(255,255,255,0.5)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    padding: '0 3px',
                    border: `1px solid ${f.repoColor.replace(')', ' / 0.2)')}`,
                  }}
                  title={`${f.path}\n${f.changes} changes\n${Math.round(age * 7)}d old`}
                >
                  {f.path.split('/').pop()}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="constellation__view-toggle">
        {views.map(v => (
          <button
            key={v.id}
            className={`constellation__view-btn ${centerView === v.id ? 'constellation__view-btn--active' : ''}`}
            onClick={() => setCenterView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
