import { useRef, useEffect, useState } from 'react';
import { useDashboard } from '../store';

export function ChatPanel() {
  const { chatMessages, agents, sendChatMessage } = useDashboard();
  const [input, setInput] = useState('');
  const [showAgents, setShowAgents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendChatMessage(input);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const recentAgents = agents.slice(0, 6);

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        <span>Venture OS</span>
        <button
          style={{
            background: 'none', border: 'none', color: 'var(--color-text-muted)',
            fontSize: 10, fontFamily: 'var(--font-family-mono)', cursor: 'pointer',
          }}
          onClick={() => setShowAgents(!showAgents)}
        >
          {showAgents ? 'hide agents' : 'show agents'}
        </button>
      </div>

      {/* Messages */}
      <div className="chat-panel__messages">
        {chatMessages.map(msg => (
          <div key={msg.id} className={`chat-panel__msg chat-panel__msg--${msg.role}`}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Agent Stream */}
      {showAgents && recentAgents.length > 0 && (
        <div className="chat-panel__agents">
          {recentAgents.map(agent => (
            <div key={agent.id} className="chat-panel__agent-card">
              <span className="chat-panel__agent-icon">{agent.icon}</span>
              <div className="chat-panel__agent-info">
                <div className="chat-panel__agent-name">
                  {agent.agent}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>
                    {agent.project}
                  </span>
                </div>
                <div className="chat-panel__agent-msg">{agent.message}</div>
              </div>
              <span className={`chat-panel__agent-status chat-panel__agent-status--${agent.status}`}>
                {agent.phase}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form className="chat-panel__input-area" onSubmit={handleSubmit}>
        <textarea
          className="chat-panel__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (add skill, paste key, build project)"
          rows={2}
        />
      </form>
    </div>
  );
}
