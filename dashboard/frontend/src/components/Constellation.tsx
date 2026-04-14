import { useDashboard } from '../store';
import type { CenterView } from '../types/dashboard';

const STAGE_SIZES: Record<string, number> = { idea: 20, dev: 32, uat: 38, prod: 44 };

export function Constellation() {
  const { projects, selectProject, centerView, setCenterView } = useDashboard();

  // Position projects in a spread layout
  const positions = projects.map((p, i) => {
    const angle = (i / projects.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 28 + (p.stage === 'prod' ? 5 : p.stage === 'idea' ? 35 : 20);
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    };
  });

  // SVG connections between projects that share stack
  const connections: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const shared = projects[i].stack.filter(s => projects[j].stack.includes(s));
      if (shared.length > 0) {
        connections.push({
          x1: positions[i].x, y1: positions[i].y,
          x2: positions[j].x, y2: positions[j].y,
          opacity: Math.min(0.3, shared.length * 0.1),
        });
      }
    }
  }

  const views: { id: CenterView; label: string }[] = [
    { id: 'constellation', label: 'Constellation' },
    { id: 'brain', label: 'Brain' },
    { id: 'files', label: 'Files' },
  ];

  return (
    <div className="constellation">
      {/* Connection lines */}
      <svg className="constellation__connection" viewBox="0 0 100 100" preserveAspectRatio="none">
        {connections.map((c, i) => (
          <line
            key={i}
            x1={`${c.x1}%`} y1={`${c.y1}%`}
            x2={`${c.x2}%`} y2={`${c.y2}%`}
            stroke="var(--color-accent)"
            strokeWidth="0.15"
            opacity={c.opacity}
          />
        ))}
      </svg>

      {/* Project nodes */}
      {projects.map((project, i) => {
        const size = STAGE_SIZES[project.stage] || 32;
        const healthColors: Record<string, string> = {
          green: 'oklch(0.70 0.20 145)',
          amber: 'oklch(0.75 0.20 85)',
          red: 'oklch(0.65 0.25 25)',
        };

        return (
          <div
            key={project.id}
            className="constellation__node"
            style={{
              left: `${positions[i].x}%`,
              top: `${positions[i].y}%`,
              animationDelay: `${i * 0.7}s`,
            }}
            onClick={() => selectProject(project.id)}
          >
            <div
              className="constellation__orb"
              style={{
                width: size,
                height: size,
                background: `radial-gradient(circle at 35% 35%, ${project.color}, oklch(0.20 0.01 260))`,
                color: project.color,
                boxShadow: `0 0 ${size / 2}px ${project.color.replace(')', ' / 0.3)')}`,
              }}
            />
            <span className="constellation__label">{project.displayName}</span>
            <span className="constellation__stage">
              <span
                style={{
                  display: 'inline-block',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: healthColors[project.health],
                  marginRight: 4,
                  verticalAlign: 'middle',
                }}
              />
              {project.stage}
              {project.phaseProgress < 1 && ` ${Math.round(project.phaseProgress * 100)}%`}
            </span>
          </div>
        );
      })}

      {/* View toggle */}
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
