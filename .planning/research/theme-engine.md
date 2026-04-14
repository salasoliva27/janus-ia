# Runtime Theme Engine for React Applications

**Researched:** 2026-04-13
**Confidence:** HIGH (CSS custom properties and React context are mature, well-documented patterns)

---

## 1. Architecture Decision: CSS Custom Properties as the Engine

**Use CSS custom properties (CSS variables) as the single source of truth for all theme tokens.** No CSS-in-JS runtime, no styled-components theme provider re-renders. CSS variables update instantly via `document.documentElement.style.setProperty()` and cascade naturally.

### Why This Over Alternatives

| Approach | Verdict | Why |
|----------|---------|-----|
| CSS Custom Properties | **USE THIS** | Zero re-renders, instant updates, works with Tailwind, native browser feature |
| styled-components ThemeProvider | REJECT | Re-renders entire tree on theme change, runtime CSS generation overhead |
| Emotion ThemeProvider | REJECT | Same re-render problem as styled-components |
| Chakra UI theming | REJECT (for custom) | Tied to Chakra's component library, heavy dependency for just theming |
| Tailwind + CSS vars (shadcn pattern) | **USE THIS** | Best of both worlds — utility classes reference CSS vars |

### Token Categories

Define these CSS variable groups on `:root` / `[data-theme="x"]`:

```css
:root {
  /* === COLORS (use OKLCH for perceptual uniformity) === */
  --color-bg-primary: oklch(0.13 0.02 260);
  --color-bg-secondary: oklch(0.17 0.02 260);
  --color-bg-surface: oklch(0.20 0.015 260);
  --color-text-primary: oklch(0.95 0 0);
  --color-text-secondary: oklch(0.70 0 0);
  --color-text-muted: oklch(0.50 0 0);
  --color-accent: oklch(0.75 0.18 180);       /* cyan */
  --color-accent-glow: oklch(0.75 0.18 180 / 0.4);
  --color-danger: oklch(0.65 0.20 25);
  --color-success: oklch(0.72 0.18 145);

  /* === TYPOGRAPHY === */
  --font-family-heading: 'Inter', system-ui, sans-serif;
  --font-family-body: 'Inter', system-ui, sans-serif;
  --font-family-mono: 'JetBrains Mono', monospace;
  --font-size-base: 16px;
  --font-weight-normal: 400;
  --font-weight-bold: 700;
  --line-height-base: 1.6;

  /* === SPACING === */
  --spacing-unit: 4px;
  --spacing-xs: calc(var(--spacing-unit) * 1);
  --spacing-sm: calc(var(--spacing-unit) * 2);
  --spacing-md: calc(var(--spacing-unit) * 4);
  --spacing-lg: calc(var(--spacing-unit) * 6);
  --spacing-xl: calc(var(--spacing-unit) * 8);

  /* === BORDERS & RADII === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  --border-width: 1px;
  --border-color: oklch(0.30 0.01 260);

  /* === ANIMATIONS === */
  --animation-speed: 1;          /* multiplier: 0.5 = fast, 1 = normal, 2 = slow */
  --animation-intensity: 1;      /* multiplier for glow/particle effects */
  --animation-particle-count: 50;
  --animation-glow-opacity: 0.4;
  --animation-glow-spread: 20px;
  --animation-duration-fast: calc(150ms * var(--animation-speed));
  --animation-duration-normal: calc(300ms * var(--animation-speed));
  --animation-duration-slow: calc(600ms * var(--animation-speed));

  /* === SHADOWS & EFFECTS === */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.3);
  --shadow-md: 0 4px 12px oklch(0 0 0 / 0.4);
  --glow-accent: 0 0 var(--animation-glow-spread) var(--color-accent-glow);
}
```

### Tailwind Integration

Map CSS vars to Tailwind in `tailwind.config.ts` (v3) or `@theme` directive (v4):

```css
/* Tailwind v4 with @theme */
@theme {
  --color-bg-primary: var(--color-bg-primary);
  --color-accent: var(--color-accent);
  --font-heading: var(--font-family-heading);
  /* ... map all tokens */
}
```

Then use: `bg-bg-primary text-accent font-heading` etc.

---

## 2. React Context Pattern (No Re-renders)

**Key insight:** The React context should NOT store theme values. It stores the theme NAME and provides methods to switch. The actual values live in CSS variables — components read them via CSS, not via React state.

```tsx
// theme-context.tsx
import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import type { ThemePreset, ThemeOverrides } from './theme-types';
import { presets } from './theme-presets';

interface ThemeContextValue {
  activePreset: string;
  overrides: ThemeOverrides;
  setPreset: (name: string) => void;
  setToken: (token: string, value: string) => void;
  setOverrides: (overrides: ThemeOverrides) => void;
  resetToPreset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activePreset, setActivePreset] = useState(() => {
    // This runs after hydration — the blocking script already applied the theme
    return localStorage.getItem('theme-preset') || 'dark';
  });

  const [overrides, setOverridesState] = useState<ThemeOverrides>(() => {
    const saved = localStorage.getItem('theme-overrides');
    return saved ? JSON.parse(saved) : {};
  });

  // Apply a full preset to CSS variables
  const applyPreset = useCallback((preset: ThemePreset) => {
    const root = document.documentElement;
    Object.entries(preset.tokens).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, []);

  // Apply individual overrides on top of preset
  const applyOverrides = useCallback((ovr: ThemeOverrides) => {
    const root = document.documentElement;
    Object.entries(ovr).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, []);

  const setPreset = useCallback((name: string) => {
    const preset = presets[name];
    if (!preset) return;
    applyPreset(preset);
    applyOverrides(overrides);
    setActivePreset(name);
    localStorage.setItem('theme-preset', name);
  }, [overrides, applyPreset, applyOverrides]);

  const setToken = useCallback((token: string, value: string) => {
    document.documentElement.style.setProperty(`--${token}`, value);
    const newOverrides = { ...overrides, [token]: value };
    setOverridesState(newOverrides);
    localStorage.setItem('theme-overrides', JSON.stringify(newOverrides));
  }, [overrides]);

  const resetToPreset = useCallback(() => {
    const preset = presets[activePreset];
    if (!preset) return;
    applyPreset(preset);
    setOverridesState({});
    localStorage.removeItem('theme-overrides');
  }, [activePreset, applyPreset]);

  // Initial mount — preset already applied by blocking script,
  // but we need to layer overrides
  useEffect(() => {
    applyOverrides(overrides);
  }, []);

  return (
    <ThemeContext.Provider value={{
      activePreset, overrides, setPreset,
      setToken, setOverrides: (o) => {
        applyOverrides(o);
        setOverridesState(o);
        localStorage.setItem('theme-overrides', JSON.stringify(o));
      },
      resetToPreset
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
```

**Why no re-renders:** When `setToken` fires, it calls `setProperty` on the DOM directly. CSS updates instantly. The React state update for `overrides` is only for persistence and UI reflection in the editor panel — the actual visual change is immediate via CSS.

---

## 3. Avoiding Flash of Default Theme (FOUDT)

**Critical:** Place a blocking `<script>` in `index.html` before any React code loads.

```html
<!-- index.html — BEFORE the React bundle -->
<script>
  (function() {
    try {
      var preset = localStorage.getItem('theme-preset') || 'dark';
      document.documentElement.setAttribute('data-theme', preset);
      
      // Apply saved overrides immediately
      var overrides = localStorage.getItem('theme-overrides');
      if (overrides) {
        var parsed = JSON.parse(overrides);
        var root = document.documentElement.style;
        for (var key in parsed) {
          root.setProperty('--' + key, parsed[key]);
        }
      }
    } catch(e) {}
  })();
</script>
```

Then in your CSS, define presets via `[data-theme]` selectors:

```css
[data-theme="dark"] {
  --color-bg-primary: oklch(0.13 0.02 260);
  /* ... all dark tokens */
}

[data-theme="midnight"] {
  --color-bg-primary: oklch(0.08 0.03 270);
  /* ... all midnight tokens */
}

[data-theme="cyberpunk"] {
  --color-bg-primary: oklch(0.10 0.01 300);
  --color-accent: oklch(0.80 0.25 330);
  /* ... */
}

[data-theme="terminal"] {
  --color-bg-primary: oklch(0.05 0 0);
  --color-accent: oklch(0.75 0.20 140);
  --font-family-body: 'JetBrains Mono', monospace;
  /* ... */
}
```

This approach means the CSS paints correctly on the first frame. The blocking script is tiny (<500 bytes) and runs before paint.

---

## 4. Theme Preset System

```typescript
// theme-presets.ts
export interface ThemePreset {
  name: string;
  label: string;
  description: string;
  tokens: Record<string, string>;
}

export const presets: Record<string, ThemePreset> = {
  dark: {
    name: 'dark',
    label: 'Dark',
    description: 'Clean dark theme',
    tokens: {
      'color-bg-primary': 'oklch(0.13 0.02 260)',
      'color-bg-secondary': 'oklch(0.17 0.02 260)',
      'color-accent': 'oklch(0.75 0.18 180)',
      'color-text-primary': 'oklch(0.95 0 0)',
      'animation-speed': '1',
      'animation-intensity': '1',
      'animation-glow-opacity': '0.4',
      'font-family-heading': "'Inter', system-ui, sans-serif",
      // ... full token set
    }
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    description: 'Deep blue, subtle glow',
    tokens: {
      'color-bg-primary': 'oklch(0.08 0.04 270)',
      'color-accent': 'oklch(0.70 0.15 260)',
      'animation-glow-opacity': '0.6',
      'animation-glow-spread': '30px',
      // ...
    }
  },
  cyberpunk: {
    name: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon pink/magenta, high contrast',
    tokens: {
      'color-bg-primary': 'oklch(0.08 0.01 300)',
      'color-accent': 'oklch(0.75 0.25 330)',
      'animation-speed': '0.7',
      'animation-intensity': '1.5',
      'animation-particle-count': '80',
      'animation-glow-opacity': '0.7',
      // ...
    }
  },
  terminal: {
    name: 'terminal',
    label: 'Terminal',
    description: 'Monospace, green on black',
    tokens: {
      'color-bg-primary': 'oklch(0.05 0 0)',
      'color-accent': 'oklch(0.75 0.20 140)',
      'font-family-body': "'JetBrains Mono', monospace",
      'font-family-heading': "'JetBrains Mono', monospace",
      'radius-sm': '0px',
      'radius-md': '2px',
      'radius-lg': '4px',
      'animation-speed': '0.5',
      // ...
    }
  }
};
```

**Extending presets:** Users start from a preset, then override individual tokens. The overrides layer on top. "Reset" goes back to the base preset.

---

## 5. Theme Editor UI Pattern

The editor is a side panel or modal with these sections:

### Components to use

| Component | Library | Purpose |
|-----------|---------|---------|
| Color picker | `react-colorful` (3KB gzip) | Lightweight, accessible, no deps |
| Font selector | Custom `<select>` | Load from Google Fonts or local set |
| Sliders | Native `<input type="range">` or Radix Slider | Animation speed, intensity, spacing |
| Preset cards | Custom | Visual preview thumbnails |

**react-colorful over react-color:** react-color is 14KB gzip and unmaintained. react-colorful is 3KB, tree-shakeable, and actively maintained.

### Editor Structure

```
ThemeEditor (panel)
├── PresetSelector (grid of preset cards with mini previews)
├── ColorSection
│   ├── ColorTokenEditor (bg-primary)
│   ├── ColorTokenEditor (accent)
│   ├── ColorTokenEditor (text-primary)
│   └── ... (expandable "Advanced" for all tokens)
├── TypographySection
│   ├── FontFamilySelector (heading)
│   ├── FontFamilySelector (body)
│   ├── FontSizeSlider (base size)
│   └── FontWeightSelector
├── SpacingSection
│   ├── SpacingUnitSlider (base unit: 2px-8px)
│   └── BorderRadiusSlider
├── AnimationSection
│   ├── SpeedSlider (0.25x - 3x)
│   ├── IntensitySlider (0 - 2x)
│   ├── ParticleCountSlider (0 - 200)
│   ├── GlowOpacitySlider (0 - 1)
│   └── GlowSpreadSlider (0 - 60px)
└── Actions
    ├── ResetToPreset button
    ├── Export JSON button
    └── Import JSON button
```

### Live Preview Pattern

Since all values are CSS variables, changes are instant — every component on the page IS the live preview. No separate preview panel needed. The editor just calls `setToken()` and the entire app updates in real time.

For the preset selector, render small thumbnail divs that apply each preset's accent color as background, giving a visual hint.

---

## 6. Animation Customization via CSS Variables

The key insight: animation CSS references variables, so changing the variable changes the animation live.

```css
/* Particles read from CSS vars */
.particle {
  animation-duration: calc(3s * var(--animation-speed));
  opacity: calc(0.3 * var(--animation-intensity));
}

/* Glow effects */
.glow-element {
  box-shadow: 0 0 var(--animation-glow-spread) var(--color-accent-glow);
  opacity: var(--animation-glow-opacity);
  transition: all var(--animation-duration-normal) ease;
}

/* Reduced motion: respect user preference AND allow app-level disable */
@media (prefers-reduced-motion: reduce) {
  :root {
    --animation-speed: 0;
    --animation-intensity: 0;
    --animation-particle-count: 0;
  }
}
```

For particle count (which isn't CSS-animatable), read the variable in JS:

```typescript
function useAnimationTokens() {
  const getToken = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

  return {
    particleCount: parseInt(getToken('animation-particle-count')) || 50,
    speed: parseFloat(getToken('animation-speed')) || 1,
    intensity: parseFloat(getToken('animation-intensity')) || 1,
  };
}
```

---

## 7. localStorage Persistence Strategy

```typescript
// Storage keys
const KEYS = {
  preset: 'theme-preset',
  overrides: 'theme-overrides',
} as const;

// Save: called by ThemeProvider on every change
function persistTheme(preset: string, overrides: ThemeOverrides) {
  try {
    localStorage.setItem(KEYS.preset, preset);
    if (Object.keys(overrides).length > 0) {
      localStorage.setItem(KEYS.overrides, JSON.stringify(overrides));
    } else {
      localStorage.removeItem(KEYS.overrides);
    }
  } catch (e) {
    // localStorage full or disabled — degrade gracefully
  }
}

// Load: called by blocking script + ThemeProvider init
function loadTheme(): { preset: string; overrides: ThemeOverrides } {
  try {
    return {
      preset: localStorage.getItem(KEYS.preset) || 'dark',
      overrides: JSON.parse(localStorage.getItem(KEYS.overrides) || '{}'),
    };
  } catch {
    return { preset: 'dark', overrides: {} };
  }
}
```

---

## 8. Libraries NOT to Use (and Why)

| Library | Why Not |
|---------|---------|
| styled-components / emotion | Runtime CSS generation, ThemeProvider causes full tree re-renders |
| CSS Modules | No runtime switching — values baked at build time |
| Chakra UI theming | Pulls in entire component library for just theming |
| Mantine theming | Same — coupled to component library |
| react-color | 14KB, unmaintained, use react-colorful instead |
| theme-ui | Abandoned, last release 2022 |

---

## 9. Recommended Implementation Stack

| Concern | Solution |
|---------|----------|
| Token engine | CSS custom properties on `:root` |
| Utility classes | Tailwind CSS referencing CSS vars |
| React state | Minimal context (preset name + overrides only) |
| Color picker | `react-colorful` (3KB) |
| Sliders | Radix UI Slider or native `<input type="range">` |
| Preset definitions | TypeScript objects with full token maps |
| Persistence | localStorage with blocking script for hydration |
| Flash prevention | `<script>` in `<head>` before React bundle |
| Color format | OKLCH (perceptual uniformity, great for generating palettes) |
| Animation control | CSS `calc()` with speed/intensity multiplier vars |

---

## 10. Implementation Order

1. **Define token schema** — all CSS variable names and their types (color, length, number, font-family)
2. **Create presets** — dark, midnight, cyberpunk, terminal as TypeScript objects
3. **Write CSS** — `[data-theme]` selectors with all tokens, Tailwind mapping
4. **Add blocking script** — in index.html for FOUDT prevention
5. **Build ThemeProvider** — context with setPreset/setToken/resetToPreset
6. **Build ThemeEditor panel** — color pickers, sliders, font selectors
7. **Wire animations** — particles/glow read from CSS vars via calc()
8. **Add export/import** — JSON export of full theme for sharing

---

## Sources

- [shadcn/ui Theming Docs](https://ui.shadcn.com/docs/theming)
- [Shadcn + Tailwind v4 Theming](https://medium.com/@joseph.goins/theming-shadcn-with-tailwind-v4-and-css-variables-d602f6b3c258)
- [CSS Custom Properties Deep Dive](https://handoff.design/future-css/custom-properties-deep-dive.html)
- [Flash of Unstyled Dark Theme](https://webcloud.se/blog/2020-04-06-flash-of-unstyled-dark-theme/)
- [Avoiding Flash of Unthemed Code](https://www.swyx.io/avoid-fotc)
- [Theme Changer with localStorage + CSS Variables](https://dev.to/nicklasspendler/theme-changer-using-localstorage-and-css-custom-properties-variables-2c22)
- [The Perfect Theme Switch Component](https://www.aleksandrhovhannisyan.com/blog/the-perfect-theme-switch/)
- [CSS Custom Properties for Design Systems](https://www.designsystemscollective.com/when-and-why-to-use-css-custom-properties-797c75fcaae5)
- [Shadcn Theme Editor Block](https://www.shadcn.io/blocks/settings-theme-editor)
- [react-colorful](https://github.com/omgovich/react-colorful) — 3KB color picker
