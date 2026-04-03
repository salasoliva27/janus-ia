# LOOL-AI — DEEP DIVE
## B2B SaaS Virtual Try-On Widget for Mexican Optical SMEs

---

## THE PROBLEM

Independent optical stores in Mexico City have no good way to let customers try on glasses online or via WhatsApp. The stores that matter — small family-owned shops in Roma, Condesa, Polanco, Lomas — can't afford enterprise AR solutions priced in USD and built for Warby Parker-scale operations.

The customer experience gap: a potential customer browses a store's Instagram, likes a frame, but can't visualize it on their face without physically going in. Conversion is lost.

---

## THE SOLUTION

A white-label virtual try-on widget that:
1. Embeds on the store's website OR works in a WhatsApp catalog flow
2. Uses the store's actual product photos (no 3D modeling, no photoshoot)
3. Tracks faces in real-time and overlays glasses with correct scale and position
4. Has a "Agregar al carrito" button linked to the store's product URL

**The "no 3D modeling" part is the key insight.** Every competitor requires either 3D models or professional photoshoots. lool-ai uses the same product photos the store already has.

---

## TECHNOLOGY

### Widget Architecture
Two separate codebases:
1. **widget.js** — the actual product. Drop-in `<script>` tag. Uses face-api.js. Embeds on any HTML page.
2. **React app** — demo/testing environment. Uses MediaPipe FaceMesh (more accurate).

### Face Tracking (React/MediaPipe)
- MediaPipe FaceMesh: 468 landmarks
- Key landmarks used: 468 (left iris center), 473 (right iris center)
- IPD (inter-pupillary distance) calculated from iris landmarks → drives frame scale
- Rotation: facial landmarks used to calculate head tilt angle → canvas rotation
- Position: y_offset_ratio = 0.2 from nose bridge to eye center

### Smoothing
- EMA (Exponential Moving Average) with alpha = 0.3 applied to all values
- Prevents "shrink on blink" artifact — EMA carries the last good IPD value through a blink

### Canvas rendering
- devicePixelRatio-aware: canvas internal dimensions × DPR for crisp rendering on high-DPI screens
- CSS size kept at display size; canvas.width/height set to display × DPR

---

## BUSINESS MODEL

### Option A: Flat monthly fee
- ~800–1,500 MXN/month per store
- Simple. No attribution tracking needed.
- Easy for CDMX optical SME to understand and budget.

### Option B: Performance % (revenue share)
- % of sales where the widget was in the buyer journey
- Requires UTM attribution on "Agregar al carrito" button clicks
- Hard for stores without clean e-commerce tracking
- Better alignment with value delivered

**Current recommendation:** Start flat fee. Build UTM attribution in parallel as the technical foundation for a future revenue share tier.

---

## TARGET MARKET DETAIL

### Primary: Independent optical SMEs in CDMX
- Roma, Condesa: younger, trend-conscious, digitally active stores
- Polanco, Lomas: higher-end, older clientele, more formal
- Narvarte, Del Valle: mid-market, high density

### Why these neighborhoods specifically
- High foot traffic → owner is present → can close a sale in one visit
- Stores are small enough to be agile (not franchise rules blocking tech decisions)
- Digitally active enough that the owner understands WhatsApp catalog already

### Who makes the decision
The store owner. Not an IT department. Not a marketing manager. The owner.
- Pitch must be visual (demo in 60 seconds or lost)
- Price must feel MXN-native, not converted from USD
- Onboarding must be in Spanish, zero technical jargon

---

## COMPETITIVE LANDSCAPE

| Competitor | Target | Price | Language | Why it doesn't fit CDMX SMEs |
|---|---|---|---|---|
| Perfect Corp (YouCam) | Enterprise optical chains | USD enterprise | English | Requires 3D models, priced for large chains |
| Fittingbox | Optical chains, e-commerce platforms | USD enterprise | English/French | API integration, not plug-and-play for SMEs |
| Banuba | SDK for app developers | USD/integration | English | Developer tool, not an SME product |
| VARAi | E-commerce platforms | USD | English | Shopify/WooCommerce focused |
| Zakeke | E-commerce customization | USD | Multilingual | Product customizer, not AR try-on |

**The gap:** None of them speak Spanish natively, none price in MXN, none have an onboarding flow designed for a store owner with a physical store and a WhatsApp catalog.

---

## BUILD STATUS (April 2026)

### Done
- Camera + MediaPipe face mesh tracking (iris landmarks 468/473)
- Real-time glasses overlay with rotation + scale from IPD
- EMA smoothing — stable position during blinks
- High-DPI canvas (devicePixelRatio aware)
- Catalog bar with 5 demo frames (Zenni placeholder catalog)
- "Agregar al carrito" button → store product URL
- React app for demo/testing

### Pending
- UTM attribution tracking on cart button clicks
- Embeddable widget format (currently standalone React app)
- Real client catalog upload flow
- LFPDPPP compliance review

---

## LEGAL CONSIDERATIONS

### LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares)
- Facial images qualify as biometric data under LFPDPPP
- Processing biometric data requires:
  - Privacy notice (Aviso de Privacidad) displayed before camera access
  - Explicit consent
  - Data minimization (don't store what you don't need)
  - Defined retention period
- **Mitigation strategy:** Process all face data client-side only. No frames or facial data sent to server. Only purchase events and UTM data transmitted. This dramatically reduces compliance surface area.

---

## GO-TO-MARKET PLAN (Draft)

### Phase 1: First 3 pilot stores
- Visit stores in person (post-3pm CDMX)
- 60-second demo on iPad/laptop — "try on your best-selling frame right now"
- Offer 30-day free pilot in exchange for feedback
- Target Roma Norte first — highest density of digitally curious optical owners

### Phase 2: First paid tier
- Convert pilots to 800 MXN/month
- Use store owner testimonials and before/after conversion data for social proof

### Phase 3: Scale
- WhatsApp API integration for catalog-based try-on (biggest differentiator)
- Referral program: each store that refers another gets 1 month free
- Target 20+ stores before activating B2C layer (store-network effect)

---

## METRICS TO TRACK

- Stores piloting
- Stores converting to paid
- MRR
- Average session time on widget
- Cart button click rate (conversion proxy)
- UTM-attributed cart additions (once attribution is built)
