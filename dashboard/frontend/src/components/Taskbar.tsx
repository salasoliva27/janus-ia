import { useWindowManager } from '../store/window-store';

const TYPE_ICONS: Record<string, string> = {
  chat: '>',
  center: '*',
  bottom: '~',
  right: '=',
  calendar: '#',
};

export function Taskbar() {
  const { layout, dispatch } = useWindowManager();

  const minimized = layout.windows.filter(w => w.minimized);
  const visible = layout.windows.filter(w => !w.minimized);

  return (
    <div className="wm-taskbar">
      <div className="wm-taskbar__windows">
        {visible.map(w => (
          <button
            key={w.id}
            className="wm-taskbar__item wm-taskbar__item--active"
            onClick={() => dispatch({ type: 'FOCUS', id: w.id })}
            title={`${w.title} [${w.slot}]`}
          >
            <span className="wm-taskbar__icon">{TYPE_ICONS[w.type] || '?'}</span>
            <span className="wm-taskbar__label">{w.title}</span>
            {w.lineage && (
              <span className="wm-taskbar__depth" style={{ background: w.lineage.color }}>
                L{w.lineage.depth}
              </span>
            )}
          </button>
        ))}
        {minimized.map(w => (
          <button
            key={w.id}
            className="wm-taskbar__item wm-taskbar__item--minimized"
            onClick={() => dispatch({ type: 'RESTORE', id: w.id })}
            title={`Restore ${w.title}`}
          >
            <span className="wm-taskbar__icon">{TYPE_ICONS[w.type] || '?'}</span>
            <span className="wm-taskbar__label">{w.title}</span>
          </button>
        ))}
      </div>
      <div className="wm-taskbar__actions">
        <button
          className={`wm-taskbar__lock ${layout.borderLocked ? 'wm-taskbar__lock--active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_BORDER_LOCK' })}
          title={layout.borderLocked ? 'Unlock borders (add gaps)' : 'Lock borders (seamless tiling)'}
        >
          {layout.borderLocked ? 'Locked' : 'Unlocked'}
        </button>
        <button
          className="wm-taskbar__reset"
          onClick={() => dispatch({ type: 'RESET' })}
          title="Reset layout"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
