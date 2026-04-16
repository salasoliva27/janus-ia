import { useEffect } from 'react';
import { useWindowManager } from '../store/window-store';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useDashboard } from '../store';
import { Window } from './Window';
import { Taskbar } from './Taskbar';
import '../styles/window-manager.css';
import { ChatPanel } from './ChatPanel';
import { Constellation } from './Constellation';
import { ObsidianBrain } from './ObsidianBrain';
import { FileHeatmapView } from './FileHeatmapView';
import { ProcedureMap } from './ProcedureMap';
import { CalendarPanel } from './CalendarPanel';
import { RightPanel } from './RightPanel';
import { ToolPulseBar } from './ToolPulseBar';
import { BottomPanel } from './BottomPanel';
import { lineageColor } from '../types/window';
import type { WindowState } from '../types/window';

function CenterContent() {
  const { centerView } = useDashboard();
  if (centerView === 'brain') return <ObsidianBrain />;
  if (centerView === 'procedures') return <ProcedureMap />;
  if (centerView === 'files') return <FileHeatmapView />;
  return <Constellation />;
}

function BottomContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ToolPulseBar />
      <div style={{ flex: 1, minHeight: 0 }}>
        <BottomPanel />
      </div>
    </div>
  );
}

function renderWindowContent(win: WindowState) {
  switch (win.type) {
    case 'chat': {
      const label = win.lineage
        ? `L${win.lineage.depth} · ${win.lineage.breadcrumb.join(' > ')}`
        : undefined;
      return (
        <ChatPanel
          sessionId={win.sessionId || 'session-0'}
          lineageLabel={label}
          lineageColor={win.lineage?.color}
        />
      );
    }
    case 'center':
      return <CenterContent />;
    case 'bottom':
      return <BottomContent />;
    case 'right':
      return <RightPanel />;
    case 'calendar':
      return <CalendarPanel />;
    default:
      return <div style={{ padding: 16, color: 'var(--color-text-muted)' }}>Window: {win.type}</div>;
  }
}

export function WindowShell() {
  const { layout, dispatch } = useWindowManager();
  useKeyboardShortcuts();

  // Listen for fork-chat events from the store
  useEffect(() => {
    function handleFork(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail?.sessionId) return;

      const depth = detail.depth || 1;
      const color = lineageColor(depth);
      const parentLabel = 'Main';

      // Create new chat window offset from center
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const newWin: WindowState = {
        id: `win-chat-${detail.sessionId}`,
        title: detail.label || `Fork`,
        type: 'chat',
        x: Math.round(vw * 0.15 + Math.random() * 100),
        y: Math.round(vh * 0.1 + Math.random() * 60),
        width: Math.round(vw * 0.28),
        height: Math.round(vh * 0.65),
        minWidth: 260,
        minHeight: 200,
        zIndex: 0, // will be set by ADD
        minimized: false,
        maximized: false,
        visible: true,
        closable: true,
        sessionId: detail.sessionId,
        lineage: {
          depth,
          label: detail.label || 'Fork',
          parentSessionId: detail.parentSessionId || 'session-0',
          breadcrumb: [parentLabel, detail.label || 'Fork'],
          color,
        },
      };

      dispatch({ type: 'ADD', window: newWin });
    }

    window.addEventListener('venture-os:fork-chat', handleFork);
    return () => window.removeEventListener('venture-os:fork-chat', handleFork);
  }, [dispatch]);

  return (
    <div className="wm-shell">
      <div className="wm-viewport">
        {layout.windows.map(win => (
          <Window key={win.id} state={win}>
            {renderWindowContent(win)}
          </Window>
        ))}
      </div>
      <Taskbar />
    </div>
  );
}
