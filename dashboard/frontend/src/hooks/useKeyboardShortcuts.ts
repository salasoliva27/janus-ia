import { useEffect, useContext } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

// Import store actions without circular dep — we access via context in parent
// This hook just handles panel toggling + global shortcuts

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
        case 'b':
          e.preventDefault();
          togglePanel(refs.chatPanel.current, 22);
          break;
        case 'j':
          e.preventDefault();
          togglePanel(refs.bottomPanel.current, 35);
          break;
        case '\\':
          e.preventDefault();
          togglePanel(refs.workspacePanel.current, 30);
          break;
        case 'k':
          e.preventDefault();
          // Dispatch custom event — picked up by App
          window.dispatchEvent(new CustomEvent('venture-os:toggle-palette'));
          break;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('venture-os:toggle-scoreboard'));
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refs]);
}
