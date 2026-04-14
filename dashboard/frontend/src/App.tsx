import { useEffect } from 'react';
import { ShellLayout } from './components/ShellLayout';
import { TopBar } from './components/TopBar';
import { CommandPalette } from './components/CommandPalette';
import { PortfolioScoreboard } from './components/PortfolioScoreboard';
import { CrossProjectFlash } from './components/CrossProjectFlash';
import { DashboardProvider, useBridgeHandler, useRegisterWsSend } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import type { ServerMessage } from './types/bridge';

function DashboardInner() {
  const { status, lastMessage, send } = useWebSocket();
  const handleBridgeMessage = useBridgeHandler();
  const registerWsSend = useRegisterWsSend();

  // Route real WebSocket messages to the store
  useEffect(() => {
    if (lastMessage) {
      handleBridgeMessage(lastMessage as ServerMessage);
    }
  }, [lastMessage, handleBridgeMessage]);

  // Register WebSocket send function with store when connected
  useEffect(() => {
    if (status === 'connected') {
      registerWsSend(send);
    }
  }, [status, send, registerWsSend]);

  return (
    <div className="shell-outer">
      <TopBar connectionStatus={status} />
      <div className="shell-panels">
        <ShellLayout />
      </div>
      <CommandPalette />
      <PortfolioScoreboard />
      <CrossProjectFlash />
    </div>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <DashboardInner />
    </DashboardProvider>
  );
}
