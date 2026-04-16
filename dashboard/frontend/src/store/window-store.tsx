import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { WindowState, WindowLayout, WindowAction, SlotId } from '../types/window';
import { slotBounds } from '../types/window';

const STORAGE_KEY = 'venture-os-window-layout-v2';
const TOPBAR_HEIGHT = 40;
const TASKBAR_HEIGHT = 34;

function vw() { return typeof window !== 'undefined' ? window.innerWidth : 1920; }
function vh() { return typeof window !== 'undefined' ? window.innerHeight - TOPBAR_HEIGHT - TASKBAR_HEIGHT : 900; }

// ── Recompute pixel bounds for all windows from slots + column/row sizes ──

function recomputeBounds(layout: WindowLayout): WindowLayout {
  const w = vw(), h = vh();
  return {
    ...layout,
    windows: layout.windows.map(win => {
      if (win.maximized) return { ...win, x: 0, y: 0, width: w, height: h };
      const b = slotBounds(win.slot, layout.columnWidths, layout.rowHeights, w, h);
      return { ...win, ...b };
    }),
  };
}

// ── Default layout ──

function defaultLayout(): WindowLayout {
  const base: WindowLayout = {
    nextZIndex: 10,
    borderLocked: true,
    columnWidths: [0.22, 0.48, 0.30],
    rowHeights: [0.65, 0.35],
    windows: [
      { id: 'win-chat', title: 'Chat', type: 'chat', slot: 'left-top' as SlotId,
        x: 0, y: 0, width: 0, height: 0, minWidth: 200, minHeight: 150,
        zIndex: 4, minimized: false, maximized: false, visible: true, closable: false, sessionId: 'session-0' },
      { id: 'win-center', title: 'System', type: 'center', slot: 'center-top' as SlotId,
        x: 0, y: 0, width: 0, height: 0, minWidth: 200, minHeight: 150,
        zIndex: 3, minimized: false, maximized: false, visible: true, closable: false },
      { id: 'win-bottom', title: 'Activity', type: 'bottom', slot: 'center-bottom' as SlotId,
        x: 0, y: 0, width: 0, height: 0, minWidth: 200, minHeight: 100,
        zIndex: 2, minimized: false, maximized: false, visible: true, closable: false },
      { id: 'win-right', title: 'Context', type: 'right', slot: 'right-top' as SlotId,
        x: 0, y: 0, width: 0, height: 0, minWidth: 200, minHeight: 150,
        zIndex: 1, minimized: false, maximized: false, visible: true, closable: false },
    ],
  };
  return recomputeBounds(base);
}

// ── Reducer ──

function windowReducer(state: WindowLayout, action: WindowAction): WindowLayout {
  switch (action.type) {
    case 'SNAP': {
      // Move window to a slot. If slot is occupied, do nothing (use TAKEOVER instead).
      const occupant = state.windows.find(w => w.slot === action.slot && w.id !== action.id && !w.minimized);
      if (occupant) return state;
      const nz = state.nextZIndex + 1;
      const updated = {
        ...state, nextZIndex: nz,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, slot: action.slot, maximized: false, zIndex: nz } : w
        ),
      };
      return recomputeBounds(updated);
    }

    case 'TAKEOVER': {
      // Swap: move window to target slot, push occupant to the mover's old slot
      const mover = state.windows.find(w => w.id === action.id);
      if (!mover) return state;
      const occupant = state.windows.find(w => w.slot === action.slot && w.id !== action.id && !w.minimized);
      const nz = state.nextZIndex + 1;
      const updated = {
        ...state, nextZIndex: nz,
        windows: state.windows.map(w => {
          if (w.id === action.id) return { ...w, slot: action.slot, maximized: false, zIndex: nz };
          if (occupant && w.id === occupant.id) return { ...w, slot: mover.slot };
          return w;
        }),
      };
      return recomputeBounds(updated);
    }

    case 'RESIZE':
      return {
        ...state,
        windows: state.windows.map(w =>
          w.id === action.id
            ? {
                ...w,
                x: action.x,
                y: action.y,
                width: Math.max(action.width, w.minWidth),
                height: Math.max(action.height, w.minHeight),
                maximized: false,
              }
            : w
        ),
      };

    case 'MINIMIZE':
      return {
        ...state,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, minimized: true } : w
        ),
      };

    case 'RESTORE': {
      const nz = state.nextZIndex + 1;
      const updated = {
        ...state, nextZIndex: nz,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, minimized: false, zIndex: nz } : w
        ),
      };
      return recomputeBounds(updated);
    }

    case 'TOGGLE_MINIMIZE': {
      const win = state.windows.find(w => w.id === action.id);
      if (!win) return state;
      if (win.minimized) {
        const nz = state.nextZIndex + 1;
        const updated = {
          ...state, nextZIndex: nz,
          windows: state.windows.map(w =>
            w.id === action.id ? { ...w, minimized: false, zIndex: nz } : w
          ),
        };
        return recomputeBounds(updated);
      }
      return {
        ...state,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, minimized: true } : w
        ),
      };
    }

    case 'CLOSE':
      return {
        ...state,
        windows: state.windows.filter(w => w.id !== action.id || !w.closable),
      };

    case 'FOCUS': {
      const nz = state.nextZIndex + 1;
      return {
        ...state, nextZIndex: nz,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, zIndex: nz } : w
        ),
      };
    }

    case 'MAXIMIZE': {
      const nz = state.nextZIndex + 1;
      const updated = {
        ...state, nextZIndex: nz,
        windows: state.windows.map(w => {
          if (w.id !== action.id) return w;
          if (w.maximized) {
            return { ...w, maximized: false, zIndex: nz };
          }
          return {
            ...w, maximized: true, zIndex: nz,
            preMaxBounds: { slot: w.slot },
            x: 0, y: 0, width: vw(), height: vh(),
          };
        }),
      };
      return recomputeBounds(updated);
    }

    case 'ADD': {
      const nz = state.nextZIndex + 1;
      const newLayout = {
        ...state, nextZIndex: nz,
        windows: [...state.windows, { ...action.window, zIndex: nz }],
      };
      return recomputeBounds(newLayout);
    }

    case 'TOGGLE_BORDER_LOCK':
      return { ...state, borderLocked: !state.borderLocked };

    case 'RESIZE_COLUMNS': {
      const updated = { ...state, columnWidths: action.columnWidths };
      return recomputeBounds(updated);
    }

    case 'RESIZE_ROWS': {
      const updated = { ...state, rowHeights: action.rowHeights };
      return recomputeBounds(updated);
    }

    case 'RESET':
      return defaultLayout();

    default:
      return state;
  }
}

// ── Persistence ──

function loadLayout(): WindowLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WindowLayout;
      if (parsed.windows?.length > 0 && parsed.columnWidths) {
        return recomputeBounds(parsed);
      }
    }
  } catch { /* fall through */ }
  return defaultLayout();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveLayout(layout: WindowLayout) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* quota */ }
  }, 500);
}

// ── Context ──

interface WindowManagerValue {
  layout: WindowLayout;
  dispatch: (action: WindowAction) => void;
}

const WindowManagerContext = createContext<WindowManagerValue | null>(null);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [layout, dispatch] = useReducer(windowReducer, null, loadLayout);

  useEffect(() => { saveLayout(layout); }, [layout]);

  // Recompute on window resize
  useEffect(() => {
    const onResize = () => dispatch({ type: 'RESET' }); // simplest: reset to recalc
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <WindowManagerContext.Provider value={{ layout, dispatch }}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error('useWindowManager must be used within WindowManagerProvider');
  return ctx;
}

export function useWindow(id: string): WindowState | undefined {
  const { layout } = useWindowManager();
  return layout.windows.find(w => w.id === id);
}
