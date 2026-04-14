import { useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { useDashboard } from '../store';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ChatPanel } from './ChatPanel';
import { Constellation } from './Constellation';
import { ObsidianBrain } from './ObsidianBrain';
import { FileHeatmapView } from './FileHeatmapView';
import { MemoryRiver } from './MemoryRiver';
import { ProjectDrillDown } from './ProjectDrillDown';
import { ToolPulseBar } from './ToolPulseBar';
import { BottomPanel } from './BottomPanel';
import './ShellLayout.css';

export function ShellLayout() {
  const chatPanel = useRef<ImperativePanelHandle>(null);
  const bottomPanel = useRef<ImperativePanelHandle>(null);
  const contextPanel = useRef<ImperativePanelHandle>(null);
  const { centerView, selectedProject } = useDashboard();

  useKeyboardShortcuts({ chatPanel, bottomPanel, workspacePanel: contextPanel });

  const centerContent = centerView === 'brain' ? <ObsidianBrain />
    : centerView === 'files' ? <FileHeatmapView />
    : <Constellation />;

  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="venture-os-main-v2"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Left: Chat + Agent Stream */}
      <Panel ref={chatPanel} defaultSize={22} minSize={15} collapsible collapsedSize={0}>
        <ChatPanel />
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle--vertical" />

      {/* Center: Visualization + Tools + Bottom */}
      <Panel defaultSize={48} minSize={25}>
        <PanelGroup
          direction="vertical"
          autoSaveId="venture-os-center-v2"
          style={{ height: '100%' }}
        >
          {/* Main visualization */}
          <Panel defaultSize={65} minSize={30}>
            {centerContent}
          </Panel>

          {/* Tool Pulse Bar (fixed thin strip via the resize handle area) */}
          <PanelResizeHandle className="resize-handle resize-handle--horizontal" />

          {/* Bottom panel with tabs */}
          <Panel ref={bottomPanel} defaultSize={35} minSize={15} collapsible collapsedSize={0}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <ToolPulseBar />
              <div style={{ flex: 1, minHeight: 0 }}>
                <BottomPanel />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle--vertical" />

      {/* Right: Memory River / Project Drill-Down */}
      <Panel ref={contextPanel} defaultSize={30} minSize={15} collapsible collapsedSize={0}>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <MemoryRiver />
          {selectedProject && <ProjectDrillDown />}
        </div>
      </Panel>
    </PanelGroup>
  );
}
