import { ShellLayout } from "./components/ShellLayout";
import { useWebSocket, type ConnectionStatus } from "./hooks/useWebSocket";

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: "var(--color-success)",
    connecting: "oklch(0.75 0.15 85)",
    disconnected: "var(--color-danger)",
  };
  const labels: Record<ConnectionStatus, string> = {
    connected: "Connected",
    connecting: "Connecting...",
    disconnected: "Disconnected",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
        zIndex: 1000,
        fontFamily: "var(--font-family-mono)",
        fontSize: 11,
        color: "var(--color-text-muted)",
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: colors[status],
        }}
      />
      {labels[status]}
    </div>
  );
}

export default function App() {
  const { status } = useWebSocket();

  return (
    <>
      <StatusDot status={status} />
      <ShellLayout />
    </>
  );
}
