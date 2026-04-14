# Live System Visualization with D3.js Force Graphs

**Researched:** 2026-04-13
**Confidence:** HIGH (official docs + production libraries verified)

---

## Recommendation: Use `force-graph` by Vasturiano

**Do NOT build from scratch with raw D3.** Use [force-graph](https://github.com/vasturiano/force-graph) (vanilla) or [react-force-graph-2d](https://github.com/vasturiano/react-force-graph) (React). These libraries wrap d3-force with Canvas rendering and provide built-in support for every animation we need: particles along edges, custom node rendering, zoom/pan, drag, and dynamic data updates.

**Why:**
- Canvas-based (not SVG) -- handles 300+ nodes at 60fps without optimization work
- Built-in `linkDirectionalParticles` for data flow animation
- Built-in `emitParticle(link)` for on-demand pulse effects
- Custom `nodeCanvasObject` for full control over node appearance (bloom, pulse, state colors)
- Exposes underlying d3-force for clustering via `d3Force()`
- 2.5k+ GitHub stars, actively maintained, latest release 2 months ago

```bash
npm install force-graph
# or for React:
npm install react-force-graph-2d
```

---

## Architecture

### Data Model

```typescript
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphNode {
  id: string;
  type: 'project' | 'agent' | 'tool' | 'mcp' | 'concept';
  label: string;
  status: 'idle' | 'active' | 'error';
  group: string; // for clustering
  val?: number;  // node size
  // d3 mutates these:
  x?: number; y?: number;
  fx?: number; fy?: number; // fixed position (pinned nodes)
}

interface GraphLink {
  source: string;
  target: string;
  type: 'dispatches' | 'uses' | 'connects' | 'feeds';
  weight?: number;
}
```

### Component Structure

```
SystemGraph/
  index.tsx          -- main component, renders ForceGraph2D
  useGraphData.ts    -- transforms vault/project data into GraphData
  nodeRenderer.ts    -- nodeCanvasObject callback (shapes, colors, animations)
  animations.ts      -- bloom, pulse, particle triggers
  clusters.ts        -- category-based force clustering
  constants.ts       -- colors, sizes, force parameters
```

---

## Animation Patterns

### 1. Node Pulse (activation indicator)

Use an expanding ring with fading opacity. Track pulse state per-node and render in `nodeCanvasObject`:

```typescript
// In nodeRenderer.ts
const pulsingNodes = new Map<string, { start: number; duration: number }>();

function renderNode(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) {
  const size = node.val || 5;
  const pulse = pulsingNodes.get(node.id);

  // Pulse ring
  if (pulse) {
    const elapsed = Date.now() - pulse.start;
    const t = elapsed / pulse.duration;
    if (t < 1) {
      const radius = size + t * 20;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(0, 255, 255, ${1 - t})`;
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    } else {
      pulsingNodes.delete(node.id);
    }
  }

  // Base node
  ctx.beginPath();
  ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
  ctx.fillStyle = NODE_COLORS[node.type];
  ctx.fill();

  // Label
  ctx.font = `${12 / globalScale}px Sans-Serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(node.label, node.x!, node.y! + size + 12 / globalScale);
}

// Trigger pulse
function pulseNode(id: string, duration = 1000) {
  pulsingNodes.set(id, { start: Date.now(), duration });
}
```

### 2. Node Bloom (new node appearing)

Scale from 0 to full size over ~500ms with easeOutElastic:

```typescript
const bloomingNodes = new Map<string, number>(); // id -> start time

function getBloomScale(nodeId: string): number {
  const start = bloomingNodes.get(nodeId);
  if (!start) return 1;
  const t = Math.min(1, (Date.now() - start) / 500);
  if (t >= 1) { bloomingNodes.delete(nodeId); return 1; }
  // easeOutElastic
  return t === 0 ? 0 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}
```

### 3. Data Flow Particles (along edges)

Use the built-in particle system. No custom code needed:

```typescript
<ForceGraph2D
  linkDirectionalParticles={link => link.active ? 4 : 0}
  linkDirectionalParticleSpeed={0.005}
  linkDirectionalParticleWidth={3}
  linkDirectionalParticleColor={() => 'cyan'}
/>
```

For on-demand single particles (e.g., "agent dispatched"):

```typescript
const graphRef = useRef();
// Fire a single particle along a specific link
graphRef.current.emitParticle(linkObject);
```

### 4. Edge Beam (new connection appearing)

Use `linkCanvasObject` to draw a growing line:

```typescript
const beamingLinks = new Map<string, number>();

function renderLink(link, ctx, globalScale) {
  const start = beamingLinks.get(link.id);
  const t = start ? Math.min(1, (Date.now() - start) / 400) : 1;
  
  const sx = link.source.x, sy = link.source.y;
  const tx = link.target.x, ty = link.target.y;
  const cx = sx + (tx - sx) * t;
  const cy = sy + (ty - sy) * t;
  
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(cx, cy);
  ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 + 0.7 * t})`;
  ctx.lineWidth = 1.5 / globalScale;
  ctx.stroke();
}
```

### 5. State Change (color shift)

Simply update `node.status` in the data and let `nodeCanvasObject` read it. The canvas redraws every frame during simulation, so color changes are instant. For a smooth transition, interpolate:

```typescript
const NODE_COLORS = {
  project: { idle: '#4a9eff', active: '#00ff88', error: '#ff4444' },
  agent:   { idle: '#ff9f43', active: '#ffd700', error: '#ff4444' },
  tool:    { idle: '#a55eea', active: '#d946ef', error: '#ff4444' },
  mcp:     { idle: '#26de81', active: '#00ff88', error: '#ff4444' },
  concept: { idle: '#778ca3', active: '#adb5bd', error: '#ff4444' },
};
```

---

## Category-Based Clustering

Use a custom clustering force. Add it via `d3Force()`:

```typescript
import { forceX, forceY } from 'd3-force';

// Cluster centers by category
const CLUSTER_CENTERS = {
  project: { x: 0, y: -200 },
  agent:   { x: -250, y: 100 },
  tool:    { x: 250, y: 100 },
  mcp:     { x: 150, y: -100 },
  concept: { x: -150, y: -100 },
};

// Apply clustering forces (weak, so links still pull nodes together)
graph.d3Force('clusterX', forceX<GraphNode>()
  .x(n => CLUSTER_CENTERS[n.type].x)
  .strength(0.15)
);
graph.d3Force('clusterY', forceY<GraphNode>()
  .y(n => CLUSTER_CENTERS[n.type].y)
  .strength(0.15)
);

// Tune charge to prevent overlap
graph.d3Force('charge').strength(-120).distanceMax(300);
```

**Key tuning:** `strength(0.15)` is weak enough that linked nodes across categories still cluster near their connections, but unlinked nodes drift toward their category center. Increase to 0.3+ for strict separation.

---

## Performance Optimization

### For 100-300 nodes, Canvas is sufficient. No WebGL needed.

Research confirms Canvas handles up to 2,000-4,000 nodes at 60fps. Our target of 100-300 is well within range.

| Technique | When | How |
|-----------|------|-----|
| `warmupTicks: 50` | Initial load | Pre-compute layout before first render, avoids "explosion" |
| `cooldownTime: 3000` | After stabilization | Stop simulation after 3s to save CPU |
| `autoPauseRedraw: true` | Default | Stop rendering when simulation is frozen |
| `onEngineStop` | After layout stabilizes | Disable tick listener overhead |
| Reheat on change only | Dynamic updates | `graph.d3ReheatSimulation()` only when nodes/links change |
| `d3AlphaDecay: 0.02` | Smoother settling | Default 0.0228, lower = smoother but slower convergence |
| `d3VelocityDecay: 0.3` | Less oscillation | Default 0.4, lower = smoother motion |

### Dynamic Node/Link Addition

```typescript
function addNode(node: GraphNode) {
  bloomingNodes.set(node.id, Date.now());
  const data = graph.graphData();
  data.nodes.push(node);
  graph.graphData(data); // triggers reheat automatically
}

function addLink(link: GraphLink) {
  beamingLinks.set(`${link.source}-${link.target}`, Date.now());
  const data = graph.graphData();
  data.links.push(link);
  graph.graphData(data);
}

function removeNode(id: string) {
  const data = graph.graphData();
  data.nodes = data.nodes.filter(n => n.id !== id);
  data.links = data.links.filter(l => l.source.id !== id && l.target.id !== id);
  graph.graphData(data);
}
```

### Continuous Animation Without Simulation

When simulation is frozen but you still need pulse/bloom animations, use `onRenderFramePost`:

```typescript
<ForceGraph2D
  onRenderFramePost={(ctx, globalScale) => {
    // Draw any active pulse rings, bloom effects, etc.
    // This runs every requestAnimationFrame
  }}
/>
```

**Important:** If `autoPauseRedraw` is true and simulation is stopped, the canvas stops rendering. To keep animations going, either set `autoPauseRedraw={false}` or call `graphRef.current.resumeAnimation()` when animations are active.

---

## Interaction Patterns

### Click-to-Expand

```typescript
<ForceGraph2D
  onNodeClick={(node) => {
    if (node._expanded) {
      // Collapse: remove child nodes
      collapseNode(node);
    } else {
      // Expand: fetch and add related nodes
      const children = getRelatedNodes(node.id);
      children.forEach(addNode);
      node._expanded = true;
    }
  }}
/>
```

### Hover Tooltips

The library has built-in tooltip support, but for custom rich tooltips:

```typescript
<ForceGraph2D
  nodeLabel={node => `
    <div style="background:#1a1a2e;padding:8px;border-radius:4px;color:#fff">
      <b>${node.label}</b><br/>
      Type: ${node.type}<br/>
      Status: ${node.status}
    </div>
  `}
/>
```

### Zoom to Fit / Focus

```typescript
// Zoom to fit all nodes
graphRef.current.zoomToFit(400, 50); // 400ms duration, 50px padding

// Focus on specific node
graphRef.current.centerAt(node.x, node.y, 1000);
graphRef.current.zoom(2.5, 1000);
```

### Node Dragging

Built-in. Nodes get `fx`/`fy` set on drag, simulation reheats. To unpin after drag:

```typescript
<ForceGraph2D
  onNodeDragEnd={node => {
    node.fx = undefined;
    node.fy = undefined;
  }}
/>
```

---

## Full Component Example

```tsx
import ForceGraph2D from 'react-force-graph-2d';
import { useRef, useCallback, useEffect } from 'react';

export function SystemGraph({ data, onNodeSelect }) {
  const graphRef = useRef();

  useEffect(() => {
    const fg = graphRef.current;
    // Configure forces
    fg.d3Force('charge').strength(-120).distanceMax(300);
    fg.d3Force('clusterX', forceX(n => CLUSTER_CENTERS[n.type].x).strength(0.15));
    fg.d3Force('clusterY', forceY(n => CLUSTER_CENTERS[n.type].y).strength(0.15));
  }, []);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const scale = getBloomScale(node.id);
    const size = (node.val || 5) * scale;
    
    // Pulse effect
    renderPulse(node, ctx, globalScale);
    
    // Node shape by type
    ctx.beginPath();
    if (node.type === 'project') {
      // Rounded rect for projects
      roundRect(ctx, node.x - size, node.y - size, size * 2, size * 2, 3);
    } else if (node.type === 'concept') {
      // Diamond for concepts
      drawDiamond(ctx, node.x, node.y, size);
    } else {
      // Circle for agents, tools, MCPs
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    }
    ctx.fillStyle = NODE_COLORS[node.type][node.status];
    ctx.fill();
    
    // Label
    if (globalScale > 0.7) {
      ctx.font = `${11 / globalScale}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + size + 14 / globalScale);
    }
  }, []);

  return (
    <ForceGraph2D
      ref={graphRef}
      graphData={data}
      nodeCanvasObject={paintNode}
      nodeCanvasObjectMode={() => 'replace'}
      linkDirectionalParticles={l => l.active ? 3 : 0}
      linkDirectionalParticleSpeed={0.004}
      linkDirectionalParticleWidth={2.5}
      linkDirectionalParticleColor={() => '#00ffff'}
      linkColor={() => 'rgba(255,255,255,0.15)'}
      linkWidth={1}
      backgroundColor="#0a0a1a"
      warmupTicks={50}
      cooldownTime={3000}
      onNodeClick={onNodeSelect}
      onNodeDragEnd={n => { n.fx = undefined; n.fy = undefined; }}
    />
  );
}
```

---

## Production References

| System | Approach | Takeaway |
|--------|----------|----------|
| Grafana Node Graph | Canvas + d3-force, category colors, expandable groups | Use consistent color per node type, collapse dense areas |
| Kubernetes dashboards | Hierarchical layout with force, status-based coloring | Status (healthy/degraded/error) as primary visual signal |
| Neo4j Bloom | WebGL for 10k+ nodes, cluster by label, property-based sizing | For our scale, Canvas is fine; cluster force approach works |
| Obsidian Graph View | d3-force with category colors, fade labels at zoom levels | Hide labels when `globalScale < 0.7`, show on zoom |
| `force-graph` examples | Built-in particle demo, dynamic add/remove, custom shapes | Our exact use case, proven at scale |

---

## Pitfalls

1. **SVG trap** -- Do NOT use SVG for 100+ animated nodes. Canvas only.
2. **Simulation never stops** -- Set `cooldownTime` or the simulation runs forever eating CPU. Default is 15s which is fine.
3. **Data mutation** -- d3-force mutates node objects (adds x, y, vx, vy, index). Do not use immutable data structures; pass mutable objects.
4. **Re-render avalanche** -- In React, do NOT put graphData in state that triggers re-renders. Use `useRef` for the data and call `graphRef.current.graphData(newData)` imperatively.
5. **Animation after freeze** -- When simulation stops, canvas stops too (`autoPauseRedraw`). For continuous animations (pulses), either disable auto-pause or manage animation lifecycle manually.
6. **Label performance** -- Rendering 300 text labels every frame is expensive. Cull labels at low zoom (`globalScale < 0.7`).
7. **Initial layout explosion** -- Without `warmupTicks`, nodes fly apart on first render. Use `warmupTicks: 50` minimum.
8. **Particle accumulation** -- If links have `linkDirectionalParticles > 0` permanently, hundreds of particles render. Only set particles on active links.

---

## Sources

- [d3-force simulation API](https://d3js.org/d3-force/simulation)
- [force-graph by Vasturiano](https://github.com/vasturiano/force-graph)
- [react-force-graph](https://github.com/vasturiano/react-force-graph)
- [Particles between nodes (Canvas)](https://gist.github.com/gvenezia/e0e6d17dbf12dd6a7ea819ffe02c7aa1)
- [D3 Node Pulse](https://gist.github.com/whityiu/fb9f138a4a91032fa9ec)
- [PixiJS + D3 for large graphs](https://dianaow.com/posts/pixijs-d3-graph)
- [Canvas rendering perf analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC12061801/)
- [D3 + WebGL 1M points](https://blog.scottlogic.com/2020/05/01/rendering-one-million-points-with-d3.html)
- [React + D3 + PixiJS](https://dev.to/gilfink/creating-a-force-graph-using-react-d3-and-pixijs-182n)
