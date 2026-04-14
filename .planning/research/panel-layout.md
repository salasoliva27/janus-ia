# Research: Resizable Panel Layouts and Embedded Preview Panes

**Researched:** 2026-04-13
**Confidence:** HIGH (core library), MEDIUM (iframe patterns), MEDIUM (port detection)

---

## 1. Resizable Panel Libraries — Comparison

### Recommendation: `react-resizable-panels` (via shadcn Resizable wrapper)

| Criterion | react-resizable-panels | allotment | react-split-pane |
|---|---|---|---|
| **Maintainer** | bvaughn (React core team) | johnwalley | tomkp |
| **Latest version** | v4.10.0 (April 2026) | ~0.10.x | ~0.1.92 |
| **Active maintenance** | YES, actively maintained | YES but slower | ABANDONED — last publish 2020 |
| **npm weekly downloads** | ~2.4M+ (highest) | ~162K | ~313K (legacy inertia) |
| **Keyboard accessible** | YES (arrow keys resize) | YES | NO |
| **Collapsible panels** | YES (built-in) | YES | NO |
| **Nested layouts** | YES | YES | Fragile |
| **SSR support** | YES | YES | NO |
| **Layout persistence** | Built-in `autoSaveId` prop | Manual | Manual |
| **Conditional panels** | YES | YES (this is allotment's differentiator) | NO |
| **CSS-in-JS dependency** | NONE (plain CSS) | NONE | NONE |
| **TypeScript** | YES | YES | Partial |
| **shadcn wrapper** | YES (`Resizable`) | NO | NO |
| **Min/max constraints** | YES (`minSize`, `maxSize`) | YES (`minSize`, `maxSize`) | `minSize` only |

**Verdict:** Use `react-resizable-panels`. It is the clear winner:
- Most actively maintained (by a React core team member)
- Highest adoption
- Built-in layout persistence (`autoSaveId`)
- shadcn provides a drop-in wrapper
- Collapsible panels are first-class (needed for toggling panels)

**Do NOT use react-split-pane** — it is abandoned. Allotment is decent but lower adoption and no shadcn integration.

### API Pattern (shadcn v4)

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"

<ResizablePanelGroup orientation="horizontal" autoSaveId="main-layout">
  {/* Chat panel — collapsible */}
  <ResizablePanel defaultSize="25%" minSize="15%" collapsible collapsedSize="0%">
    <ChatPanel />
  </ResizablePanel>
  <ResizableHandle withHandle />

  {/* System graph — always visible */}
  <ResizablePanel defaultSize="40%" minSize="20%">
    <SystemGraph />
  </ResizablePanel>
  <ResizableHandle withHandle />

  {/* Workspace / iframe preview — collapsible */}
  <ResizablePanel defaultSize="35%" minSize="20%" collapsible collapsedSize="0%">
    <PreviewPane />
  </ResizablePanel>
</ResizablePanelGroup>
```

### Layout Persistence — Built-in

`autoSaveId="main-layout"` automatically saves panel sizes to localStorage and restores on reload. No custom code needed. This is a killer feature unique to react-resizable-panels.

For more control:
```tsx
const [layout, setLayout] = useState(() => {
  const saved = localStorage.getItem("panel-layout");
  return saved ? JSON.parse(saved) : [25, 40, 35];
});

<ResizablePanelGroup onLayout={(sizes) => {
  localStorage.setItem("panel-layout", JSON.stringify(sizes));
}}>
```

---

## 2. Iframe Embedding Patterns

### Parent-to-Iframe Communication

```tsx
const iframeRef = useRef<HTMLIFrameElement>(null);

// Send message to iframe
const sendToPreview = (data: any) => {
  iframeRef.current?.contentWindow?.postMessage(
    { type: "AGENT_OS_CMD", ...data },
    "http://localhost:5174" // ALWAYS specify origin, never "*"
  );
};

// Listen for messages from iframe
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.origin !== "http://localhost:5174") return; // security gate
    if (event.data?.type === "APP_STATE_UPDATE") {
      // handle state from child app
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}, []);
```

### Iframe-to-Parent (from the embedded app)

```tsx
// In the child app (e.g., espacio-bosques running on :5174)
window.parent.postMessage(
  { type: "APP_STATE_UPDATE", route: window.location.pathname },
  "http://localhost:3000" // parent origin
);
```

### Key Gotchas

1. **Same-origin policy**: localhost:3000 and localhost:5174 are DIFFERENT origins. postMessage works across origins but you must check `event.origin`.
2. **CORS for fetch**: If parent needs to fetch from iframe's server, the child server needs CORS headers allowing the parent origin.
3. **iframe sandbox attribute**: Do NOT use `sandbox` if you need the child app to function normally. If you must, use `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`.
4. **HMR websocket**: Vite's HMR websocket connection works inside iframes since it connects back to its own origin. No special config needed.
5. **CSS isolation**: iframe provides complete CSS isolation — this is an advantage over rendering components directly.

### Auto-Refresh Pattern

```tsx
// Watch for file changes via WebSocket or polling, then:
const refreshPreview = () => {
  if (iframeRef.current) {
    iframeRef.current.src = iframeRef.current.src; // force reload
  }
};

// Better: let Vite HMR handle it naturally inside the iframe.
// Only force reload when the dev server itself restarts.
```

### Detecting iframe Load State

```tsx
<iframe
  ref={iframeRef}
  src={previewUrl}
  onLoad={() => setLoaded(true)}
  onError={() => setError(true)}
  style={{ border: "none", width: "100%", height: "100%" }}
/>
```

---

## 3. Port Auto-Detection

### Strategy: Probe Known Ports via Fetch

Browser-based port scanning is possible but limited. Best approach for a dev tool:

```tsx
const DEV_PORTS = [3000, 3001, 4173, 5173, 5174, 8080, 8000];

async function detectActivePorts(): Promise<number[]> {
  const results = await Promise.allSettled(
    DEV_PORTS.map(async (port) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      try {
        await fetch(`http://localhost:${port}`, {
          mode: "no-cors", // we just want to know if something responds
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return port;
      } catch {
        clearTimeout(timeout);
        throw new Error("unreachable");
      }
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
    .map((r) => r.value);
}
```

**Important caveats:**
- `mode: "no-cors"` means you get an opaque response — you can't read the body, but a fulfilled promise means something is listening.
- This only works for HTTP servers. WebSocket-only servers won't respond to fetch.
- Some browsers may block localhost port scanning in the future (Chrome is tightening this).
- For a Codespace/remote environment, "localhost" may not mean what you expect — ports are forwarded.

### Better Alternative for Codespaces

In GitHub Codespaces, use the `CODESPACE_NAME` env var and the forwarded port URL pattern:
```
https://{CODESPACE_NAME}-{PORT}.app.github.dev
```

---

## 4. Pull-Up / Slide-Up Panel Patterns

### Recommendation: Custom CSS + Framer Motion (not a library)

For desktop web apps, mobile-style bottom sheet libraries (react-modal-sheet, react-spring-bottom-sheet) are overkill and feel wrong on desktop. Instead, build a simple pull-up panel:

```tsx
import { motion, useDragControls } from "framer-motion";

function PullUpPanel({ children, isOpen, onToggle }) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: isOpen ? "0%" : "calc(100% - 40px)" }} // 40px = handle peek
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onToggle(false);
        if (info.offset.y < -100) onToggle(true);
      }}
      className="fixed bottom-0 left-0 right-0 bg-background border-t rounded-t-xl z-50"
      style={{ height: "60vh" }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center py-2 cursor-grab"
        onClick={() => onToggle(!isOpen)}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>
      {children}
    </motion.div>
  );
}
```

### Snap Points Pattern

For a more VS Code-like experience with discrete sizes:

```tsx
const SNAP_POINTS = ["0%", "30%", "60%", "100%"]; // collapsed, peek, half, full

// Use react-resizable-panels vertically for this instead of custom drag:
<ResizablePanelGroup orientation="vertical">
  <ResizablePanel defaultSize="70%">
    {/* Main content */}
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize="30%" collapsible minSize="10%">
    {/* Pull-up terminal / logs */}
  </ResizablePanel>
</ResizablePanelGroup>
```

**Better idea:** Use react-resizable-panels for the pull-up too. It gives you consistent resize behavior, keyboard accessibility, and persistence for free. The vertical orientation makes it a natural bottom panel (like VS Code's terminal panel).

---

## 5. Keyboard Shortcuts for Panel Management

### Recommendation: Use native browser-friendly shortcuts

```tsx
// Register global shortcuts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Cmd/Ctrl + B: toggle sidebar (chat panel)
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      toggleChatPanel();
    }
    // Cmd/Ctrl + J: toggle bottom panel
    if ((e.metaKey || e.ctrlKey) && e.key === "j") {
      e.preventDefault();
      toggleBottomPanel();
    }
    // Cmd/Ctrl + \: toggle preview pane
    if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
      e.preventDefault();
      togglePreviewPane();
    }
    // Cmd/Ctrl + 1/2/3: focus panel
    if ((e.metaKey || e.ctrlKey) && ["1","2","3"].includes(e.key)) {
      e.preventDefault();
      focusPanel(parseInt(e.key) - 1);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

For panel collapse/expand, react-resizable-panels exposes imperative API:

```tsx
const panelRef = useRef<ImperativePanelHandle>(null);

// Toggle collapse
panelRef.current?.isCollapsed()
  ? panelRef.current?.expand()
  : panelRef.current?.collapse();
```

---

## 6. Performance: Iframes While Hidden

### Key Decision: Keep Alive vs Lazy Load

| Approach | Pros | Cons |
|---|---|---|
| **Keep alive (visibility: hidden)** | Instant toggle, state preserved, HMR continues | Memory usage, all iframes consume resources |
| **Unmount (remove from DOM)** | Zero memory when hidden | Reload on show, state lost, slow toggle |
| **display: none** | Similar to visibility hidden | Some browsers pause rendering, requestAnimationFrame stops |

### Recommendation: `visibility: hidden` + `position: absolute`

```tsx
<div style={{
  visibility: isVisible ? "visible" : "hidden",
  position: isVisible ? "relative" : "absolute",
  width: "100%",
  height: "100%",
  pointerEvents: isVisible ? "auto" : "none",
}}>
  <iframe src={url} style={{ width: "100%", height: "100%", border: "none" }} />
</div>
```

This keeps the iframe alive (JS continues running, WebSocket stays connected, Vite HMR works) but removes it from the visual layout. `pointerEvents: none` prevents accidental interactions.

**Do NOT use `display: none`** — some browsers unload or deprioritize hidden iframes, and the behavior is inconsistent.

**Memory budget:** Each iframe is essentially a full browser tab. For 1-2 preview panes this is fine. If you ever need 5+ simultaneous previews, consider unmounting inactive ones with a LRU cache pattern.

---

## 7. Implementation Architecture

### Recommended Component Tree

```
<App>
  <ShortcutProvider>
    <ResizablePanelGroup orientation="horizontal" autoSaveId="agent-os-main">
      
      <ResizablePanel ref={chatRef} collapsible defaultSize="25%" minSize="15%">
        <ChatPanel />
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize="40%" minSize="20%">
        <ResizablePanelGroup orientation="vertical" autoSaveId="agent-os-center">
          <ResizablePanel defaultSize="70%">
            <SystemGraph />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel ref={bottomRef} collapsible defaultSize="30%" minSize="10%">
            <BottomPanel /> {/* Terminal, logs, etc */}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel ref={previewRef} collapsible defaultSize="35%" minSize="20%">
        <PreviewPane activePorts={detectedPorts} />
      </ResizablePanel>
      
    </ResizablePanelGroup>
  </ShortcutProvider>
</App>
```

### Dependencies to Install

```bash
# Core (only real dependency)
npm install react-resizable-panels

# If using shadcn (recommended)
npx shadcn@latest add resizable

# Animation for any custom overlays
npm install framer-motion
```

No other panel libraries needed. react-resizable-panels handles horizontal splits, vertical splits, persistence, keyboard access, and collapse — all in one.

---

## Sources

- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) — v4.10.0, actively maintained
- [shadcn Resizable docs](https://ui.shadcn.com/docs/components/radix/resizable) — wrapper component
- [allotment GitHub](https://github.com/johnwalley/allotment) — VS Code-inspired alternative
- [npm trends comparison](https://npmtrends.com/allotment-vs-react-resizable-vs-react-split-pane-vs-react-splitter-layout)
- [postMessage API patterns](https://medium.com/@hanifmaliki/seamless-communication-between-parent-and-iframe-using-postmessage-201becfe6a75)
- [React iframe communication hooks](https://christoshrousis.com/writing/05-how-to-communicate-with-an-iframe-using-react-hooks/)
- [Browser port scanning with fetch](https://incolumitas.com/2021/01/10/browser-based-port-scanning/)
- [Base UI Drawer](https://base-ui.com/react/components/drawer) — snap points for bottom sheets
- [react-modal-sheet](https://github.com/Temzasse/react-modal-sheet) — mobile-first bottom sheet
