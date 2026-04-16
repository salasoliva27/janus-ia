import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { WindowState, WindowLayout, WindowAction } from '../types/window';

const STORAGE_KEY = 'venture-os-window-layout';
const TOPBAR_HEIGHT = 40;
const TASKBAR_HEIGHT = 34;

// ── Default layout factory ──

function defaultLayout(): WindowLayout {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const h = typeof window !== 'undefined' ? window.innerHeight - TOPBAR_HEIGHT - TASKBAR_HEIGHT : 900;

  const chatW = Math.round(w * 0.22);
  const centerW = Math.round(w * 0.48);
  const rightW = w - chatW - centerW;
  const centerTopH = Math.round(h * 0.65);
  const centerBotH = h - centerTopH;

  return {
    nextZIndex: 10,
    windows: [
      {
        id: 'win-chat',
        title: 'Chat',
        type: 'chat',
        x: 0, y: 0,
        width: chatW, height: h,
        minWidth: 260, minHeight: 200,
        zIndex: 4, minimized: false, maximized: false, visible: true, closable: false,
        sessionId: 'session-0',
      },
      {
        id: 'win-center',
        title: 'System',
        type: 'center',
        x: chatW, y: 0,
        width: centerW, height: centerTopH,
        minWidth: 300, minHeight: 200,
        zIndex: 3, minimized: false, maximized: false, visible: true, closable: false,
      },
      {
        id: 'win-bottom',
        title: 'Activity',
        type: 'bottom',
        x: chatW, y: centerTopH,
        width: centerW, height: centerBotH,
        minWidth: 300, minHeight: 120,
        zIndex: 2, minimized: false, maximized: false, visible: true, closable: false,
      },
      {
        id: 'win-right',
        title: 'Context',
        type: 'right',
        x: chatW + centerW, y: 0,
        width: rightW, height: h,
        minWidth: 240, minHeight: 200,
        zIndex: 1, minimized: false, maximized: false, visible: true, closable: false,
      },
    ],
  };
}

// ── Reducer ──

function windowReducer(state: WindowLayout, action: WindowAction): WindowLayout {
  switch (action.type) {
    case 'MOVE':
      return {
        ...state,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, x: action.x, y: action.y } : w
        ),
      };

    case 'RESIZE':
      return {
        ...state,
        windows: state.windows.map(w =>
          w.id === action.id
            ? {
                ...w,
                width: Math.max(action.width, w.minWidth),
                height: Math.max(action.height, w.minHeight),
                ...(action.x !== undefined ? { x: action.x } : {}),
                ...(action.y !== undefined ? { y: action.y } : {}),
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
      return {
        ...state,
        nextZIndex: nz,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, minimized: false, zIndex: nz } : w
        ),
      };
    }

    case 'TOGGLE_MINIMIZE': {
      const win = state.windows.find(w => w.id === action.id);
      if (!win) return state;
      if (win.minimized) {
        const nz = state.nextZIndex + 1;
        return {
          ...state, nextZIndex: nz,
          windows: state.windows.map(w =>
            w.id === action.id ? { ...w, minimized: false, zIndex: nz } : w
          ),
        };
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
        ...state,
        nextZIndex: nz,
        windows: state.windows.map(w =>
          w.id === action.id ? { ...w, zIndex: nz } : w
        ),
      };
    }

    case 'MAXIMIZE': {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const vh = typeof window !== 'undefined' ? window.innerHeight - TOPBAR_HEIGHT - TASKBAR_HEIGHT : 900;
      const nz = state.nextZIndex + 1;
      return {
        ...state,
        nextZIndex: nz,
        windows: state.windows.map(w => {
          if (w.id !== action.id) return w;
          if (w.maximized) {
            // Restore from maximize
            return {
              ...w,
              maximized: false,
              zIndex: nz,
              x: w.preMaxBounds?.x ?? w.x,
              y: w.preMaxBounds?.y ?? w.y,
              width: w.preMaxBounds?.width ?? w.width,
              height: w.preMaxBounds?.height ?? w.height,
              preMaxBounds: undefined,
            };
          }
          return {
            ...w,
            maximized: true,
            zIndex: nz,
            preMaxBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
            x: 0, y: 0, width: vw, height: vh,
          };
        }),
      };
    }

    case 'ADD':
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        windows: [...state.windows, { ...action.window, zIndex: state.nextZIndex + 1 }],
      };

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
      if (parsed.windows?.length > 0) return parsed;
    }
  } catch { /* fall through */ }
  return defaultLayout();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveLayout(layout: WindowLayout) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch { /* quota */ }
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

  // Persist on every change
  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

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
