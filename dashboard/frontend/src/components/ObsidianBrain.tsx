import { useRef, useEffect, useCallback } from 'react';
import { useDashboard } from '../store';
import type { BrainNode, BrainEdge } from '../types/dashboard';

const GROUP_COLORS: Record<string, [number, number, number]> = {
  wiki: [95, 212, 212],
  concepts: [212, 165, 95],
  learnings: [167, 125, 219],
  agents: [95, 212, 122],
  other: [136, 136, 136],
};

function runForceStep(nodes: BrainNode[], edges: BrainEdge[], w: number, h: number) {
  const repulsion = 3200;
  const springLen = 110;
  const springK = 0.004;
  const gravity = 0.0004;
  const damping = 0.91;

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
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }

  const cx = w / 2, cy = h / 2;
  for (const n of nodes) {
    n.vx += (cx - n.x) * gravity;
    n.vy += (cy - n.y) * gravity;
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(50, Math.min(w - 50, n.x));
    n.y = Math.max(50, Math.min(h - 50, n.y));
  }
}

export function ObsidianBrain() {
  const { brainNodes, brainEdges, setCenterView, centerView, selectBrainNode } = useDashboard();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<BrainNode[]>([]);
  const edgesRef = useRef<BrainEdge[]>([]);
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: -1, y: -1 });
  const hoveredRef = useRef<string | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const w = canvas.parentElement.clientWidth * 2;
    const h = canvas.parentElement.clientHeight * 2;
    canvas.width = w;
    canvas.height = h;

    const scaleX = w / 800;
    const scaleY = h / 600;
    nodesRef.current = brainNodes.map(n => ({
      ...n, x: n.x * scaleX, y: n.y * scaleY,
    }));
    edgesRef.current = brainEdges.map(e => ({ ...e }));
  }, [brainNodes, brainEdges]);

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
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const t = timeRef.current;

    runForceStep(nodes, edges, w, h);

    // Background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, 'rgba(18, 14, 28, 1)');
    bgGrad.addColorStop(0.6, 'rgba(12, 10, 22, 1)');
    bgGrad.addColorStop(1, 'rgba(6, 5, 14, 1)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Apply zoom + pan
    ctx.save();
    const z = zoomRef.current;
    const pan = panRef.current;
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
    ctx.scale(z, z);
    ctx.translate(-w / 2, -h / 2);

    // Subtle hex grid for premium feel
    ctx.strokeStyle = 'rgba(120, 100, 200, 0.025)';
    ctx.lineWidth = 0.5;
    const hexR = 30;
    const hexW = hexR * Math.sqrt(3);
    for (let row = 0; row < h / (hexR * 1.5) + 1; row++) {
      for (let col = 0; col < w / hexW + 1; col++) {
        const cx = col * hexW + (row % 2) * hexW / 2;
        const cy = row * hexR * 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const angle = Math.PI / 3 * k - Math.PI / 6;
          const px = cx + hexR * Math.cos(angle);
          const py = cy + hexR * Math.sin(angle);
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Draw edges
    for (const e of edges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;

      const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.12;
      const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.12;

      const colA = GROUP_COLORS[a.group] || GROUP_COLORS.other;
      const colB = GROUP_COLORS[b.group] || GROUP_COLORS.other;

      if (e.firing) {
        // Bright firing edge with gradient
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `rgba(${colA[0]}, ${colA[1]}, ${colA[2]}, 0.8)`);
        grad.addColorStop(1, `rgba(${colB[0]}, ${colB[1]}, ${colB[2]}, 0.8)`);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Traveling pulse
        if (e.fireProgress < 1) {
          const p = e.fireProgress;
          const px = (1 - p) * (1 - p) * a.x + 2 * (1 - p) * p * mx + p * p * b.x;
          const py = (1 - p) * (1 - p) * a.y + 2 * (1 - p) * p * my + p * p * b.y;
          const pulseGrad = ctx.createRadialGradient(px, py, 0, px, py, 12);
          pulseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          pulseGrad.addColorStop(0.5, 'rgba(200, 200, 255, 0.3)');
          pulseGrad.addColorStop(1, 'rgba(200, 200, 255, 0)');
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fillStyle = pulseGrad;
          ctx.fill();

          e.fireProgress += 0.02;
          if (e.fireProgress >= 1) {
            e.firing = false;
            e.fireProgress = 0;
          }
        }
      } else {
        // Normal edge — subtle gradient
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const n of nodes) {
      const col = GROUP_COLORS[n.group] || GROUP_COLORS.other;
      const isHovered = hoveredRef.current === n.id;
      const breathe = 1 + Math.sin(t * 0.003 + n.x * 0.01) * 0.05;
      const r = (n.size + (isHovered ? 3 : 0)) * breathe;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, r * 4);
      glowGrad.addColorStop(0, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.2)`);
      glowGrad.addColorStop(0.4, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.05)`);
      glowGrad.addColorStop(1, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Main node — radial gradient for 3D effect
      const nodeGrad = ctx.createRadialGradient(n.x - r * 0.25, n.y - r * 0.25, r * 0.1, n.x, n.y, r);
      nodeGrad.addColorStop(0, `rgba(${Math.min(255, col[0] + 60)}, ${Math.min(255, col[1] + 60)}, ${Math.min(255, col[2] + 60)}, 1)`);
      nodeGrad.addColorStop(0.7, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.9)`);
      nodeGrad.addColorStop(1, `rgba(${Math.max(0, col[0] - 40)}, ${Math.max(0, col[1] - 40)}, ${Math.max(0, col[2] - 40)}, 0.8)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeGrad;
      ctx.shadowColor = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.6)`;
      ctx.shadowBlur = isHovered ? r * 3 : r * 1.5;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Specular highlight
      const specGrad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x - r * 0.3, n.y - r * 0.3, r * 0.5);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();

      // Label
      const fontSize = Math.max(16, r * 1.2);
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;
      ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y + r + fontSize + 4);
    }

    // Group labels with subtle background
    const groups: Record<string, { x: number; y: number; count: number }> = {};
    for (const n of nodes) {
      if (!groups[n.group]) groups[n.group] = { x: 0, y: 0, count: 0 };
      groups[n.group].x += n.x;
      groups[n.group].y += n.y;
      groups[n.group].count++;
    }
    for (const [group, data] of Object.entries(groups)) {
      const gx = data.x / data.count;
      const gy = data.y / data.count - 40;
      const col = GROUP_COLORS[group] || GROUP_COLORS.other;
      ctx.font = '18px JetBrains Mono, monospace';
      ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.25)`;
      ctx.textAlign = 'center';
      ctx.letterSpacing = '3px';
      ctx.fillText(group.toUpperCase(), gx, gy);
    }

    ctx.restore();
    timeRef.current += 16;
    frameRef.current = requestAnimationFrame(animate);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawMx = (e.clientX - rect.left) * scaleX;
    const rawMy = (e.clientY - rect.top) * scaleY;
    // Un-transform mouse coords for zoom/pan
    const z = zoomRef.current;
    const pan = panRef.current;
    const w = canvas.width, h = canvas.height;
    const mx = (rawMx - w / 2 - pan.x) / z + w / 2;
    const my = (rawMy - h / 2 - pan.y) / z + h / 2;
    mouseRef.current = { x: mx, y: my };

    // Handle drag panning
    if (draggingRef.current) {
      const dx = (e.clientX - dragStartRef.current.x) * scaleX;
      const dy = (e.clientY - dragStartRef.current.y) * scaleY;
      panRef.current = { x: panStartRef.current.x + dx, y: panStartRef.current.y + dy };
      canvas.style.cursor = 'grabbing';
      return;
    }

    let found: string | null = null;
    for (const n of nodesRef.current) {
      const dist = Math.sqrt((mx - n.x) ** 2 + (my - n.y) ** 2);
      if (dist < n.size * 3) { found = n.id; break; }
    }
    hoveredRef.current = found;
    canvas.style.cursor = found ? 'pointer' : 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomRef.current = Math.max(0.3, Math.min(4, zoomRef.current * delta));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag if not hovering a node
    if (!hoveredRef.current) {
      draggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...panRef.current };
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasDrag = draggingRef.current && (
      Math.abs(e.clientX - dragStartRef.current.x) > 3 ||
      Math.abs(e.clientY - dragStartRef.current.y) > 3
    );
    draggingRef.current = false;
    // Click on node (not a drag)
    if (!wasDrag && hoveredRef.current) {
      selectBrainNode(hoveredRef.current);
    }
  }, [selectBrainNode]);

  useEffect(() => {
    if (centerView !== 'brain') {
      cancelAnimationFrame(frameRef.current);
      return;
    }
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [animate, centerView]);

  useEffect(() => {
    function onResize() {
      const canvas = canvasRef.current;
      if (!canvas?.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth * 2;
      canvas.height = canvas.parentElement.clientHeight * 2;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#060510' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
      <div className="constellation__view-toggle">
        {(['constellation', 'brain', 'procedures', 'files'] as const).map(v => (
          <button
            key={v}
            className={`constellation__view-btn ${centerView === v ? 'constellation__view-btn--active' : ''}`}
            onClick={() => setCenterView(v)}
          >
            {v === 'files' ? 'Activity' : v === 'constellation' ? 'Projects' : v === 'procedures' ? 'Procedures' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
