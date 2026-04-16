import { useCallback, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { useWindowManager } from '../store/window-store';
import type { WindowState, SlotId } from '../types/window';
import { ALL_SLOTS, slotBounds } from '../types/window';

interface WindowProps {
  state: WindowState;
  children: ReactNode;
}

// Detect which slot a screen position falls into
function detectSlot(
  clientX: number,
  clientY: number,
  colWidths: [number, number, number],
  rowHeights: [number, number],
  viewW: number,
  viewH: number,
): SlotId | null {
  for (const slot of ALL_SLOTS) {
    const b = slotBounds(slot, colWidths, rowHeights, viewW, viewH);
    if (clientX >= b.x && clientX < b.x + b.width && clientY >= b.y && clientY < b.y + b.height) {
      return slot;
    }
  }
  return null;
}

export function Window({ state, children }: WindowProps) {
  const { layout, dispatch } = useWindowManager();
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const topbarH = 40;

  const onFocus = useCallback(() => {
    dispatch({ type: 'FOCUS', id: state.id });
  }, [dispatch, state.id]);

  // ── Drag to snap ──
  const onDragStart = useCallback((e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('.wm-window__controls')) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    dispatch({ type: 'FOCUS', id: state.id });

    // Create highlight overlay
    const hl = document.createElement('div');
    hl.className = 'wm-drop-highlight';
    hl.style.display = 'none';
    document.body.appendChild(hl);
    highlightRef.current = hl;

    const viewW = window.innerWidth;
    const viewH = window.innerHeight - topbarH - 34; // taskbar

    const onMove = (me: globalThis.PointerEvent) => {
      const relX = me.clientX;
      const relY = me.clientY - topbarH;
      const targetSlot = detectSlot(relX, relY, layout.columnWidths, layout.rowHeights, viewW, viewH);

      if (targetSlot && highlightRef.current) {
        const b = slotBounds(targetSlot, layout.columnWidths, layout.rowHeights, viewW, viewH);
        const hl = highlightRef.current;
        hl.style.display = 'block';
        hl.style.left = `${b.x}px`;
        hl.style.top = `${b.y + topbarH}px`;
        hl.style.width = `${b.width}px`;
        hl.style.height = `${b.height}px`;
      } else if (highlightRef.current) {
        highlightRef.current.style.display = 'none';
      }
    };

    const onUp = (ue: globalThis.PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (highlightRef.current) {
        highlightRef.current.remove();
        highlightRef.current = null;
      }

      const relX = ue.clientX;
      const relY = ue.clientY - topbarH;
      const targetSlot = detectSlot(relX, relY, layout.columnWidths, layout.rowHeights, viewW, viewH);

      if (targetSlot && targetSlot !== state.slot) {
        // Check if occupied
        const occupant = layout.windows.find(w => w.slot === targetSlot && w.id !== state.id && !w.minimized);
        if (occupant) {
          dispatch({ type: 'TAKEOVER', id: state.id, slot: targetSlot });
        } else {
          dispatch({ type: 'SNAP', id: state.id, slot: targetSlot });
        }
      }

      dragRef.current = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, state.id, state.slot, layout]);

  // ── Column resize (drag between columns) ──
  const onColumnResize = useCallback((colIndex: 0 | 1) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidths = [...layout.columnWidths] as [number, number, number];
    const viewW = window.innerWidth;

    const onMove = (me: globalThis.PointerEvent) => {
      const dx = (me.clientX - startX) / viewW;
      const newWidths = [...startWidths] as [number, number, number];
      newWidths[colIndex] = Math.max(0.12, startWidths[colIndex] + dx);
      newWidths[colIndex + 1] = Math.max(0.12, startWidths[colIndex + 1] - dx);
      dispatch({ type: 'RESIZE_COLUMNS', columnWidths: newWidths });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, layout.columnWidths]);

  // ── Row resize (drag between rows within same column) ──
  const onRowResize = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeights = [...layout.rowHeights] as [number, number];
    const viewH = window.innerHeight - topbarH - 34;

    const onMove = (me: globalThis.PointerEvent) => {
      const dy = (me.clientY - startY) / viewH;
      const newHeights = [...startHeights] as [number, number];
      newHeights[0] = Math.max(0.15, startHeights[0] + dy);
      newHeights[1] = Math.max(0.15, startHeights[1] - dy);
      dispatch({ type: 'RESIZE_ROWS', rowHeights: newHeights });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, layout.rowHeights]);

  if (state.minimized) return null;

  const lineageLabel = state.lineage
    ? `L${state.lineage.depth} · ${state.lineage.breadcrumb.join(' > ')}`
    : null;

  const isLocked = layout.borderLocked;
  const isTopRow = state.slot.endsWith('top');
  const isBottomRow = state.slot.endsWith('bottom');
  const col = state.slot.startsWith('left') ? 0 : state.slot.startsWith('center') ? 1 : 2;

  return (
    <div
      className={`wm-window ${state.maximized ? 'wm-window--maximized' : ''} ${isLocked ? 'wm-window--locked' : ''}`}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.zIndex,
      }}
      onPointerDown={onFocus}
    >
      {/* Title bar */}
      <div className="wm-window__titlebar" onPointerDown={onDragStart} onDoubleClick={() => dispatch({ type: 'MAXIMIZE', id: state.id })}>
        {lineageLabel && (
          <span className="wm-window__lineage" style={{ color: state.lineage?.color }}>
            {lineageLabel}
          </span>
        )}
        <span className="wm-window__title">{state.title}</span>
        <span className="wm-window__slot-badge">{state.slot}</span>
        <div className="wm-window__controls">
          <button
            className="wm-window__btn wm-window__btn--min"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MINIMIZE', id: state.id }); }}
            title="Minimize"
          />
          <button
            className="wm-window__btn wm-window__btn--max"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MAXIMIZE', id: state.id }); }}
            title={state.maximized ? 'Restore' : 'Maximize'}
          />
          {state.closable && (
            <button
              className="wm-window__btn wm-window__btn--close"
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CLOSE', id: state.id }); }}
              title="Close"
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="wm-window__content">
        {children}
      </div>

      {/* Column resize handles (only on right edge of col 0 and col 1) */}
      {!state.maximized && col < 2 && (
        <div
          className="wm-resize wm-resize--col"
          onPointerDown={onColumnResize(col as 0 | 1)}
        />
      )}

      {/* Row resize handle (only on bottom edge of top-row windows) */}
      {!state.maximized && isTopRow && (
        <div
          className="wm-resize wm-resize--row"
          onPointerDown={onRowResize}
        />
      )}
    </div>
  );
}
