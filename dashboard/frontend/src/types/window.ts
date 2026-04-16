// Window Manager Types

export interface WindowLineage {
  depth: number;
  label: string;
  parentSessionId: string | null;
  breadcrumb: string[];
  color: string;
}

// 6-slot grid: 3 columns x 2 rows
export type SlotId = 'left-top' | 'left-bottom' | 'center-top' | 'center-bottom' | 'right-top' | 'right-bottom';

export const ALL_SLOTS: SlotId[] = ['left-top', 'left-bottom', 'center-top', 'center-bottom', 'right-top', 'right-bottom'];

export interface WindowState {
  id: string;
  title: string;
  type: 'chat' | 'center' | 'bottom' | 'right' | 'calendar';
  slot: SlotId;
  // Actual computed pixel bounds (derived from slot + column widths)
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
  preMaxBounds?: { slot: SlotId };
  // For chat windows
  sessionId?: string;
  lineage?: WindowLineage;
}

export interface WindowLayout {
  windows: WindowState[];
  nextZIndex: number;
  borderLocked: boolean;
  // Column widths as fractions (must sum to 1)
  columnWidths: [number, number, number];
  // Row heights as fractions (must sum to 1)
  rowHeights: [number, number];
}

export type WindowAction =
  | { type: 'SNAP'; id: string; slot: SlotId }
  | { type: 'TAKEOVER'; id: string; slot: SlotId }  // swap with occupant
  | { type: 'MINIMIZE'; id: string }
  | { type: 'RESTORE'; id: string }
  | { type: 'CLOSE'; id: string }
  | { type: 'FOCUS'; id: string }
  | { type: 'MAXIMIZE'; id: string }
  | { type: 'ADD'; window: WindowState }
  | { type: 'TOGGLE_MINIMIZE'; id: string }
  | { type: 'TOGGLE_BORDER_LOCK' }
  | { type: 'RESIZE_COLUMNS'; columnWidths: [number, number, number] }
  | { type: 'RESIZE_ROWS'; rowHeights: [number, number] }
  | { type: 'RESET' };

// Lineage depth -> oklch color
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

// Compute pixel bounds for a slot given column/row sizes and viewport
export function slotBounds(
  slot: SlotId,
  colWidths: [number, number, number],
  rowHeights: [number, number],
  vw: number,
  vh: number,
): { x: number; y: number; width: number; height: number } {
  const colPx = colWidths.map(f => Math.round(f * vw));
  const rowPx = rowHeights.map(f => Math.round(f * vh));

  const col = slot.startsWith('left') ? 0 : slot.startsWith('center') ? 1 : 2;
  const row = slot.endsWith('top') ? 0 : 1;

  const x = colPx.slice(0, col).reduce((a, b) => a + b, 0);
  const y = rowPx.slice(0, row).reduce((a, b) => a + b, 0);
  return { x, y, width: colPx[col], height: rowPx[row] };
}
