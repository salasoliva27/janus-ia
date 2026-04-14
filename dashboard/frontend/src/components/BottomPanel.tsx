import { useState } from 'react';
import { useDashboard } from '../store';

type Tab = 'timeline' | 'capacity' | 'learnings' | 'files' | 'terminal';

const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'learnings', label: 'Learnings' },
  { id: 'files', label: 'Files' },
  { id: 'terminal', label: 'Terminal' },
];

function SessionTimeline() {
  const { sessionEvents } = useDashboard();
  if (sessionEvents.length === 0) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-family-mono)', padding: 8 }}>waiting for session events...</div>;
  }

  return (
    <div className="session-timeline">
      {sessionEvents.slice(0, 30).map((ev, i) => (
        <div key={ev.id} style={{ display: 'contents' }}>
          {i > 0 && <div className="session-timeline__line" />}
          <div className="session-timeline__event" title={ev.label}>
            <div className={`session-timeline__dot session-timeline__dot--${ev.type}`} />
            <div className="session-timeline__label">{ev.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CapacityHeatmap() {
  const { calendarSlots } = useDashboard();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="capacity-heatmap">
      {days.map(d => (
        <div key={d} className="capacity-heatmap__day-header">{d}</div>
      ))}
      {calendarSlots.map(slot => {
        const r = Math.round(slot.load * 255);
        const g = Math.round((1 - slot.load) * 180);
        const bg = `rgba(${r}, ${g}, 60, ${0.3 + slot.load * 0.5})`;
        return (
          <div
            key={slot.date}
            className="capacity-heatmap__cell"
            style={{ background: bg }}
            title={`${slot.date}: ${Math.round(slot.load * 100)}% loaded\n${slot.items.join(', ')}`}
          >
            <div className="capacity-heatmap__cell-date">{slot.date.slice(-2)}</div>
          </div>
        );
      })}
    </div>
  );
}

function LearningFeed() {
  const { learnings } = useDashboard();

  return (
    <div className="learning-feed">
      {learnings.map(l => (
        <div key={l.id} className={`learning-feed__item learning-feed__item--${l.domain}`}>
          <div className="learning-feed__domain">{l.domain}</div>
          <div>{l.content}</div>
          <div className="learning-feed__project">{l.project}</div>
        </div>
      ))}
    </div>
  );
}

function FileHeatmap() {
  const { fileActivities } = useDashboard();
  const maxChanges = Math.max(...fileActivities.map(f => f.changes), 1);

  return (
    <div className="file-heatmap">
      {fileActivities.map((f, i) => {
        const intensity = f.changes / maxChanges;
        const width = Math.max(30, f.size / 5);
        const age = (Date.now() - f.lastModified) / 604800000; // weeks
        const heat = Math.max(0.15, 1 - age);

        return (
          <div
            key={i}
            className="file-heatmap__cell"
            style={{
              width,
              height: Math.max(20, 16 + intensity * 24),
              background: f.repoColor.replace(')', ` / ${0.15 + heat * 0.4})`).replace('oklch', 'oklch'),
              backgroundColor: `rgba(255,255,255,${0.03 + intensity * 0.12})`,
            }}
            title={`${f.repo}/${f.path}\n${f.changes} changes`}
          >
            <span className="file-heatmap__cell-label">{f.path.split('/').pop()}</span>
          </div>
        );
      })}
    </div>
  );
}

function TerminalPreview() {
  const { terminalLines } = useDashboard();

  return (
    <div className="terminal-preview">
      {terminalLines.map((line, i) => {
        const cls = line.includes('[tool]') ? 'terminal-preview__line--tool'
          : line.includes('error') ? 'terminal-preview__line--error'
          : 'terminal-preview__line--info';
        return (
          <div key={i} className={`terminal-preview__line ${cls}`}>{line}</div>
        );
      })}
    </div>
  );
}

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('timeline');

  const content: Record<Tab, React.ReactNode> = {
    timeline: <SessionTimeline />,
    capacity: <CapacityHeatmap />,
    learnings: <LearningFeed />,
    files: <FileHeatmap />,
    terminal: <TerminalPreview />,
  };

  return (
    <div className="bottom-panel-switcher">
      <div className="bottom-panel-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`bottom-panel-tab ${activeTab === tab.id ? 'bottom-panel-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bottom-panel-content">
        {content[activeTab]}
      </div>
    </div>
  );
}
