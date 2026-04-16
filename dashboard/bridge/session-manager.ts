import type { WebSocket } from "ws";
import { ClaudeSession } from "./claude-session.js";
import { PermissionManager } from "./permissions.js";
import type { ServerMessage } from "./types.js";

const MAX_CONCURRENT = 4;

interface SessionEntry {
  session: ClaudeSession;
  parentId: string | null;
  label: string;
  depth: number;
}

export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  createSession(sessionId: string): ClaudeSession {
    if (this.sessions.size >= MAX_CONCURRENT) {
      this.send({ type: "error", message: `Max ${MAX_CONCURRENT} concurrent sessions reached`, sessionId });
      // Return a dummy — caller should check
      const existing = this.sessions.values().next().value;
      if (existing) return existing.session;
    }

    const pm = new PermissionManager();
    const session = new ClaudeSession(this.ws, pm, sessionId);
    this.sessions.set(sessionId, {
      session,
      parentId: null,
      label: "Main",
      depth: 0,
    });
    return session;
  }

  forkSession(
    parentId: string,
    newId: string,
    forkLabel: string,
    forkMessageIndex: number,
  ): ClaudeSession | null {
    const parent = this.sessions.get(parentId);
    if (!parent) {
      this.send({ type: "error", message: `Parent session ${parentId} not found`, sessionId: newId });
      return null;
    }

    if (this.sessions.size >= MAX_CONCURRENT) {
      this.send({ type: "error", message: `Max ${MAX_CONCURRENT} concurrent sessions reached`, sessionId: newId });
      return null;
    }

    const pm = new PermissionManager();
    const session = new ClaudeSession(this.ws, pm, newId);

    // Inject parent conversation history as context
    const history = parent.session.getConversationLog();
    const truncated = history.slice(0, forkMessageIndex);
    if (truncated.length > 0) {
      session.setForkContext(truncated);
    }

    const depth = parent.depth + 1;
    this.sessions.set(newId, {
      session,
      parentId,
      label: forkLabel,
      depth,
    });

    return session;
  }

  getSession(id: string): ClaudeSession | undefined {
    return this.sessions.get(id)?.session;
  }

  getLineage(id: string): { parentId: string | null; label: string; depth: number } | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    return { parentId: entry.parentId, label: entry.label, depth: entry.depth };
  }

  getSiblings(sessionId: string): string[] {
    const entry = this.sessions.get(sessionId);
    if (!entry) return [];
    // Siblings = other sessions with same parent, or parent/children
    const result: string[] = [];
    for (const [id, e] of this.sessions) {
      if (id === sessionId) continue;
      if (e.parentId === entry.parentId || e.parentId === sessionId || entry.parentId === id) {
        result.push(id);
      }
    }
    return result;
  }

  closeSession(id: string): void {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.session.close();
      this.sessions.delete(id);
    }
  }

  closeAll(): void {
    for (const [id, entry] of this.sessions) {
      entry.session.close();
    }
    this.sessions.clear();
  }

  get size(): number {
    return this.sessions.size;
  }

  private send(msg: ServerMessage & { sessionId?: string }): void {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
