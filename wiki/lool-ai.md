---
type: project-wiki
project: lool-ai
tags: [lool-ai, ar, b2b, saas, cdmx, optical]
updated: 2026-04-13
---
# lool-ai

B2B SaaS virtual try-on widget for Mexican optical SMEs.

## Status
🔄 Build in progress — 3D pipeline next

## Key decisions
- MediaPipe FaceMesh (iris landmarks 468/473) — proven working
- 5-photo requirement for 3D model generation — quality gate
- Meshy AI for image-to-3D (free tier ~200 credits/month)
- Cloudflare R2 for .glb storage
- Three.js for rendering
- Pricing: ~800–1,500 MXN/month flat fee OR % of sales (UTM attribution needed)

## Build done
- ✅ Camera + MediaPipe face mesh tracking
- ✅ Real-time glasses overlay with rotation + scale from IPD
- ✅ EMA smoothing — no shrink on blinks
- ✅ High-DPI canvas
- ✅ Catalog bar with 5 demo frames
- ⬜ UTM attribution tracking
- ⬜ Embeddable widget format
- ⬜ Real client catalog upload flow

## Connections
- [[wiki/espacio-bosques]] — same CDMX geography, potential referral
- [[wiki/longevite]] — same high-income neighborhoods (Polanco/Lomas)
- [[agents/core/legal]] — LFPDPPP facial data flag
- [[learnings/cross-project-map]]

## Legal flag
⚠️ LFPDPPP — facial image data requires consent flow before real users
