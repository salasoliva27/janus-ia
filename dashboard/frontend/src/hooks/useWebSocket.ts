import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "../types/bridge";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseWebSocketResult {
  status: ConnectionStatus;
  lastMessage: ServerMessage | null;
  send: (msg: ClientMessage) => void;
}

const MAX_BACKOFF = 10_000;
// Cap the outbox so a long disconnect can't grow it unbounded.
const MAX_OUTBOX = 50;

export function useWebSocket(): UseWebSocketResult {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const mountedRef = useRef(true);
  // Messages submitted while the socket is closed get queued here and
  // flushed on the next successful onopen, so a brief bridge restart
  // doesn't silently swallow user prompts.
  const outboxRef = useRef<ClientMessage[]>([]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");
      backoffRef.current = 1000;
      // Flush anything queued during the disconnect, in order.
      while (outboxRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = outboxRef.current.shift()!;
        try { ws.send(JSON.stringify(msg)); } catch { break; }
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        setLastMessage(parsed);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("disconnected");
      wsRef.current = null;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else if (outboxRef.current.length < MAX_OUTBOX) {
      // Queue for delivery once the socket reopens.
      outboxRef.current.push(msg);
    }
  }, []);

  return { status, lastMessage, send };
}
