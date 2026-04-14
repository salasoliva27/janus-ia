import { useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { PanelPlaceholder } from "./PanelPlaceholder";
import { BottomPanelSwitcher } from "./BottomPanelSwitcher";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import "./ShellLayout.css";

export function ShellLayout() {
  const chatPanel = useRef<ImperativePanelHandle>(null);
  const bottomPanel = useRef<ImperativePanelHandle>(null);
  const workspacePanel = useRef<ImperativePanelHandle>(null);

  useKeyboardShortcuts({ chatPanel, bottomPanel, workspacePanel });

  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="venture-os-main"
      style={{ width: "100%", height: "100%" }}
    >
      {/* Left: Chat */}
      <Panel ref={chatPanel} defaultSize={25} minSize={15} collapsible collapsedSize={0}>
        <PanelPlaceholder name="Chat" />
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle--vertical" />

      {/* Center: Graph + Bottom */}
      <Panel defaultSize={45} minSize={20}>
        <PanelGroup
          direction="vertical"
          autoSaveId="venture-os-center"
          style={{ height: "100%" }}
        >
          <Panel defaultSize={100} minSize={30}>
            <PanelPlaceholder name="System Graph" />
          </Panel>

          <PanelResizeHandle className="resize-handle resize-handle--horizontal" />

          <Panel ref={bottomPanel} defaultSize={0} minSize={15} collapsible collapsedSize={0}>
            <BottomPanelSwitcher />
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle--vertical" />

      {/* Right: Workspace */}
      <Panel ref={workspacePanel} defaultSize={30} minSize={15} collapsible collapsedSize={0}>
        <PanelPlaceholder name="Workspace" />
      </Panel>
    </PanelGroup>
  );
}
