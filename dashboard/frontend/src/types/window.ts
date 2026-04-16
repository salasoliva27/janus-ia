// Window Manager Types

export interface WindowLineage {
  depth: number;
  label: string;
  parentSessionId: string | null;
  breadcrumb: string[];
  color: string;
}

export interface WindowState {
  id: string;
  title: string;
  type: 'chat' | 'center' | 'bottom' | 'right' | 'calendar';
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  visible: boolean;
  closable: boolean;
  // Saved position/size before maximize
  preMaxBounds?: { x: number; y: number; width: number; height: number };
  // For chat windows
  sessionId?: string;
  lineage?: WindowLineage;
}

export interface WindowLayout {
  windows: WindowState[];
  nextZIndex: number;
}

export type WindowAction =
  | { type: 'MOVE'; id: string; x: number; y: number }
  | { type: 'RESIZE'; id: string; width: number; height: number; x?: number; y?: number }
  | { type: 'MINIMIZE'; id: string }
  | { type: 'RESTORE'; id: string }
  | { type: 'CLOSE'; id: string }
  | { type: 'FOCUS'; id: string }
  | { type: 'MAXIMIZE'; id: string }
  | { type: 'ADD'; window: WindowState }
  | { type: 'TOGGLE_MINIMIZE'; id: string }
  | { type: 'RESET' };

// Lineage depth → oklch color
export const LINEAGE_COLORS = [
  'oklch(0.78 0.16 180)', // 0: cyan
  'oklch(0.72 0.18 280)', // 1: purple
  'oklch(0.72 0.18 145)', // 2: green
  'oklch(0.68 0.15 50)',  // 3: amber
  'oklch(0.65 0.25 25)',  // 4+: red
];

export function lineageColor(depth: number): string {
  return LINEAGE_COLORS[Math.min(depth, LINEAGE_COLORS.length - 1)];
}
