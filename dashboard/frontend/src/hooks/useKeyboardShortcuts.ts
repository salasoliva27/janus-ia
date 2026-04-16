import { useEffect } from 'react';
import { useWindowManager } from '../store/window-store';

export function useKeyboardShortcuts() {
  const { dispatch } = useWindowManager();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case 'b':
          e.preventDefault();
          dispatch({ type: 'TOGGLE_MINIMIZE', id: 'win-chat' });
          break;
        case 'j':
          e.preventDefault();
          dispatch({ type: 'TOGGLE_MINIMIZE', id: 'win-bottom' });
          break;
        case '\\':
          e.preventDefault();
          dispatch({ type: 'TOGGLE_MINIMIZE', id: 'win-right' });
          break;
        case 'k':
          e.preventDefault();
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
  }, [dispatch]);
}
