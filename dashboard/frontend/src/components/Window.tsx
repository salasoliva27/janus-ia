import { useCallback, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { useWindowManager } from '../store/window-store';
import type { WindowState, SlotId } from '../types/window';
import { ALL_SLOTS, slotBounds, findSnapEdges, snapValue } from '../types/window';

interface WindowProps {
  state: WindowState;
  children: ReactNode;
}

type ResizeDir = 'e' | 'w' | 'n' | 's' | 'ne' | 'nw' | 'se' | 'sw';

function detectSlot(
  clientX: number, clientY: number,
  colWidths: [number, number, number], rowHeights: [number, number],
  viewW: number, viewH: number,
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
  const snapState = useRef<{ left: boolean; right: boolean; top: boolean; bottom: boolean }>({
    left: false, right: false, top: false, bottom: false,
  });
  const rafRef = useRef(0);

  const topbarH = 40;

  const onFocus = useCallback(() => {
    dispatch({ type: 'FOCUS', id: state.id });
  }, [dispatch, state.id]);

  // ── Drag to snap (slot-based) ──
  const onDragStart = useCallback((e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('.wm-window__controls')) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    dispatch({ type: 'FOCUS', id: state.id });

    const hl = document.createElement('div');
    hl.className = 'wm-drop-highlight';
    hl.style.display = 'none';
    document.body.appendChild(hl);
    highlightRef.current = hl;

    const viewW = window.innerWidth;
    const viewH = window.innerHeight - topbarH - 34;

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
      if (highlightRef.current) { highlightRef.current.remove(); highlightRef.current = null; }

      const relX = ue.clientX;
      const relY = ue.clientY - topbarH;
      const targetSlot = detectSlot(relX, relY, layout.columnWidths, layout.rowHeights, viewW, viewH);

      if (targetSlot && targetSlot !== state.slot) {
        const occupant = layout.windows.find(w => w.slot === targetSlot && w.id !== state.id && !w.minimized);
        dispatch(occupant
          ? { type: 'TAKEOVER', id: state.id, slot: targetSlot }
          : { type: 'SNAP', id: state.id, slot: targetSlot }
        );
      }
      dragRef.current = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, state.id, state.slot, layout]);

  // ── Resize with magnetic snap ──
  const onResizeStart = useCallback((dir: ResizeDir) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: 'FOCUS', id: state.id });

    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: state.x, y: state.y, w: state.width, h: state.height };
    const snap = { ...snapState.current };

    const onMove = (me: globalThis.PointerEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        let newX = orig.x, newY = orig.y, newW = orig.w, newH = orig.h;

        if (dir.includes('e')) newW = orig.w + dx;
        if (dir.includes('w')) { newW = orig.w - dx; newX = orig.x + dx; }
        if (dir.includes('s')) newH = orig.h + dy;
        if (dir.includes('n')) { newH = orig.h - dy; newY = orig.y + dy; }

        // Clamp min
        if (newW < state.minWidth) { newW = state.minWidth; if (dir.includes('w')) newX = orig.x + orig.w - state.minWidth; }
        if (newH < state.minHeight) { newH = state.minHeight; if (dir.includes('n')) newY = orig.y + orig.h - state.minHeight; }

        // Magnetic snap
        const edges = findSnapEdges(layout.windows, state.id);

        // Snap right edge
        if (dir.includes('e')) {
          const rightEdge = newX + newW;
          // Snap to other windows' left edges and right edges
          const targets = [...edges.lefts, ...edges.rights];
          const res = snapValue(rightEdge, targets, snap.right);
          if (res.isSnapped) { newW = res.snapped - newX; }
          snap.right = res.isSnapped;
        }

        // Snap left edge
        if (dir.includes('w')) {
          const targets = [...edges.lefts, ...edges.rights];
          const res = snapValue(newX, targets, snap.left);
          if (res.isSnapped) { newW = newW + (newX - res.snapped); newX = res.snapped; }
          snap.left = res.isSnapped;
        }

        // Snap bottom edge
        if (dir.includes('s')) {
          const bottomEdge = newY + newH;
          const targets = [...edges.tops, ...edges.bottoms];
          const res = snapValue(bottomEdge, targets, snap.bottom);
          if (res.isSnapped) { newH = res.snapped - newY; }
          snap.bottom = res.isSnapped;
        }

        // Snap top edge
        if (dir.includes('n')) {
          const targets = [...edges.tops, ...edges.bottoms];
          const res = snapValue(newY, targets, snap.top);
          if (res.isSnapped) { newH = newH + (newY - res.snapped); newY = res.snapped; }
          snap.top = res.isSnapped;
        }

        // Also snap to viewport edges (0 and max)
        const vw = window.innerWidth;
        const vh = window.innerHeight - topbarH - 34;
        const vpEdgesH = [0, vw];
        const vpEdgesV = [0, vh];

        if (dir.includes('e')) {
          const res = snapValue(newX + newW, vpEdgesH, false);
          if (res.isSnapped) newW = res.snapped - newX;
        }
        if (dir.includes('w')) {
          const res = snapValue(newX, vpEdgesH, false);
          if (res.isSnapped) { newW += newX - res.snapped; newX = res.snapped; }
        }
        if (dir.includes('s')) {
          const res = snapValue(newY + newH, vpEdgesV, false);
          if (res.isSnapped) newH = res.snapped - newY;
        }
        if (dir.includes('n')) {
          const res = snapValue(newY, vpEdgesV, false);
          if (res.isSnapped) { newH += newY - res.snapped; newY = res.snapped; }
        }

        snapState.current = snap;
        dispatch({ type: 'RESIZE', id: state.id, x: newX, y: newY, width: newW, height: newH });
      });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      snapState.current = { left: false, right: false, top: false, bottom: false };
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, state, layout.windows]);

  // ── Column resize (between grid columns) ──
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

  // ── Row resize (between grid rows) ──
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

      {/* Individual resize handles (8 directions) — free resize with magnetic snap */}
      {!state.maximized && (
        <>
          <div className="wm-resize wm-resize--n" onPointerDown={onResizeStart('n')} />
          <div className="wm-resize wm-resize--s" onPointerDown={onResizeStart('s')} />
          <div className="wm-resize wm-resize--e" onPointerDown={onResizeStart('e')} />
          <div className="wm-resize wm-resize--w" onPointerDown={onResizeStart('w')} />
          <div className="wm-resize wm-resize--ne" onPointerDown={onResizeStart('ne')} />
          <div className="wm-resize wm-resize--nw" onPointerDown={onResizeStart('nw')} />
          <div className="wm-resize wm-resize--se" onPointerDown={onResizeStart('se')} />
          <div className="wm-resize wm-resize--sw" onPointerDown={onResizeStart('sw')} />
        </>
      )}

      {/* Grid column divider (on right edge of col 0 and 1) */}
      {!state.maximized && col < 2 && (
        <div className="wm-resize wm-resize--col-divider" onPointerDown={onColumnResize(col as 0 | 1)} />
      )}

      {/* Grid row divider (on bottom edge of top-row windows) */}
      {!state.maximized && isTopRow && (
        <div className="wm-resize wm-resize--row-divider" onPointerDown={onRowResize} />
      )}
    </div>
  );
}
