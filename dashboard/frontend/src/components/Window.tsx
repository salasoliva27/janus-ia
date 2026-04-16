import { useCallback, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { useWindowManager } from '../store/window-store';
import type { WindowState } from '../types/window';

interface WindowProps {
  state: WindowState;
  children: ReactNode;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function Window({ state, children }: WindowProps) {
  const { dispatch } = useWindowManager();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ dir: ResizeDir; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  const rafRef = useRef<number>(0);

  // ── Focus on click ──
  const onFocus = useCallback(() => {
    dispatch({ type: 'FOCUS', id: state.id });
  }, [dispatch, state.id]);

  // ── Drag ──
  const onDragStart = useCallback((e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('.wm-window__controls')) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: state.x, origY: state.y };
    dispatch({ type: 'FOCUS', id: state.id });

    const onMove = (me: globalThis.PointerEvent) => {
      if (!dragRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = me.clientX - dragRef.current!.startX;
        const dy = me.clientY - dragRef.current!.startY;
        dispatch({ type: 'MOVE', id: state.id, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy });
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, state.id, state.x, state.y]);

  // ── Resize ──
  const onResizeStart = useCallback((dir: ResizeDir) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      dir, startX: e.clientX, startY: e.clientY,
      origX: state.x, origY: state.y, origW: state.width, origH: state.height,
    };
    dispatch({ type: 'FOCUS', id: state.id });

    const onMove = (me: globalThis.PointerEvent) => {
      if (!resizeRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const r = resizeRef.current!;
        const dx = me.clientX - r.startX;
        const dy = me.clientY - r.startY;

        let newX = r.origX, newY = r.origY, newW = r.origW, newH = r.origH;

        if (r.dir.includes('e')) newW = r.origW + dx;
        if (r.dir.includes('w')) { newW = r.origW - dx; newX = r.origX + dx; }
        if (r.dir.includes('s')) newH = r.origH + dy;
        if (r.dir.includes('n')) { newH = r.origH - dy; newY = r.origY + dy; }

        // Clamp min sizes
        if (newW < state.minWidth) { newW = state.minWidth; if (r.dir.includes('w')) newX = r.origX + r.origW - state.minWidth; }
        if (newH < state.minHeight) { newH = state.minHeight; if (r.dir.includes('n')) newY = r.origY + r.origH - state.minHeight; }

        dispatch({ type: 'RESIZE', id: state.id, width: newW, height: newH, x: newX, y: newY });
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dispatch, state]);

  if (state.minimized) return null;

  const lineageLabel = state.lineage
    ? `L${state.lineage.depth} · ${state.lineage.breadcrumb.join(' > ')}`
    : null;

  return (
    <div
      className={`wm-window ${state.maximized ? 'wm-window--maximized' : ''}`}
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
        <div className="wm-window__controls">
          <button
            className="wm-window__btn wm-window__btn--min"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MINIMIZE', id: state.id }); }}
            title="Minimize"
          />
          <button
            className="wm-window__btn wm-window__btn--max"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MAXIMIZE', id: state.id }); }}
            title="Maximize"
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

      {/* Resize handles (8 directions) */}
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
    </div>
  );
}
