import { useDashboard } from '../store';

export function ProjectDrillDown() {
  const { projects, selectedProject, selectProject } = useDashboard();
  const project = projects.find(p => p.id === selectedProject);

  if (!project) return null;

  return (
    <div className="drill-down">
      <button className="drill-down__close" onClick={() => selectProject(null)}>x</button>

      <div className="drill-down__header">
        <div className="drill-down__name">{project.displayName}</div>
        <div className="drill-down__desc">{project.description}</div>
        <span className={`drill-down__badge drill-down__badge--${project.stage}`}>
          {project.stage}
        </span>
      </div>

      {/* Phase progress */}
      <div className="drill-down__section">
        <div className="drill-down__section-title">Current Phase</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 4 }}>
          {project.currentPhase}
        </div>
        <div className="drill-down__progress-bar">
          <div className="drill-down__progress-fill" style={{ width: `${project.phaseProgress * 100}%` }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4, fontFamily: 'var(--font-family-mono)' }}>
          {Math.round(project.phaseProgress * 100)}% complete
        </div>
      </div>

      {/* Stack */}
      <div className="drill-down__section">
        <div className="drill-down__section-title">Stack</div>
        <div className="drill-down__stack">
          {project.stack.map(s => (
            <span key={s} className="drill-down__chip">{s}</span>
          ))}
        </div>
      </div>

      {/* Last commit */}
      <div className="drill-down__section">
        <div className="drill-down__section-title">Last Commit</div>
        <div className="drill-down__commit">
          <span style={{ color: 'var(--color-accent)' }}>{project.lastCommit.hash}</span>
          {' '}{project.lastCommit.message}
          <span style={{ marginLeft: 8, opacity: 0.5 }}>{project.lastCommit.age} ago</span>
        </div>
      </div>

      {/* Financial */}
      {(project.burn !== undefined || project.revenue !== undefined) && (
        <div className="drill-down__section">
          <div className="drill-down__section-title">Financial</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            {project.burn !== undefined && (
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>Burn/mo</div>
                <div style={{ color: project.burn > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                  ${project.burn}
                </div>
              </div>
            )}
            {project.revenue !== undefined && (
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>Revenue/mo</div>
                <div style={{ color: project.revenue > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                  ${project.revenue}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legal flags */}
      {project.legalFlags.length > 0 && (
        <div className="drill-down__section">
          <div className="drill-down__section-title">Legal Flags</div>
          <ul className="drill-down__list">
            {project.legalFlags.map(f => (
              <li key={f} className="drill-down__list-item" style={{ color: 'oklch(0.75 0.20 85)' }}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next actions */}
      {project.nextActions.length > 0 && (
        <div className="drill-down__section">
          <div className="drill-down__section-title">Next Actions</div>
          <ul className="drill-down__list">
            {project.nextActions.map((a, i) => (
              <li key={i} className="drill-down__list-item">{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick actions */}
      <div className="drill-down__actions">
        <button className="drill-down__action-btn">Open Repo</button>
        <button className="drill-down__action-btn">Run Tests</button>
        {project.stage !== 'prod' && <button className="drill-down__action-btn">Deploy</button>}
      </div>
    </div>
  );
}
