import { useDashboard } from '../store';
import type { CenterView } from '../types/dashboard';

const STAGE_ICON: Record<string, string> = { idea: '\u2727', dev: '\u2692', uat: '\u2691', prod: '\u2713' };

export function Constellation() {
  const { projects, agents, sessionEvents, selectProject, centerView, setCenterView } = useDashboard();

  // Determine which projects are currently active (agent working on them)
  const activeMap = new Map<string, { agent: string; phase: string; message: string; status: string }>();
  for (const a of agents) {
    if (a.status !== 'done') {
      // Match agent.project to project.name or project.displayName
      const match = projects.find(p =>
        p.name === a.project || p.displayName === a.project || p.id === a.project
      );
      if (match) {
        activeMap.set(match.id, { agent: a.agent, phase: a.phase, message: a.message, status: a.status });
      }
    }
  }

  // Also check recent session events for project activity (last 30s)
  const recentCutoff = Date.now() - 30000;
  for (const ev of sessionEvents) {
    if (ev.project && ev.timestamp > recentCutoff) {
      const match = projects.find(p => p.name === ev.project || p.id === ev.project);
      if (match && !activeMap.has(match.id)) {
        activeMap.set(match.id, { agent: ev.type, phase: '', message: ev.label, status: 'executing' });
      }
    }
  }

  const views: { id: CenterView; label: string }[] = [
    { id: 'constellation', label: 'Projects' },
    { id: 'brain', label: 'Brain' },
    { id: 'procedures', label: 'Procedures' },
    { id: 'files', label: 'Activity' },
  ];

  return (
    <div className="project-grid__wrapper">
      <div className="project-grid">
        <div className="project-grid__tiles">
          {projects.map(p => {
          const active = activeMap.get(p.id);
          const isActive = !!active;

          return (
            <div
              key={p.id}
              className={`project-grid__tile ${isActive ? 'project-grid__tile--active' : ''}`}
              style={{ '--proj-color': p.color } as React.CSSProperties}
              onClick={() => selectProject(p.id)}
            >
              {/* Glow layer for active projects */}
              {isActive && <div className="project-grid__glow" />}

              <div className="project-grid__tile-top">
                <span className={`project-grid__icon ${isActive ? 'project-grid__icon--pulse' : ''}`}>
                  {STAGE_ICON[p.stage] || '\u2727'}
                </span>
                <span className={`project-grid__health project-grid__health--${p.health}`} />
              </div>

              <div className="project-grid__name">{p.displayName}</div>
              <div className="project-grid__stage">{p.stage.toUpperCase()}</div>

              {/* Progress bar */}
              <div className="project-grid__progress">
                <div className="project-grid__progress-fill" style={{ width: `${p.phaseProgress * 100}%` }} />
              </div>
              <div className="project-grid__phase">{p.currentPhase}</div>

              {/* Stack badges */}
              <div className="project-grid__stack">
                {p.stack.slice(0, 3).map(s => (
                  <span key={s} className="project-grid__stack-pill">{s}</span>
                ))}
              </div>

              {/* Active agent overlay */}
              {isActive && active && (
                <div className="project-grid__agent-bar">
                  <span className="project-grid__agent-dot" />
                  <span className="project-grid__agent-name">{active.agent}</span>
                  {active.phase && <span className="project-grid__agent-phase">{active.phase}</span>}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

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
