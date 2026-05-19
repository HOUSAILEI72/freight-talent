# Terminal Responsive Scale System — Design Spec (v2)

**Date:** 2026-05-17  
**Scope:** Terminal UI pages only (`TerminalLayout.jsx` → `.terminal-shell`)  
**Goal:** Make the Terminal UI visually compact on 13" screens and comfortably large on 27" screens at 100% browser zoom, without touching global CSS, without CSS/JS zoom hacks, and without breaking fixed-position elements.

---

## 1. Core Architecture

### Scale anchor: `--terminal-rem-base` on `.terminal-shell`

`.terminal-shell` gets a `font-size` driven by `--terminal-rem-base`. Four viewport breakpoints map screen widths to an absolute pixel size:

| Viewport width | `--terminal-rem-base` | Context |
|---|---|---|
| `≤ 1440px` | `13px` | 13" laptops at 100% |
| `1441–1919px` | `14px` | standard desktop (baseline) |
| `1920–2559px` | `15px` | 24"–27" 1080p/1440p |
| `≥ 2560px` | `16px` | 27" 4K / large monitors |

Only `--terminal-rem-base` changes at each breakpoint. All derived sizes update automatically via `calc()`.

`html`, `body`, `:root` font-size are never touched.

### Why `calc(var(--terminal-rem-base) * N)` — not bare `em`

`em` is relative to the **current element's inherited font-size**, which compounds across nested elements. A `0.857em` token applied inside a component that is itself styled at `0.857em` would compute to `0.734em` — 15% too small.

Instead, all `--t-text-*` tokens are defined as `calc(var(--terminal-rem-base) * N)`. This always resolves to an absolute pixel value relative to the terminal scale variable, never to an ancestor font-size. Result: no compounding, no surprises.

### `fixed` elements are safe (no zoom used)

We are NOT using CSS `zoom` or `transform: scale()`. A `font-size` change on `.terminal-shell` does NOT affect:
- The viewport coordinate system
- `position: fixed` layout (top / right / bottom / left are viewport-relative)
- `position: absolute` relative to viewport
- z-index stacking contexts
- Dropdown / modal / popover / tooltip portals

Fixed elements **do** inherit `font-size` through the DOM tree (they live inside `.terminal-shell` in React's render tree), so `em`-valued size properties (width, height, padding) on those elements will correctly scale with `--terminal-rem-base`. Their **positions** do not.

---

## 2. Token Migration

### `--t-text-*` — move to `.terminal-shell`, rewrite as `calc()`

**Remove from `:root`:**
```css
/* DELETE these lines from :root */
--t-text-xs:   0.75rem;
--t-text-sm:   0.875rem;
--t-text-base: 0.9375rem;
--t-text-md:   1rem;
--t-text-lg:   1.25rem;
--t-text-xl:   1.75rem;
```

**Add to `.terminal-shell` (terminal.css ~line 169):**
```css
.terminal-shell {
  /* ── Scale anchor ── */
  --terminal-rem-base: 14px;          /* overridden per breakpoint below */
  font-size: var(--terminal-rem-base);

  /* ── Scaled typography tokens ── */
  --t-text-xs:   calc(var(--terminal-rem-base) * 0.7857);  /* ≈11px @ 14px */
  --t-text-sm:   calc(var(--terminal-rem-base) * 0.8571);  /* ≈12px @ 14px */
  --t-text-base: var(--terminal-rem-base);                 /* =14px @ 14px */
  --t-text-md:   calc(var(--terminal-rem-base) * 1.0714);  /* ≈15px @ 14px */
  --t-text-lg:   calc(var(--terminal-rem-base) * 1.1429);  /* ≈16px @ 14px */
  --t-text-xl:   calc(var(--terminal-rem-base) * 1.2857);  /* ≈18px @ 14px */
}
```

### Breakpoint rules (append to terminal.css)

```css
@media (max-width: 1440px) {
  .terminal-shell { --terminal-rem-base: 13px; }
}
@media (min-width: 1441px) and (max-width: 1919px) {
  .terminal-shell { --terminal-rem-base: 14px; }
}
@media (min-width: 1920px) and (max-width: 2559px) {
  .terminal-shell { --terminal-rem-base: 15px; }
}
@media (min-width: 2560px) {
  .terminal-shell { --terminal-rem-base: 16px; }
}
```

### Spacing tokens — update to `calc()`

Convert layout-sizing tokens to scale with `--terminal-rem-base`:

```css
.terminal-shell {
  --t-filter-sidebar-width: clamp(
    calc(var(--terminal-rem-base) * 15),   /* ≈195px @ 13px */
    18vw,
    calc(var(--terminal-rem-base) * 20)    /* ≈280px @ 14px */
  );
  --t-conv-list-width: clamp(
    calc(var(--terminal-rem-base) * 14),
    17vw,
    calc(var(--terminal-rem-base) * 18)
  );
  --t-dock-width: clamp(
    calc(var(--terminal-rem-base) * 14),
    16vw,
    calc(var(--terminal-rem-base) * 17)
  );
  --t-detail-panel-width: clamp(
    calc(var(--terminal-rem-base) * 22),
    28vw,
    calc(var(--terminal-rem-base) * 34)
  );
  --t-page-h-pad: clamp(
    calc(var(--terminal-rem-base) * 0.857),
    2vw,
    calc(var(--terminal-rem-base) * 1.714)
  );
}
```

---

## 3. Priority CSS Conversions

Convert the following in `terminal.css` using `calc(var(--terminal-rem-base) * N)` or `var(--t-text-*)`. Do NOT mechanically replace all `px`.

### 3a. Page containers
```css
/* Horizontal padding */
padding-inline: var(--t-page-h-pad);

/* Section gaps */
gap: calc(var(--terminal-rem-base) * 1);       /* ≈14px */
gap: calc(var(--terminal-rem-base) * 1.143);   /* ≈16px */
```

### 3b. Card components
```css
padding: calc(var(--terminal-rem-base) * 1) calc(var(--terminal-rem-base) * 1.143);
min-height: calc(var(--terminal-rem-base) * 5.714);  /* ≈80px */
```

### 3c. Input / field heights
```css
height: calc(var(--terminal-rem-base) * 2.286);   /* ≈32px — standard input */
height: calc(var(--terminal-rem-base) * 2.571);   /* ≈36px — large input */
min-height: calc(var(--terminal-rem-base) * 2);   /* ≈28px — compact input */
padding-inline: calc(var(--terminal-rem-base) * 0.857);
```

### 3d. Button heights
```css
height: calc(var(--terminal-rem-base) * 2);        /* ≈28px — pill/small */
height: calc(var(--terminal-rem-base) * 2.286);    /* ≈32px — standard */
height: calc(var(--terminal-rem-base) * 2.571);    /* ≈36px — large */
padding-inline: calc(var(--terminal-rem-base) * 0.571);  /* ≈8px — pill */
```

### 3e. Typography — section / field labels
```css
.terminal-field-label,
.terminal-section-label {
  font-size: var(--t-text-xs);       /* ≈11px, scales with terminal base */
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--t-text-muted);
}
```

### 3f. Dashboard / chart elements
```css
/* Stat numbers */
font-size: calc(var(--terminal-rem-base) * 2);       /* ≈28px */
font-size: calc(var(--terminal-rem-base) * 2.571);   /* ≈36px */

/* Chart axis labels */
font-size: var(--t-text-xs);

/* Chart section header */
font-size: var(--t-text-sm);
```

### 3g. CandidatePool card rows
```css
min-height: calc(var(--terminal-rem-base) * 5.143);  /* ≈72px */

/* Status pill */
height: calc(var(--terminal-rem-base) * 1.571);      /* ≈22px */
padding-inline: calc(var(--terminal-rem-base) * 0.571);
```

### 3h. Numeric / tabular data
```css
font-variant-numeric: tabular-nums;   /* add to stat values and numeric columns */
```

---

## 4. Values NOT to Convert (keep `px`)

| Value type | Examples | Reason |
|---|---|---|
| Hairline borders | `border: 1px`, `border-width: 1px` | Physical pixel — never scale |
| Box shadows | `box-shadow: 0 4px 16px ...` | Viewport-relative visual, not layout |
| micro adjustments | `transform: translateY(1px)`, `top: -2px` | Sub-pixel alignment |
| Icon stroke / size | `strokeWidth={1.5}`, `width={16}` | Icon grid integrity |
| `border-radius` ≤ 6px | `border-radius: 4px`, `6px` | Perceptually invisible at small values |
| Positioning on `fixed` elements | `bottom: 24`, `right: rightOffset` | Viewport-relative coords, not layout |
| `z-index` | `zIndex: 8200` | Unitless stacking, not dimensional |

---

## 5. Chat Window (CandidateMiniChatWindow.jsx)

### Sizing — replace hard-coded `380 × 480` with:

```js
// Width: em resolves relative to .terminal-shell font-size via DOM inheritance
// 26em @ 13px = 338px | 14px = 364px | 15px = 390px → clamped at 380
width:     'clamp(320px, 26em, 380px)',
maxWidth:  'calc(100vw - 3em)',

// 34em @ 13px = 442px | 14px = 476px | 15px = 510px → clamped at 480
height:    'clamp(380px, 34em, 480px)',
maxHeight: 'calc(100vh - 3em)',
```

### `bottom` / `right` overflow check

`right: rightOffset` is computed by `ResizeObserver` tracking the dock's left edge. Verify:

| Viewport | Dock state | Expected rightOffset | Chat window right edge |
|---|---|---|---|
| 1280px (13") | collapsed (36px wide) | ≈ 36px | ≈ 36 + 338 = 374px — fits in 1280 ✓ |
| 1280px (13") | expanded (~200px) | ≈ 200px | ≈ 200 + 338 = 538px — fits ✓ |
| 2560px (27") | expanded (~240px) | ≈ 240px | ≈ 240 + 380 = 620px — fits ✓ |

`bottom: 24` (px) stays as-is — viewport-relative anchor.

On narrow mobile (< 480px, dock hidden): `rightOffset` falls back to `DEFAULT_RIGHT = 52`. With `maxWidth: calc(100vw - 3em)` ≈ `calc(100vw - 39px)` at 13px base, the window is safely constrained.

---

## 6. Fixed / Portal Components — Verification List

| Component | File | Type | Test for |
|---|---|---|---|
| CandidateMiniChatWindow | `src/features/candidatePool/components/CandidateMiniChatWindow.jsx` | fixed | Correct size at all breakpoints, no overflow |
| InviteModal | `src/components/ui/InviteModal.jsx` | portal | Centered, backdrop full-screen, not clipped |
| CandidateChatModal | `src/features/candidatePool/components/CandidateChatModal.jsx` | modal | Centered, not clipped |
| TerminalSelect | `src/components/terminal/TerminalSelect.jsx` | dropdown/absolute | Dropdown opens below trigger, not cut off |
| Any tooltip / popover | various | absolute | Correct anchor position |

---

## 7. Regression Pages — Test Matrix

Test at **browser 100% zoom** at viewport widths: `1280px`, `1440px`, `1920px`, `2560px`.

| Page | Key checks |
|---|---|
| Employer Dashboard | Chart labels, stat numbers, card padding not cramped |
| Candidate Pool | Row height, action buttons, chat window size/position |
| Match Result | Panel widths, timeline content, candidate profile section |
| Candidate Profile | Detail panel, tag pills, education/experience spacing |
| Post Job | Form field heights, labels, section spacing |
| Messages | Conversation list width, chat area, composer height |
| Login → Terminal entry | Nav rail width, header, initial layout load |

### Pass criteria (all at 100% browser zoom)

- **1280–1440px:** visual density close to current 90% zoom — compact but readable
- **1920px:** normal desktop feel, nothing cramped
- **2560px+:** comfortable sizing close to current 150% zoom — no excessive whitespace
- `fixed` / modal / dropdown / tooltip / mini-chat: no misalignment at any breakpoint
- Right-side cards: no unexpected internal scrollbars or content jumping
- Timeline dates, bottom meta, chart titles: not edge-clipped
- Chat window: smaller than before; content (header + messages + input) not cramped

---

## 8. Out of Scope

- Public routes (Login, JobMarketplace, candidate-facing pages) — zero changes
- Tailwind color-remap block in `.terminal-mode` (lines 206-502 of terminal.css) — color only, no sizes
- Tailwind utility classes (`bg-*`, `text-*`, `rounded-*`) on public pages
- Border, shadow, icon, z-index constants
- Non-terminal routes

---

## Implementation Order

1. **Token migration** — move/rewrite `--t-text-*` into `.terminal-shell` as `calc()`, add breakpoints
2. **Spacing tokens** — update `--t-*-width` clamp values
3. **terminal.css priority conversions** — sections 3a–3h in order
4. **Chat window** — replace inline px with `clamp()`/`em` values, verify `rightOffset` logic
5. **Typography classes** — add `.terminal-field-label` / `.terminal-section-label`
6. **Smoke test** — `npx vite build --mode production`
7. **Browser regression** — 7 pages × 4 viewport widths per test matrix above
8. **Report** — list changed files, migrated values, retained px values with reasons
