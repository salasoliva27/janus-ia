import { useDashboard } from '../store';

const STATUS_STYLES: Record<string, { border: string; opacity: number; hint: string }> = {
  ready: { border: 'transparent', opacity: 1, hint: 'Configured' },
  'needs-key': { border: 'oklch(0.75 0.20 85)', opacity: 0.6, hint: 'Needs API key — click to configure' },
  'needs-auth': { border: 'oklch(0.70 0.18 280)', opacity: 0.6, hint: 'Needs OAuth — click to authenticate' },
  unknown: { border: 'var(--border-color)', opacity: 0.4, hint: 'Status unknown' },
};

export function ToolPulseBar() {
  const { tools, sendChatMessage } = useDashboard();

  function handleToolClick(tool: typeof tools[0]) {
    if (tool.configured === 'needs-key' && tool.envVar) {
      sendChatMessage(`I need to configure ${tool.name}. What do I paste for ${tool.envVar}?`);
    } else if (tool.configured === 'needs-auth') {
      sendChatMessage(`I need to authenticate ${tool.name}. How do I set it up?`);
    }
  }

  return (
    <div className="tool-pulse-bar">
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-family-mono)',
        color: 'var(--color-text-muted)', marginRight: 4, flexShrink: 0,
      }}>
        MCP
      </span>
      {tools.map(tool => {
        const status = STATUS_STYLES[tool.configured] || STATUS_STYLES.unknown;
        const needsSetup = tool.configured === 'needs-key' || tool.configured === 'needs-auth';
        return (
          <div
            key={tool.id}
            className={`tool-pulse-bar__item ${tool.active ? 'tool-pulse-bar__item--active' : ''}`}
            title={`${tool.name} — ${tool.callCount} calls\n${status.hint}${tool.envVar ? `\nEnv: ${tool.envVar}` : ''}`}
            style={{
              opacity: status.opacity,
              borderBottom: needsSetup ? `2px solid ${status.border}` : undefined,
              cursor: needsSetup ? 'pointer' : 'default',
            }}
            onClick={needsSetup ? () => handleToolClick(tool) : undefined}
          >
            {tool.shortName}
            {tool.callCount > 0 && (
              <span className="tool-pulse-bar__count">{tool.callCount}</span>
            )}
            {needsSetup && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 5, height: 5, borderRadius: '50%',
                background: status.border,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
