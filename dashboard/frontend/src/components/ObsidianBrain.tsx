import { useRef, useEffect, useCallback } from 'react';
import { useDashboard } from '../store';
import type { BrainNode, BrainEdge } from '../types/dashboard';

const GROUP_COLORS: Record<string, string> = {
  wiki: '#5fd4d4',      // cyan
  concepts: '#d4a55f',  // gold
  learnings: '#a77ddb', // purple
  agents: '#5fd47a',    // green
  other: '#888888',
};

const GROUP_GLOW: Record<string, string> = {
  wiki: 'rgba(95,212,212,0.4)',
  concepts: 'rgba(212,165,95,0.4)',
  learnings: 'rgba(167,125,219,0.4)',
  agents: 'rgba(95,212,122,0.4)',
  other: 'rgba(136,136,136,0.2)',
};

const FIRE_COLOR = '#fff';
const EDGE_COLOR = 'rgba(255,255,255,0.08)';
const EDGE_FIRE_COLOR = 'rgba(255,255,255,0.7)';

function runForceStep(nodes: BrainNode[], edges: BrainEdge[], w: number, h: number) {
  const repulsion = 2800;
  const springLen = 100;
  const springK = 0.004;
  const gravity = 0.0003;
  const damping = 0.92;

  // Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  // Spring along edges
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const e of edges) {
    const a = nodeMap.get(e.source);
    const b = nodeMap.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const displacement = dist - springLen;
    const force = springK * displacement;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Gravity toward center
  const cx = w / 2;
  const cy = h / 2;
  for (const n of nodes) {
    n.vx += (cx - n.x) * gravity;
    n.vy += (cy - n.y) * gravity;
  }

  // Apply velocity + damping
  for (const n of nodes) {
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx;
    n.y += n.vy;
    // Keep in bounds with padding
    n.x = Math.max(40, Math.min(w - 40, n.x));
    n.y = Math.max(40, Math.min(h - 40, n.y));
  }
}

function drawBrain(ctx: CanvasRenderingContext2D, nodes: BrainNode[], edges: BrainEdge[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Draw edges
  for (const e of edges) {
    const a = nodeMap.get(e.source);
    const b = nodeMap.get(e.target);
    if (!a || !b) continue;

    ctx.beginPath();
    // Slight curve for organic look
    const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.1;
    const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.1;
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.strokeStyle = e.firing ? EDGE_FIRE_COLOR : EDGE_COLOR;
    ctx.lineWidth = e.firing ? 2 : 0.8;
    ctx.stroke();

    // Draw fire pulse traveling along edge
    if (e.firing && e.fireProgress < 1) {
      const t = e.fireProgress;
      const px = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
      const py = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = FIRE_COLOR;
      ctx.shadowColor = FIRE_COLOR;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Draw nodes
  for (const n of nodes) {
    const color = GROUP_COLORS[n.group] || GROUP_COLORS.other;
    const glow = GROUP_GLOW[n.group] || GROUP_GLOW.other;

    // Glow
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.size + 6, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Node
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = n.size * 2;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.font = `${Math.max(8, n.size * 0.9)}px JetBrains Mono, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, n.x, n.y + n.size + 14);
  }

  // Group labels
  const groups: Record<string, { x: number; y: number; count: number }> = {};
  for (const n of nodes) {
    if (!groups[n.group]) groups[n.group] = { x: 0, y: 0, count: 0 };
    groups[n.group].x += n.x;
    groups[n.group].y += n.y;
    groups[n.group].count++;
  }
  for (const [group, data] of Object.entries(groups)) {
    const cx = data.x / data.count;
    const cy = data.y / data.count - 30;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = GROUP_COLORS[group] || '#888';
    ctx.globalAlpha = 0.4;
    ctx.textAlign = 'center';
    ctx.fillText(group.toUpperCase(), cx, cy);
    ctx.globalAlpha = 1;
  }
}

export function ObsidianBrain() {
  const { brainNodes, brainEdges, setCenterView, centerView } = useDashboard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<BrainNode[]>([]);
  const edgesRef = useRef<BrainEdge[]>([]);
  const frameRef = useRef(0);

  // Initialize nodes with proper scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.parentElement?.clientWidth || 800;
    const h = canvas.parentElement?.clientHeight || 600;
    canvas.width = w;
    canvas.height = h;

    // Scale initial positions to canvas size
    const scaleX = w / 800;
    const scaleY = h / 600;
    nodesRef.current = brainNodes.map(n => ({
      ...n,
      x: n.x * scaleX,
      y: n.y * scaleY,
    }));
    edgesRef.current = brainEdges.map(e => ({ ...e }));
  }, [brainNodes, brainEdges]);

  // Sync firing state from store
  useEffect(() => {
    for (const storeEdge of brainEdges) {
      const local = edgesRef.current.find(e => e.source === storeEdge.source && e.target === storeEdge.target);
      if (local && storeEdge.firing && !local.firing) {
        local.firing = true;
        local.fireProgress = 0;
      }
    }
  }, [brainEdges]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Run physics
    runForceStep(nodesRef.current, edgesRef.current, w, h);

    // Update fire progress
    for (const e of edgesRef.current) {
      if (e.firing) {
        e.fireProgress += 0.025;
        if (e.fireProgress >= 1) {
          e.firing = false;
          e.fireProgress = 0;
        }
      }
    }

    // Draw
    drawBrain(ctx, nodesRef.current, edgesRef.current, w, h);
    frameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (centerView !== 'brain') {
      cancelAnimationFrame(frameRef.current);
      return;
    }
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [animate, centerView]);

  // Handle resize
  useEffect(() => {
    function onResize() {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--color-bg-secondary)' }}>
      <canvas ref={canvasRef} className="brain-canvas" />
      <div className="constellation__view-toggle">
        {(['constellation', 'brain', 'files'] as const).map(v => (
          <button
            key={v}
            className={`constellation__view-btn ${centerView === v ? 'constellation__view-btn--active' : ''}`}
            onClick={() => setCenterView(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
