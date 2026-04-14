import { useEffect } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

interface PanelRefs {
  chatPanel: React.RefObject<ImperativePanelHandle | null>;
  bottomPanel: React.RefObject<ImperativePanelHandle | null>;
  workspacePanel: React.RefObject<ImperativePanelHandle | null>;
}

function togglePanel(panel: ImperativePanelHandle | null, expandSize = 25) {
  if (!panel) return;
  if (panel.isCollapsed()) {
    panel.expand(expandSize);
  } else {
    panel.collapse();
  }
}

export function useKeyboardShortcuts(refs: PanelRefs) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case "b":
          e.preventDefault();
          togglePanel(refs.chatPanel.current, 25);
          break;
        case "j":
          e.preventDefault();
          togglePanel(refs.bottomPanel.current, 30);
          break;
        case "\\":
          e.preventDefault();
          togglePanel(refs.workspacePanel.current, 30);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refs]);
}
