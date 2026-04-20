import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { kellyPositionSize, generateHistory } from '../utils/kelly.js'
import { fetchLiveMarkets, checkPolyResolution, checkKalshiResolution } from '../services/markets.js'
import { getPositions, savePosition, resolvePosition, calcResolutionPnl } from '../services/positions.js'

/* ─── CONSTANTS ─────────────────────────────────────────────────────────── */

const INITIAL_BANKROLL = 500

const MOCK_MARKETS = [
  { id: 'FED-RATE-MAY26',  title: 'Fed holds rates at May 2026 meeting?',  pMarket: 0.72, vol: 8400,  days: 18, platform: 'kalshi' },
  { id: 'WTI-OIL-80-APR26', title: 'WTI crude closes above $80 this week?', pMarket: 0.38, vol: 5100,  days: 5,  platform: 'kalshi' },
  { id: 'RAIN-NYC-APR26',  title: 'NYC gets >1 inch rain this week?',       pMarket: 0.49, vol: 2200,  days: 4,  platform: 'polymarket' },
  { id: 'BTC-90K-APR26',   title: 'Bitcoin closes above $90k by Apr 30?',   pMarket: 0.31, vol: 15000, days: 23, platform: 'polymarket' },
  { id: 'NFP-200K-APR26',  title: 'April NFP report exceeds 200k jobs?',    pMarket: 0.55, vol: 3800,  days: 28, platform: 'kalshi' },
]

const FALLBACK_SIGNALS = [
  { market_id: 'FED-RATE-MAY26', title: 'Fed holds rates at May 2026 meeting?', p_model: 0.82, p_market: 0.72, edge: 0.10, direction: 'yes', confidence: 0.78, reasoning: 'CPI trends and Fed communications strongly suggest pause.' },
  { market_id: 'RAIN-NYC-APR26', title: 'NYC gets >1 inch rain this week?', p_model: 0.63, p_market: 0.49, edge: 0.14, direction: 'yes', confidence: 0.67, reasoning: 'NOAA 7-day forecast shows 65% precipitation probability.' },
  { market_id: 'BTC-90K-APR26', title: 'Bitcoin closes above $90k by Apr 30?', p_model: 0.22, p_market: 0.31, edge: -0.09, direction: 'no', confidence: 0.61, reasoning: 'On-chain metrics and macro headwinds suggest lower probability.' },
]

const PIPELINE_STEPS = ['SCAN', 'RESEARCH', 'PREDICT', 'EXECUTE', 'COMPOUND']
const STEP_DURATIONS      = { SCAN: 1400, RESEARCH: 2200, PREDICT: 3000, EXECUTE: 1200, COMPOUND: 900 }
const STEP_DURATIONS_FAST = { SCAN: 200,  RESEARCH: 300,  PREDICT: 600,  EXECUTE: 200,  COMPOUND: 150 }

/* ─── STYLES ─────────────────────────────────────────────────────────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #07080f;
  --surface:  #0c0e1a;
  --border:   #1a1e35;
  --border2:  #252a45;
  --cyan:     #00d4ff;
  --green:    #00ff87;
  --red:      #ff3b5c;
  --amber:    #ffaa00;
  --muted:    #3a4060;
  --text:     #c8d0f0;
  --dim:      #606888;
  --font-mono: 'Share Tech Mono', monospace;
  --font-display: 'Barlow Condensed', sans-serif;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  min-height: 100vh;
  overflow-x: hidden;
}

#root { min-height: 100vh; }

.scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,212,255,0.012) 2px,
    rgba(0,212,255,0.012) 4px
  );
}

.dashboard {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 0 48px;
}

/* HEADER */
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: var(--cyan);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.logo-dev { color: var(--amber); }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px solid;
}

.badge-sim {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255,170,0,0.08);
  animation: pulse-amber 2s infinite;
}

.badge-locked {
  border-color: var(--muted);
  color: var(--dim);
  background: transparent;
  cursor: not-allowed;
  user-select: none;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--dim);
  font-size: 11px;
}

.clock {
  color: var(--text);
  font-size: 13px;
  letter-spacing: 0.05em;
}

.geo-status { color: var(--dim); }
.geo-ok { color: var(--green); }

/* KPI ROW */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  border-bottom: 1px solid var(--border);
  background: var(--border);
}

.kpi-card {
  background: var(--surface);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-label {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.kpi-value {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.kpi-sub {
  font-size: 10px;
  color: var(--dim);
}

.kpi-target-ok { color: var(--green); }
.kpi-target-warn { color: var(--amber); }
.kpi-target-bad { color: var(--red); }
.kpi-positive { color: var(--green); }
.kpi-negative { color: var(--red); }
.kpi-neutral { color: var(--text); }

/* PIPELINE BAR */
.pipeline-bar {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.pipeline-label {
  font-size: 11px;
  color: var(--dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  min-width: 72px;
}

.pipeline-steps {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--muted);
  background: transparent;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.step-dot.active {
  border-color: var(--cyan);
  background: var(--cyan);
  animation: pulse-cyan 0.8s ease-in-out infinite;
}

.step-dot.done {
  border-color: var(--green);
  background: var(--green);
}

.step-name {
  font-size: 11px;
  color: var(--dim);
  letter-spacing: 0.06em;
}
.step-name.active { color: var(--cyan); }
.step-name.done { color: var(--green); }

.step-arrow {
  color: var(--muted);
  margin: 0 6px;
  font-size: 12px;
}

.pipeline-controls {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn {
  padding: 6px 16px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: uppercase;
}

.btn-run {
  border-color: var(--cyan);
  color: var(--cyan);
  background: rgba(0,212,255,0.08);
}
.btn-run:hover:not(:disabled) { background: rgba(0,212,255,0.18); }
.btn-run:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-batch {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255,170,0,0.07);
  padding: 6px 12px;
}
.btn-batch:hover:not(:disabled) { background: rgba(255,170,0,0.16); }
.btn-batch:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-reset {
  border-color: var(--muted);
  color: var(--dim);
  background: transparent;
  padding: 6px 10px;
}
.btn-reset:hover:not(:disabled) { border-color: var(--border2); color: var(--text); }
.btn-reset:disabled { opacity: 0.3; cursor: not-allowed; }

.btn-stop {
  border-color: var(--red);
  color: var(--red);
  background: rgba(255,59,92,0.08);
}
.btn-stop:hover:not(:disabled) { background: rgba(255,59,92,0.18); }
.btn-stop:disabled { opacity: 0.3; cursor: not-allowed; }

/* MAIN CONTENT */
.main-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 340px;
  grid-template-rows: auto auto;
  gap: 1px;
  background: var(--border);
  margin-top: 1px;
}

.chart-section {
  background: var(--surface);
  padding: 16px;
  min-height: 240px;
}

.kelly-section {
  background: var(--surface);
  padding: 16px;
  grid-row: 1;
  grid-column: 2;
}

.section-title {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border2);
}

/* BOTTOM GRID */
.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 340px;
  gap: 1px;
  background: var(--border);
  grid-column: 1 / -1;
}

.signals-section, .tradelog-section, .sidebar-section {
  background: var(--surface);
  padding: 16px;
  overflow: hidden;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* SIGNALS TABLE */
.signals-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.signals-table th {
  text-align: left;
  padding: 6px 8px;
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--border2);
  font-weight: 400;
}
.signals-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.signal-title {
  font-size: 11px;
  color: var(--text);
  line-height: 1.3;
  max-width: 200px;
}
.platform-badge {
  display: inline-block;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 2px;
  margin-top: 2px;
  border: 1px solid var(--border2);
  color: var(--dim);
}
.dir-yes { color: var(--bg); background: var(--green); padding: 2px 6px; border-radius: 2px; font-size: 10px; font-weight: 700; }
.dir-no  { color: var(--bg); background: var(--red);   padding: 2px 6px; border-radius: 2px; font-size: 10px; font-weight: 700; }
.edge-pos { color: var(--green); }
.edge-neg { color: var(--red); }
.bet-size { color: var(--amber); }
.empty-state {
  color: var(--dim);
  font-size: 12px;
  text-align: center;
  padding: 24px;
}

/* TRADE LOG */
.trade-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.trade-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
.trade-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.trade-time { color: var(--dim); min-width: 40px; }
.trade-title { color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trade-pnl { min-width: 60px; text-align: right; font-weight: 700; }
.pnl-pos { color: var(--green); }
.pnl-neg { color: var(--red); }

/* PIPELINE LOG */
.pipeline-log {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}
.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  line-height: 1.4;
}
.log-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.log-text { color: var(--dim); }
.log-cyan .log-dot { background: var(--cyan); }
.log-cyan .log-text { color: var(--cyan); }
.log-green .log-dot { background: var(--green); }
.log-green .log-text { color: var(--green); }
.log-amber .log-dot { background: var(--amber); }
.log-amber .log-text { color: var(--amber); }
.log-grey .log-dot { background: var(--muted); }

/* RISK MONITOR */
.risk-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.risk-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}
.risk-label { color: var(--dim); }
.risk-val-ok { color: var(--green); }
.risk-val-warn { color: var(--amber); }
.risk-val-bad { color: var(--red); }
.risk-bar-wrap {
  width: 80px;
  height: 4px;
  background: var(--muted);
  border-radius: 2px;
  overflow: hidden;
}
.risk-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* KELLY WIDGET */
.kelly-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.kelly-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kelly-field label {
  font-size: 10px;
  color: var(--dim);
  min-width: 80px;
  letter-spacing: 0.06em;
}
.kelly-field input {
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: 3px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 4px 8px;
  width: 100%;
  outline: none;
}
.kelly-field input:focus { border-color: var(--cyan); }

.kelly-result {
  border-top: 1px solid var(--border2);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kelly-no-bet {
  color: var(--red);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.05em;
}
.kelly-warn { color: var(--red); font-size: 10px; }

.kelly-bet-size {
  color: var(--green);
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.kelly-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.kelly-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.kelly-meta-label { color: var(--dim); }
.kelly-meta-val { color: var(--text); }
.kelly-ev-pos { color: var(--green); }
.kelly-ev-neg { color: var(--red); }

/* CHART TOOLTIP */
.chart-tooltip {
  background: var(--surface);
  border: 1px solid var(--border2);
  padding: 8px 12px;
  border-radius: 3px;
  font-size: 11px;
}
.chart-tooltip-time { color: var(--dim); margin-bottom: 4px; }
.chart-tooltip-val { color: var(--text); font-weight: 700; }
.chart-tooltip-pnl { font-size: 10px; }

/* POSITIONS PANEL */
.positions-strip {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 14px 20px 20px;
}

.positions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.position-card {
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: 4px;
  padding: 10px 12px;
  min-width: 220px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.position-card.resolved-win  { border-color: rgba(0,255,135,0.3); }
.position-card.resolved-loss { border-color: rgba(255,59,92,0.3); }
.position-card.pending { border-color: rgba(255,170,0,0.25); }

.pos-title {
  font-size: 11px;
  color: var(--text);
  line-height: 1.35;
}

.pos-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.pos-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 2px;
  font-weight: 700;
}

.pos-badge-yes  { background: rgba(0,255,135,0.15); color: var(--green); border: 1px solid rgba(0,255,135,0.3); }
.pos-badge-no   { background: rgba(255,59,92,0.15);  color: var(--red);   border: 1px solid rgba(255,59,92,0.3); }
.pos-badge-poly { background: rgba(0,212,255,0.08);  color: var(--cyan);  border: 1px solid rgba(0,212,255,0.2); }
.pos-badge-kals { background: rgba(255,170,0,0.08);  color: var(--amber); border: 1px solid rgba(255,170,0,0.2); }

.pos-size  { font-size: 11px; color: var(--amber); }
.pos-pnl   { font-size: 12px; font-weight: 700; margin-top: 2px; }
.pos-pending { font-size: 10px; color: var(--amber); }
.pos-date  { font-size: 9px; color: var(--dim); }

.positions-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
  font-size: 11px;
  flex-wrap: wrap;
}
.ps-item { color: var(--dim); }
.ps-val  { color: var(--text); }
.ps-pos  { color: var(--green); }
.ps-neg  { color: var(--red); }

.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 2px;
  margin-left: 8px;
  font-weight: 700;
}
.source-live { background: rgba(0,255,135,0.1); color: var(--green); border: 1px solid rgba(0,255,135,0.25); }
.source-mock { background: rgba(255,170,0,0.1); color: var(--amber); border: 1px solid rgba(255,170,0,0.25); }

/* FOOTER */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  font-size: 10px;
  color: var(--dim);
  display: flex;
  justify-content: space-between;
  z-index: 100;
}
.footer-right { color: var(--dim); }

/* ANIMATIONS */
@keyframes pulse-amber {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes pulse-cyan {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.5); }
  50% { box-shadow: 0 0 0 4px rgba(0,212,255,0); }
}
@keyframes slide-in {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
.trade-entry { animation: slide-in 0.3s ease; }
.log-entry { animation: slide-in 0.2s ease; }

/* SCROLLBAR */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--muted); border-radius: 2px; }
`

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

function fmtCurrency(v) {
  return `$${Math.abs(v).toFixed(2)}`
}

function nowMX() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function currentTimestamp() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/* ─── SUB-COMPONENTS ─────────────────────────────────────────────────────── */

function KPICard({ label, value, sub, valueClass = 'kpi-neutral' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function ChartTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  const pnl = v - INITIAL_BANKROLL
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{payload[0].payload.t}</div>
      <div className="chart-tooltip-val">${v.toFixed(2)}</div>
      <div className={`chart-tooltip-pnl ${pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>
        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} vs start
      </div>
    </div>
  )
}

function KellyWidget() {
  const [pModel, setPModel] = useState('0.70')
  const [pMarket, setPMarket] = useState('0.49')
  const [bankroll, setBankroll] = useState('500')

  const pm = parseFloat(pModel) || 0
  const pmkt = parseFloat(pMarket) || 0
  const br = parseFloat(bankroll) || 500

  const result = (pm > 0 && pm < 1 && pmkt > 0 && pmkt < 1 && br > 0)
    ? kellyPositionSize(pm, pmkt, br)
    : null

  return (
    <div>
      <div className="section-title">Kelly Calculator</div>
      <div className="kelly-inputs">
        <div className="kelly-field">
          <label>P_MODEL</label>
          <input value={pModel} onChange={e => setPModel(e.target.value)} placeholder="0.70" />
        </div>
        <div className="kelly-field">
          <label>P_MARKET</label>
          <input value={pMarket} onChange={e => setPMarket(e.target.value)} placeholder="0.49" />
        </div>
        <div className="kelly-field">
          <label>BANKROLL</label>
          <input value={bankroll} onChange={e => setBankroll(e.target.value)} placeholder="500" />
        </div>
      </div>

      <div className="kelly-result">
        {!result ? (
          <div className="kelly-no-bet">— / —</div>
        ) : result.approved && result.size > 0 ? (
          <>
            <div className="kelly-bet-size">BET ${result.size.toFixed(2)}</div>
            <div className="kelly-meta">
              <div className="kelly-meta-row">
                <span className="kelly-meta-label">Net odds (b)</span>
                <span className="kelly-meta-val">{result.b.toFixed(3)}</span>
              </div>
              <div className="kelly-meta-row">
                <span className="kelly-meta-label">Full Kelly f*</span>
                <span className="kelly-meta-val">{(result.fStar * 100).toFixed(1)}%</span>
              </div>
              <div className="kelly-meta-row">
                <span className="kelly-meta-label">¼-Kelly fraction</span>
                <span className="kelly-meta-val">{(result.fStar * 25).toFixed(1)}%</span>
              </div>
              <div className="kelly-meta-row">
                <span className="kelly-meta-label">Expected value</span>
                <span className={`kelly-meta-val ${result.ev > 0 ? 'kelly-ev-pos' : 'kelly-ev-neg'}`}>
                  {result.ev > 0 ? '+' : ''}{result.ev.toFixed(4)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="kelly-no-bet">NO BET</div>
            <div className="kelly-warn">⚠ Negative edge — skip this trade</div>
          </>
        )}
      </div>
    </div>
  )
}

function RiskMonitor({ portfolio, apiCost, trades }) {
  const drawdown = Math.max(0, INITIAL_BANKROLL - portfolio)
  const drawdownPct = (drawdown / INITIAL_BANKROLL) * 100
  const drawdownLimit = 8
  const apiCap = 5
  const drawClass = drawdownPct > 6 ? 'risk-val-bad' : drawdownPct > 4 ? 'risk-val-warn' : 'risk-val-ok'
  const apiClass = apiCost > 4 ? 'risk-val-bad' : apiCost > 3 ? 'risk-val-warn' : 'risk-val-ok'

  return (
    <div>
      <div className="section-title">Risk Monitor</div>
      <div className="risk-rows">
        <div className="risk-row">
          <span className="risk-label">Max drawdown</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="risk-bar-wrap">
              <div className="risk-bar-fill" style={{
                width: `${Math.min(100, (drawdownPct / drawdownLimit) * 100)}%`,
                background: drawdownPct > 6 ? 'var(--red)' : drawdownPct > 4 ? 'var(--amber)' : 'var(--green)'
              }} />
            </div>
            <span className={drawClass}>{drawdownPct.toFixed(1)}% / {drawdownLimit}%</span>
          </div>
        </div>

        <div className="risk-row">
          <span className="risk-label">API cost (session)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="risk-bar-wrap">
              <div className="risk-bar-fill" style={{
                width: `${Math.min(100, (apiCost / apiCap) * 100)}%`,
                background: apiCost > 4 ? 'var(--red)' : apiCost > 3 ? 'var(--amber)' : 'var(--cyan)'
              }} />
            </div>
            <span className={apiClass}>${apiCost.toFixed(3)} / $5.00</span>
          </div>
        </div>

        <div className="risk-row">
          <span className="risk-label">Kill switch</span>
          <span className="risk-val-ok">INACTIVE ✓</span>
        </div>

        <div className="risk-row">
          <span className="risk-label">Simulation mode</span>
          <span className="risk-val-ok">ON ✓</span>
        </div>

        <div className="risk-row">
          <span className="risk-label">Total trades</span>
          <span style={{ color: 'var(--text)' }}>{trades}</span>
        </div>
      </div>
    </div>
  )
}

/* ─── MAIN DASHBOARD ─────────────────────────────────────────────────────── */

/* ─── PERSISTENCE ────────────────────────────────────────────────────────── */

const SIM_KEY = 'mercado_bot_sim_v1'

function loadSim() {
  try {
    const raw = localStorage.getItem(SIM_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveSim(state) {
  try { localStorage.setItem(SIM_KEY, JSON.stringify(state)) } catch {}
}

export default function Dashboard() {
  // Time
  const [clock, setClock] = useState(nowMX())

  // Portfolio state — restored from localStorage on mount
  const saved = loadSim()
  const [portfolio, setPortfolio] = useState(saved?.portfolio ?? INITIAL_BANKROLL)
  const [sessionPnL, setSessionPnL] = useState(saved?.sessionPnL ?? 0)
  const [chartData, setChartData] = useState(() => saved?.chartData ?? generateHistory(28, INITIAL_BANKROLL))
  const [apiCost, setApiCost] = useState(saved?.apiCost ?? 0)

  // Trade metrics
  const [wins, setWins] = useState(saved?.wins ?? 0)
  const [totalTrades, setTotalTrades] = useState(saved?.totalTrades ?? 0)
  const [brierScores, setBrierScores] = useState(saved?.brierScores ?? [])
  const [returns, setReturns] = useState(saved?.returns ?? [])
  const [trades, setTrades] = useState(saved?.trades ?? [])

  // Pipeline state
  const [running, setRunning] = useState(false)
  const [stepStates, setStepStates] = useState({})
  const [signals, setSignals] = useState([])
  const [pipelineLog, setPipelineLog] = useState(saved?.pipelineLog ?? [
    { type: 'grey', text: 'System ready · SIMULATION_MODE=true' },
    { type: 'grey', text: 'Click [RUN PIPELINE] to start first scan' },
  ])
  const [batchProgress, setBatchProgress] = useState(null)

  // Live market data
  const [liveMarkets, setLiveMarkets] = useState(null)
  const [marketSource, setMarketSource] = useState('mock')

  // Real paper positions (persisted to localStorage)
  const [paperPositions, setPaperPositions] = useState(() => getPositions())
  const [realPnL, setRealPnL] = useState(() => {
    const pos = getPositions()
    return pos.filter(p => p.resolved).reduce((sum, p) => sum + (p.pnl || 0), 0)
  })

  const stopRef = useRef(false)
  const portfolioRef = useRef(saved?.portfolio ?? INITIAL_BANKROLL)
  const winsRef = useRef(saved?.wins ?? 0)
  const totalRef = useRef(saved?.totalTrades ?? 0)
  const brierRef = useRef(saved?.brierScores ?? [])
  const returnsRef = useRef(saved?.returns ?? [])

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(nowMX()), 1000)
    return () => clearInterval(t)
  }, [])

  // Persist sim state to localStorage whenever key values change
  useEffect(() => {
    saveSim({
      portfolio, sessionPnL, apiCost,
      wins, totalTrades, brierScores, returns,
      trades: trades.slice(0, 100),
      chartData: chartData.slice(-120),
      pipelineLog: pipelineLog.slice(0, 40),
    })
  }, [portfolio, sessionPnL, apiCost, wins, totalTrades, brierScores, returns, trades, chartData])

  const addLog = useCallback((type, text) => {
    setPipelineLog(prev => [{ type, text }, ...prev].slice(0, 80))
  }, [])

  const delay = ms => new Promise(res => setTimeout(res, ms))

  /** Check all open paper positions for real resolution */
  async function checkResolutions() {
    const positions = getPositions()
    const open = positions.filter(p => !p.resolved)
    if (open.length === 0) return

    let settled = 0
    let realPnLDelta = 0

    for (const pos of open) {
      let outcome = null
      if (pos.platform === 'polymarket' && pos.polyId) {
        outcome = await checkPolyResolution(pos.polyId)
      } else if (pos.platform === 'kalshi' && pos.kalshiTicker) {
        outcome = await checkKalshiResolution(pos.kalshiTicker)
      }
      if (outcome) {
        const pnl = calcResolutionPnl(pos, outcome)
        resolvePosition(pos.id, outcome, pnl)
        realPnLDelta += pnl
        settled++
      }
    }

    if (settled > 0) {
      const sign = realPnLDelta >= 0 ? '+' : ''
      addLog('green', `✓ RESOLUTION · ${settled} position(s) settled · real P&L ${sign}$${realPnLDelta.toFixed(2)}`)
      const updated = getPositions()
      setPaperPositions(updated)
      setRealPnL(updated.filter(p => p.resolved).reduce((s, p) => s + (p.pnl || 0), 0))
    }
  }

  /** Fetch live markets + run Claude predict. Called once per pipeline invocation (single or batch). */
  async function fetchAndPredict() {
    // ── SCAN ──
    setStepStates({ SCAN: 'active' })
    addLog('cyan', '▶ SCAN · fetching live markets...')

    let markets = MOCK_MARKETS
    let source = 'mock'

    const [liveResult] = await Promise.allSettled([
      fetchLiveMarkets(),
      checkResolutions(),
    ])

    if (liveResult.status === 'fulfilled' && liveResult.value.length > 0) {
      markets = liveResult.value
      source = 'live'
      setLiveMarkets(markets)
      setMarketSource('live')
      addLog('green', `✓ SCAN · ${markets.length} live markets fetched · resolutions checked`)
    } else {
      setMarketSource('mock')
      addLog('amber', `⚠ SCAN · live fetch failed · using mock markets`)
    }

    if (stopRef.current) throw new Error('STOPPED')
    setStepStates({ SCAN: 'done' })

    // ── RESEARCH ──
    setStepStates({ SCAN: 'done', RESEARCH: 'active' })
    addLog('cyan', '▶ RESEARCH · analyzing market context...')
    await delay(600)
    if (stopRef.current) throw new Error('STOPPED')
    addLog('green', `✓ RESEARCH · ${markets.length} markets in scope`)
    setStepStates({ SCAN: 'done', RESEARCH: 'done' })

    // ── PREDICT ──
    setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'active' })
    addLog('cyan', '▶ PREDICT · calling Claude for edge detection...')

    let rawSignals = null
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

    if (apiKey && apiKey !== 'your_key_here') {
      try {
        const marketSummary = markets.slice(0, 12).map(m => ({
          id: m.id, title: m.title, pMarket: m.pMarket,
          days: m.days, vol: m.vol, platform: m.platform,
        }))
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-opus-4-7',
            max_tokens: 1200,
            messages: [{
              role: 'user',
              content: `You are a prediction market analyst. Analyze these ${source === 'live' ? 'LIVE' : 'sample'} markets and return ONLY a valid JSON array (no markdown, no explanation):
${JSON.stringify(marketSummary)}

Today is ${new Date().toISOString().slice(0, 10)}. Estimate the true probability (p_model) for each market.
Return ONLY markets where abs(p_model - p_market) > 0.04 AND you have genuine confidence.

JSON format (empty array [] if no edge found):
[{"market_id":"...","title":"...","p_model":0.00,"p_market":0.00,"edge":0.00,"direction":"yes or no","confidence":0.00,"reasoning":"one sentence max"}]

edge = p_model - p_market. direction = "yes" if p_model > p_market, "no" if p_model < p_market.`
            }]
          })
        })
        const data = await resp.json()
        const text = data?.content?.[0]?.text || ''
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        rawSignals = JSON.parse(cleaned)
        if (!Array.isArray(rawSignals)) rawSignals = []
        setApiCost(c => +(c + 0.003).toFixed(4))
        addLog('green', `✓ PREDICT · Claude found ${rawSignals.length} edge(s) · source: ${source}`)
      } catch {
        addLog('amber', '⚠ PREDICT · API error · using fallback signals')
        rawSignals = FALLBACK_SIGNALS
      }
    } else {
      addLog('amber', '⚠ PREDICT · no API key · using fallback signals')
      rawSignals = FALLBACK_SIGNALS
    }

    if (stopRef.current) throw new Error('STOPPED')

    // Enrich with market metadata + Kelly sizing
    const enriched = rawSignals.map(s => {
      const mkt = markets.find(m => m.id === s.market_id) ||
                  markets.find(m => m.title?.toLowerCase().includes(s.title?.toLowerCase().slice(0, 20)))
      return {
        ...s,
        platform: mkt?.platform || 'polymarket',
        polyId: mkt?.polyId || null,
        kalshiTicker: mkt?.kalshiTicker || null,
        endDate: mkt?.endDate || null,
        kelly: kellyPositionSize(s.p_model, s.p_market, portfolioRef.current),
      }
    })

    setSignals(enriched)
    setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done' })
    return { enriched, source }
  }

  /** Execute one round of fills against a set of pre-computed signals. */
  function executeRound(enriched, source, runIndex = 0) {
    const openPositionIds = new Set(
      getPositions().filter(p => !p.resolved).map(p => p.marketId)
    )

    const newTrades = []
    let pnlDelta = 0

    for (const sig of enriched) {
      if (sig.kelly.size <= 0) continue

      // Don't double-open a position on the same market
      const alreadyOpen = openPositionIds.has(sig.market_id)

      const won = Math.random() < sig.p_model
      const pnl = won
        ? +(sig.kelly.size * ((1 / sig.p_market) - 1) * 0.9).toFixed(2)
        : -sig.kelly.size

      newTrades.push({ time: currentTimestamp(), title: sig.title, pnl, won })
      pnlDelta += pnl
      if (won) winsRef.current++
      totalRef.current++
      brierRef.current.push((sig.p_model - (won ? 1 : 0)) ** 2)
      returnsRef.current.push(pnl / sig.kelly.size)

      // Open real paper position — skip duplicates
      if (source === 'live' && !alreadyOpen) {
        savePosition({
          marketId: sig.market_id,
          polyId: sig.polyId,
          kalshiTicker: sig.kalshiTicker,
          platform: sig.platform,
          title: sig.title,
          direction: sig.direction,
          pModel: sig.p_model,
          pMarket: sig.p_market,
          size: sig.kelly.size,
          edge: sig.edge,
          endDate: sig.endDate,
        })
        openPositionIds.add(sig.market_id) // prevent duplicates within same batch
      }
    }

    portfolioRef.current = +(portfolioRef.current + pnlDelta).toFixed(2)
    setPortfolio(portfolioRef.current)
    setSessionPnL(+(portfolioRef.current - INITIAL_BANKROLL).toFixed(2))
    setWins(winsRef.current)
    setTotalTrades(totalRef.current)
    setBrierScores([...brierRef.current])
    setReturns([...returnsRef.current])
    setTrades(prev => [...newTrades.reverse(), ...prev].slice(0, 200))
    setChartData(prev => [...prev, { t: currentTimestamp(), v: portfolioRef.current }])

    if (source === 'live') {
      setPaperPositions(getPositions())
    }

    return pnlDelta
  }

  /** Single pipeline run — full SCAN → PREDICT → EXECUTE → COMPOUND */
  async function runPipeline() {
    if (running) return
    setRunning(true)
    stopRef.current = false
    setSignals([])

    try {
      const { enriched, source } = await fetchAndPredict()

      // ── EXECUTE ──
      setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'active' })
      const tradeable = enriched.filter(s => s.kelly.size > 0)
      addLog('cyan', `▶ EXECUTE · opening ${tradeable.length} position(s)...`)
      await delay(800)
      if (stopRef.current) throw new Error('STOPPED')

      const pnlDelta = executeRound(enriched, source)
      const sign = pnlDelta >= 0 ? '+' : ''
      const paperNote = source === 'live' && tradeable.length > 0 ? ' · paper positions saved ✓' : ''
      addLog('green', `✓ EXECUTE · ${tradeable.length} fill(s) · sim P&L ${sign}$${pnlDelta.toFixed(2)}${paperNote}`)
      setApiCost(c => +(c + 0.001).toFixed(4))
      setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'done' })

      // ── COMPOUND ──
      setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'done', COMPOUND: 'active' })
      addLog('cyan', '▶ COMPOUND · recomputing metrics...')
      await delay(500)
      if (stopRef.current) throw new Error('STOPPED')
      const wr = totalRef.current > 0 ? (winsRef.current / totalRef.current * 100).toFixed(1) : '—'
      addLog('green', `✓ COMPOUND · portfolio $${portfolioRef.current.toFixed(2)} · win rate ${wr}% ✓`)
      setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'done', COMPOUND: 'done' })

    } catch (e) {
      if (e.message === 'STOPPED') addLog('amber', '⚠ Pipeline stopped by user')
      else addLog('amber', `⚠ Pipeline error: ${e.message?.slice(0, 60)}`)
    } finally {
      setRunning(false)
      setBatchProgress(null)
    }
  }

  /**
   * Batch pipeline — fetches markets + Claude ONCE, then re-rolls outcomes N times.
   * Opens paper positions (skipping duplicates). Runs until N complete or Stop pressed.
   */
  async function runBatch(n) {
    if (running) return
    setRunning(true)
    stopRef.current = false
    setBatchProgress({ current: 0, total: n })
    setSignals([])

    try {
      // Phase 1: scan + predict (runs once for the whole batch)
      addLog('cyan', `▶ BATCH ×${n} · scanning markets and detecting edges...`)
      const { enriched, source } = await fetchAndPredict()

      const tradeable = enriched.filter(s => s.kelly.size > 0)
      if (tradeable.length === 0) {
        addLog('amber', `⚠ BATCH · no edges found — nothing to trade`)
        return
      }
      addLog('cyan', `▶ BATCH · ${tradeable.length} signal(s) · running ${n} rounds...`)

      // Phase 2: execute N rounds against the same signals
      let completed = 0
      let totalPnL = 0

      for (let i = 0; i < n; i++) {
        if (stopRef.current) break
        setBatchProgress({ current: i + 1, total: n })

        setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'active' })
        await delay(120) // breath for UI to paint

        const pnlDelta = executeRound(enriched, source, i)
        totalPnL += pnlDelta
        completed++

        setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'done', COMPOUND: 'done' })
      }

      const sign = totalPnL >= 0 ? '+' : ''
      const wr = totalRef.current > 0 ? (winsRef.current / totalRef.current * 100).toFixed(1) : '—'
      const brier = brierRef.current.length > 0
        ? (brierRef.current.reduce((a, b) => a + b, 0) / brierRef.current.length).toFixed(3) : '—'
      addLog('green', `✓ BATCH COMPLETE · ${completed} rounds · net sim P&L ${sign}$${totalPnL.toFixed(2)}`)
      addLog('grey', `  total trades: ${totalRef.current} · win rate: ${wr}% · brier: ${brier} · portfolio: $${portfolioRef.current.toFixed(2)}`)

    } catch (e) {
      if (e.message === 'STOPPED') addLog('amber', `⚠ Batch stopped by user`)
      else addLog('amber', `⚠ Batch error: ${e.message?.slice(0, 60)}`)
    } finally {
      setRunning(false)
      setBatchProgress(null)
    }
  }

  // ── AUTO-PILOT ──────────────────────────────────────────────────────────────
  const [autopilot, setAutopilot] = useState(false)
  const [autopilotInterval, setAutopilotInterval] = useState(45) // seconds between runs
  const [autopilotRuns, setAutopilotRuns] = useState(0)
  const autopilotRef = useRef(null)
  const autopilotActiveRef = useRef(false)

  async function autopilotCycle() {
    if (!autopilotActiveRef.current) return
    try {
      // Fetch fresh markets + Claude predictions
      const { enriched, source } = await fetchAndPredict()

      // Execute
      setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'active' })
      const tradeable = enriched.filter(s => s.kelly.size > 0)
      addLog('cyan', `▶ AUTO · executing ${tradeable.length} fill(s)...`)
      await delay(400)

      if (!autopilotActiveRef.current) return

      const pnlDelta = executeRound(enriched, source)
      const sign = pnlDelta >= 0 ? '+' : ''
      addLog('green', `✓ AUTO · ${tradeable.length} fill(s) · P&L ${sign}$${pnlDelta.toFixed(2)} · portfolio $${portfolioRef.current.toFixed(2)}`)

      setStepStates({ SCAN: 'done', RESEARCH: 'done', PREDICT: 'done', EXECUTE: 'done', COMPOUND: 'done' })
      setAutopilotRuns(r => r + 1)
    } catch (e) {
      if (e.message !== 'STOPPED') addLog('amber', `⚠ AUTO · ${e.message?.slice(0, 60)}`)
    }

    // Schedule next cycle
    if (autopilotActiveRef.current) {
      autopilotRef.current = setTimeout(autopilotCycle, autopilotInterval * 1000)
    }
  }

  function startAutopilot() {
    if (running) return
    setRunning(true)
    stopRef.current = false
    autopilotActiveRef.current = true
    setAutopilot(true)
    setAutopilotRuns(0)
    addLog('cyan', `▶ AUTOPILOT · started · cycle every ${autopilotInterval}s`)
    autopilotCycle()
  }

  function stopAutopilot() {
    autopilotActiveRef.current = false
    stopRef.current = true
    setAutopilot(false)
    setRunning(false)
    if (autopilotRef.current) { clearTimeout(autopilotRef.current); autopilotRef.current = null }
    addLog('amber', `⚠ AUTOPILOT · stopped after ${autopilotRuns} cycle(s)`)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autopilotActiveRef.current = false
      if (autopilotRef.current) clearTimeout(autopilotRef.current)
    }
  }, [])

  // Derived metrics
  const winRate = totalTrades > 0 ? `${(wins / totalTrades * 100).toFixed(1)}%` : '—'
  const winRateClass = totalTrades === 0 ? 'kpi-neutral' : wins / totalTrades >= 0.6 ? 'kpi-target-ok' : 'kpi-target-bad'

  const brier = brierScores.length > 0
    ? (brierScores.reduce((a, b) => a + b, 0) / brierScores.length).toFixed(3)
    : '—'
  const brierClass = brierScores.length === 0 ? 'kpi-neutral' :
    parseFloat(brier) < 0.25 ? 'kpi-target-ok' : 'kpi-target-bad'

  let sharpe = '—'
  let sharpeClass = 'kpi-neutral'
  if (returns.length > 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length)
    if (std > 0) {
      const s = (mean / std * Math.sqrt(returns.length)).toFixed(2)
      sharpe = s
      sharpeClass = parseFloat(s) >= 2 ? 'kpi-target-ok' : 'kpi-target-warn'
    }
  }

  const pnlClass = sessionPnL >= 0 ? 'kpi-positive' : 'kpi-negative'
  const apiClass = apiCost > 4 ? 'kpi-target-bad' : apiCost > 3 ? 'kpi-target-warn' : 'kpi-neutral'

  const currentValue = portfolioRef.current
  const lineColor = currentValue >= INITIAL_BANKROLL ? '#00ff87' : '#ff3b5c'

  return (
    <>
      <style>{CSS}</style>
      <div className="scanlines" aria-hidden="true" />

      <div className="dashboard">
        {/* HEADER */}
        <header className="header">
          <div className="logo">
            mercado-bot<span className="logo-dev">-dev</span>
          </div>
          <div className="badge badge-sim">◉ SIMULACIÓN</div>
          <span className={`source-badge ${marketSource === 'live' ? 'source-live' : 'source-mock'}`}
            title={marketSource === 'live' ? `${liveMarkets?.length || 0} markets from Polymarket/Kalshi` : 'Hardcoded mock markets — run pipeline to fetch live'}>
            {marketSource === 'live' ? `⬤ LIVE · ${liveMarkets?.length || 0} mkts` : '○ MOCK'}
          </span>
          <div
            className="badge badge-locked"
            title="Live trading requires US entity on Kalshi"
          >
            🔒 LIVE · LOCKED
          </div>
          <div className="header-right">
            <span className="geo-status">
              MX <span className="geo-ok">✓</span> · Kalshi DEMO · Polymarket READ-ONLY
            </span>
            <span className="clock">{clock} MX</span>
          </div>
        </header>

        {/* KPI ROW */}
        <div className="kpi-row">
          <KPICard
            label="Portfolio Value"
            value={`$${portfolio.toFixed(2)}`}
            sub="started at $500.00"
            valueClass="kpi-neutral"
          />
          <KPICard
            label="Session P&L"
            value={`${sessionPnL >= 0 ? '+' : ''}$${Math.abs(sessionPnL).toFixed(2)}`}
            sub={sessionPnL >= 0 ? 'above baseline' : 'below baseline'}
            valueClass={pnlClass}
          />
          <KPICard
            label="Win Rate"
            value={winRate}
            sub="target ≥60%"
            valueClass={winRateClass}
          />
          <KPICard
            label="Brier Score"
            value={brier}
            sub="target <0.250"
            valueClass={brierClass}
          />
          <KPICard
            label="Sharpe Ratio"
            value={sharpe}
            sub="target ≥2.0"
            valueClass={sharpeClass}
          />
          <KPICard
            label="API Cost"
            value={`$${apiCost.toFixed(3)}`}
            sub="cap $5.00 dev"
            valueClass={apiClass}
          />
        </div>

        {/* PIPELINE BAR */}
        <div className="pipeline-bar">
          <span className="pipeline-label">Pipeline</span>
          <div className="pipeline-steps">
            {PIPELINE_STEPS.map((step, i) => (
              <React.Fragment key={step}>
                <div className="step-item">
                  <div className={`step-dot ${stepStates[step] || ''}`} />
                  <span className={`step-name ${stepStates[step] || ''}`}>{step}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && <span className="step-arrow">→</span>}
              </React.Fragment>
            ))}
          </div>
          <div className="pipeline-controls">
            {batchProgress && (
              <span style={{ color: 'var(--cyan)', fontSize: 11, letterSpacing: '0.06em' }}>
                RUN {batchProgress.current} / {batchProgress.total}
              </span>
            )}
            <button
              className="btn btn-run"
              onClick={runPipeline}
              disabled={running}
            >
              {running && !batchProgress ? '⟳ Running...' : '▶ Run ×1'}
            </button>
            <button
              className="btn btn-batch"
              onClick={() => runBatch(10)}
              disabled={running}
            >
              ×10
            </button>
            <button
              className="btn btn-batch"
              onClick={() => runBatch(30)}
              disabled={running}
            >
              ×30
            </button>
            <button
              className="btn btn-batch"
              onClick={() => runBatch(50)}
              disabled={running}
            >
              ×50
            </button>
            {!autopilot ? (
              <button
                className="btn btn-run"
                onClick={startAutopilot}
                disabled={running}
                style={!running ? { borderColor: 'var(--green)', color: 'var(--green)', background: 'rgba(0,255,135,0.08)' } : {}}
              >
                ⟳ Auto
              </button>
            ) : (
              <span style={{ color: 'var(--green)', fontSize: 11, letterSpacing: '0.06em', animation: 'pulse-cyan 1.5s infinite' }}>
                AUTOPILOT · {autopilotRuns} cycles
              </span>
            )}
            <button
              className="btn btn-stop"
              onClick={() => { autopilot ? stopAutopilot() : (stopRef.current = true) }}
              disabled={!running}
            >
              ■ Stop
            </button>
            <button
              className="btn btn-reset"
              onClick={() => {
                if (!confirm('Reset all simulation data?')) return
                localStorage.removeItem(SIM_KEY)
                portfolioRef.current = INITIAL_BANKROLL
                winsRef.current = 0; totalRef.current = 0
                brierRef.current = []; returnsRef.current = []
                setPortfolio(INITIAL_BANKROLL); setSessionPnL(0)
                setApiCost(0); setWins(0); setTotalTrades(0)
                setBrierScores([]); setReturns([]); setTrades([])
                setChartData(generateHistory(28, INITIAL_BANKROLL))
                setPipelineLog([{ type: 'grey', text: 'Simulation reset ↺' }])
              }}
              disabled={running}
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main-content">
          {/* Chart */}
          <div className="chart-section">
            <div className="section-title">Portfolio Value</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1e35" />
                <XAxis
                  dataKey="t"
                  tick={{ fill: '#606888', fontSize: 10, fontFamily: 'Share Tech Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: '#1a1e35' }}
                  interval={Math.floor(chartData.length / 6)}
                />
                <YAxis
                  tick={{ fill: '#606888', fontSize: 10, fontFamily: 'Share Tech Mono' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={500} stroke="#3a4060" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: lineColor }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Kelly */}
          <div className="kelly-section">
            <KellyWidget />
          </div>
        </div>

        {/* BOTTOM GRID */}
        <div className="bottom-grid">
          {/* Signals */}
          <div className="signals-section">
            <div className="section-title">Signals ({signals.length})</div>
            {signals.length === 0 ? (
              <div className="empty-state">No signals yet · run the pipeline to generate predictions</div>
            ) : (
              <table className="signals-table">
                <thead>
                  <tr>
                    <th>MARKET</th>
                    <th>P_MODEL</th>
                    <th>P_MKT</th>
                    <th>EDGE</th>
                    <th>DIR</th>
                    <th>BET SIZE</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => (
                    <tr key={s.market_id}>
                      <td>
                        <div className="signal-title">{s.title}</div>
                        <div className={`platform-badge`}>{s.platform}</div>
                      </td>
                      <td>{(s.p_model * 100).toFixed(0)}%</td>
                      <td>{(s.p_market * 100).toFixed(0)}%</td>
                      <td className={s.edge >= 0 ? 'edge-pos' : 'edge-neg'}>
                        {s.edge >= 0 ? '+' : ''}{(s.edge * 100).toFixed(1)}%
                      </td>
                      <td>
                        <span className={s.direction === 'yes' ? 'dir-yes' : 'dir-no'}>
                          {s.direction?.toUpperCase()}
                        </span>
                      </td>
                      <td className="bet-size">
                        {s.kelly.size > 0 ? `$${s.kelly.size.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Trade Log */}
          <div className="tradelog-section">
            <div className="section-title">Trade Log ({trades.length})</div>
            {trades.length === 0 ? (
              <div className="empty-state">No trades yet</div>
            ) : (
              <div className="trade-log">
                {trades.map((t, i) => (
                  <div key={i} className="trade-entry">
                    <div className="trade-dot" style={{ background: t.won ? 'var(--green)' : 'var(--red)' }} />
                    <span className="trade-time">{t.time}</span>
                    <span className="trade-title">{t.title}</span>
                    <span className={`trade-pnl ${t.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>
                      {t.pnl >= 0 ? '+' : ''}{fmtCurrency(t.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Pipeline Log + Risk Monitor */}
          <div className="sidebar-section">
            <div>
              <div className="section-title">Pipeline Log</div>
              <div className="pipeline-log">
                {pipelineLog.map((entry, i) => (
                  <div key={i} className={`log-entry log-${entry.type}`}>
                    <div className="log-dot" />
                    <span className="log-text">{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <RiskMonitor
              portfolio={portfolio}
              apiCost={apiCost}
              trades={totalTrades}
            />
          </div>
        </div>

        {/* LIVE PAPER POSITIONS */}
        <div className="positions-strip">
          <div className="section-title">
            Live Paper Positions
            <span className={`source-badge ${marketSource === 'live' ? 'source-live' : 'source-mock'}`}>
              {marketSource === 'live' ? '⬤ LIVE DATA' : '○ MOCK DATA'}
            </span>
          </div>

          {paperPositions.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'left', padding: '8px 0' }}>
              No paper positions yet · run the pipeline with live market data to place real paper trades
            </div>
          ) : (
            <>
              <div className="positions-summary">
                <span className="ps-item">Open: <span className="ps-val">{paperPositions.filter(p => !p.resolved).length}</span></span>
                <span className="ps-item">Settled: <span className="ps-val">{paperPositions.filter(p => p.resolved).length}</span></span>
                <span className="ps-item">Real P&L:{' '}
                  <span className={realPnL >= 0 ? 'ps-pos' : 'ps-neg'}>
                    {realPnL >= 0 ? '+' : ''}${realPnL.toFixed(2)}
                  </span>
                </span>
                <span className="ps-item" style={{ color: 'var(--dim)', fontSize: 10 }}>
                  Positions persist across sessions · resolution checked on each scan
                </span>
              </div>
              <div className="positions-grid">
                {paperPositions.slice(0, 20).map(pos => {
                  const cardClass = !pos.resolved ? 'pending'
                    : pos.pnl >= 0 ? 'resolved-win' : 'resolved-loss'
                  const daysOpen = Math.ceil((Date.now() - new Date(pos.openedAt)) / (1000 * 86400))
                  const daysToEnd = pos.endDate
                    ? Math.max(0, Math.ceil((new Date(pos.endDate) - Date.now()) / (1000 * 86400)))
                    : null
                  return (
                    <div key={pos.id} className={`position-card ${cardClass}`}>
                      <div className="pos-title">{pos.title}</div>
                      <div className="pos-meta">
                        <span className={`pos-badge pos-badge-${pos.direction === 'yes' ? 'yes' : 'no'}`}>
                          {pos.direction?.toUpperCase()}
                        </span>
                        <span className={`pos-badge pos-badge-${pos.platform === 'polymarket' ? 'poly' : 'kals'}`}>
                          {pos.platform}
                        </span>
                        <span className="pos-size">${pos.size?.toFixed(2)}</span>
                      </div>
                      {pos.resolved ? (
                        <div className={`pos-pnl ${pos.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl?.toFixed(2)} · {pos.outcome?.toUpperCase()} resolved
                        </div>
                      ) : (
                        <div className="pos-pending">
                          ⏳ PENDING · {daysOpen}d open{daysToEnd !== null ? ` · ${daysToEnd}d left` : ''}
                        </div>
                      )}
                      <div className="pos-date">{new Date(pos.openedAt).toLocaleDateString('en-MX')}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <span>mercado-bot-dev · janus-ia · SIMULATION_MODE=true</span>
        <span className="footer-right">
          MX geo-ok · Kalshi DEMO ✓ · Polymarket read-only ✓ · Live trading: requires US entity
        </span>
      </footer>
    </>
  )
}
