import { useEffect, useState } from 'react';
import { WindowShell } from './components/WindowShell';
import { WindowManagerProvider } from './store/window-store';
import { TopBar } from './components/TopBar';
import { CommandPalette } from './components/CommandPalette';
import { PortfolioScoreboard } from './components/PortfolioScoreboard';
import { CrossProjectFlash } from './components/CrossProjectFlash';
import { ThemeEngine, useThemeInit } from './components/ThemeEngine';
import { KeyVault, KeyVaultButton } from './components/KeyVault';
import { LearningToast } from './components/LearningToast';
import { DashboardProvider, useBridgeHandler, useRegisterWsSend } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import type { ServerMessage } from './types/bridge';

function ReloadBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let initialHash = '';
    const check = async () => {
      try {
        const res = await fetch('/index.html', { cache: 'no-store' });
        const text = await res.text();
        // Extract asset filenames as a fingerprint
        const hash = (text.match(/assets\/index-[^"]+/g) || []).join(',');
        if (!initialHash) { initialHash = hash; return; }
        if (hash && hash !== initialHash) setStale(true);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 8000);
    return () => clearInterval(interval);
  }, []);

  if (!stale) return null;
  return (
    <div className="reload-banner" onClick={() => window.location.reload()}>
      UI updated — click to reload
    </div>
  );
}

function DashboardInner() {
  const { status, lastMessage, send } = useWebSocket();
  const handleBridgeMessage = useBridgeHandler();
  const registerWsSend = useRegisterWsSend();
  const [themeOpen, setThemeOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);

  useThemeInit();

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

  // Theme shortcut: Ctrl+T
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        setThemeOpen(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell-outer">
      <TopBar connectionStatus={status} onThemeToggle={() => setThemeOpen(true)} lastMessage={lastMessage} />
      <div className="shell-panels">
        <WindowManagerProvider>
          <WindowShell />
        </WindowManagerProvider>
      </div>
      <CommandPalette />
      <PortfolioScoreboard />
      <CrossProjectFlash />
      {themeOpen && <ThemeEngine onClose={() => setThemeOpen(false)} />}
      {vaultOpen && <KeyVault onClose={() => setVaultOpen(false)} />}
      <KeyVaultButton onClick={() => setVaultOpen(true)} />
      <LearningToast />
      <ReloadBanner />
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
