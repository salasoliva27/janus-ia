import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { PanelPlaceholder } from "./PanelPlaceholder";
import "./ShellLayout.css";

export function ShellLayout() {
  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="venture-os-main"
      style={{ width: "100%", height: "100%" }}
    >
      {/* Left: Chat */}
      <Panel defaultSize={25} minSize={15} collapsible collapsedSize={0}>
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

          <Panel defaultSize={0} minSize={15} collapsible collapsedSize={0}>
            <PanelPlaceholder name="Bottom Panel" />
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle--vertical" />

      {/* Right: Workspace */}
      <Panel defaultSize={30} minSize={15} collapsible collapsedSize={0}>
        <PanelPlaceholder name="Workspace" />
      </Panel>
    </PanelGroup>
  );
}
