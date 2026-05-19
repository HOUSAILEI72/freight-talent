# Terminal Responsive Scale System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Terminal UI visually compact on 13" screens and comfortably large on 27" screens at 100% browser zoom, with no JS zoom hacks and no impact on public pages.

**Architecture:** Add `--terminal-rem-base` custom property to `.terminal-shell`, drive all typography and layout tokens via `calc(var(--terminal-rem-base) * N)`. Breakpoints update only `--terminal-rem-base`; every derived size follows automatically. Tailwind text-size classes are remapped to scaled tokens via `.terminal-mode` overrides. `em` is used in JSX inline styles that must scale — they inherit the terminal font-size via DOM ancestry. `position: fixed` coords remain in `px` (viewport-relative, safe from font-size changes).

**Tech Stack:** Pure CSS custom properties + `calc()`, React 19 inline styles using `em`/`clamp`, no new libraries.

---

## File Map

| File | What changes |
|---|---|
| `src/styles/terminal.css` | Phases 1–3, 5: token definitions, breakpoints, Tailwind overrides, typography, spacing |
| `src/features/candidatePool/components/CandidateMiniChatWindow.jsx` | Phase 4: window size, header font-sizes |

All other files: read-only verification. No changes to JSX pages, public CSS, Tailwind config, or `html`/`body`/`:root`.

---

## Tailwind strategy (read before implementing)

| Tailwind class | Situation | Plan |
|---|---|---|
| `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl` | Fixed rem, won't scale | Phase 1: add `.terminal-mode .text-*` overrides in terminal.css |
| `bg-*`, `border-*`, `text-*` (color) | Already remapped by `.terminal-mode` color block | No change needed |
| `p-4`, `gap-3`, `h-10` etc. (spacing/height) | Won't auto-scale | Leave for now; CSS-named classes cover most visible elements |
| `rounded-*`, `flex`, `grid`, layout utils | Not dimensional or perceptually stable | No change needed |
| Font-size on non-terminal components | e.g., `JobMarketplace.jsx` | Not touched — not in `.terminal-shell` scope |

---

## Phase 1 — Terminal Scale Token System

**Files:** `src/styles/terminal.css`  
**What changes:** Add `--terminal-rem-base`, scaled `--t-text-*`, spacing tokens, control-height tokens, breakpoints, Tailwind text-size overrides.  
**What stays px:** `border-radius` tokens, rail widths, layout widths (`clamp` px bounds stay — they are structural min/max constraints).  
**Public page impact:** None.

---

### Task 1.1 — Add scale variable + typography tokens to `.terminal-shell`

**File:** `src/styles/terminal.css:169-171`

Current (lines 169–171):
```css
.terminal-shell {
  font-family: var(--t-font-ui);
}
```

- [ ] **Step 1: Replace `.terminal-shell` design-token block (lines 169–171)**

```css
/* ── Terminal shell base font + responsive scale ── */
.terminal-shell {
  font-family: var(--t-font-ui);

  /* ── Scale anchor (overridden by viewport breakpoints below) ── */
  --terminal-rem-base: 14px;
  font-size: var(--terminal-rem-base);

  /* ── Typography tokens (all scale with --terminal-rem-base) ── */
  --t-text-xs:   calc(var(--terminal-rem-base) * 0.7857);  /* ≈11px @ 14px */
  --t-text-sm:   calc(var(--terminal-rem-base) * 0.8571);  /* ≈12px @ 14px */
  --t-text-base: var(--terminal-rem-base);                 /* =14px @ 14px */
  --t-text-md:   calc(var(--terminal-rem-base) * 1.0714);  /* ≈15px @ 14px */
  --t-text-lg:   calc(var(--terminal-rem-base) * 1.1429);  /* ≈16px @ 14px */
  --t-text-xl:   calc(var(--terminal-rem-base) * 1.2857);  /* ≈18px @ 14px */

  /* ── Spacing tokens ── */
  --t-space-xs:  calc(var(--terminal-rem-base) * 0.5);     /* ≈7px  */
  --t-space-sm:  calc(var(--terminal-rem-base) * 0.857);   /* ≈12px */
  --t-space-md:  calc(var(--terminal-rem-base) * 1.143);   /* ≈16px */
  --t-space-lg:  calc(var(--terminal-rem-base) * 1.714);   /* ≈24px */
  --t-space-xl:  calc(var(--terminal-rem-base) * 2.286);   /* ≈32px */

  /* ── Control heights ── */
  --t-control-height-sm: calc(var(--terminal-rem-base) * 2);      /* ≈28px */
  --t-control-height-md: calc(var(--terminal-rem-base) * 2.286);  /* ≈32px */
  --t-control-height-lg: calc(var(--terminal-rem-base) * 2.571);  /* ≈36px */
  --t-control-height-xl: calc(var(--terminal-rem-base) * 3.143);  /* ≈44px */
}
```

- [ ] **Step 2: Build to confirm no syntax errors**

```bash
cd /Users/edy/Desktop/货代招聘 && npx vite build --mode production 2>&1 | tail -5
```
Expected: `✓ built in`

---

### Task 1.2 — Remove `--t-text-*` from `:root`

**File:** `src/styles/terminal.css:31-36`

Current (`:root` block, lines 31–36):
```css
  --t-text-xs:   0.75rem;     /* 12px */
  --t-text-sm:   0.875rem;    /* 14px */
  --t-text-base: 0.9375rem;   /* 15px — terminal default */
  --t-text-md:   1rem;        /* 16px */
  --t-text-lg:   1.25rem;     /* 20px */
  --t-text-xl:   1.75rem;     /* 28px */
```

- [ ] **Step 1: Delete those 6 lines from `:root`**

After deletion, the `:root` block should jump from `--t-letter-ui` straight to `--t-line-tight`. Verify by grepping:

```bash
grep -n "t-text-" /Users/edy/Desktop/货代招聘/src/styles/terminal.css
```
Expected: all remaining hits are inside `.terminal-shell` (not inside `:root`).

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```
Expected: `✓ built in`

---

### Task 1.3 — Add viewport breakpoints

**File:** `src/styles/terminal.css` — append after the `.terminal-shell` design-token block (after line ~190, before the scrollbar section)

- [ ] **Step 1: Insert breakpoint rules**

```css
/* ── Terminal viewport scale breakpoints ──
   Only --terminal-rem-base changes; all calc() tokens follow.
   Breakpoints target CSS viewport width at 100% browser zoom.
   13"  laptop  (≤1440px) → 13px  ≈ 0.9× of baseline
   Std  desktop (1441–1919) → 14px  = baseline
   Large desktop (1920–2559) → 15px  ≈ 1.07× of baseline
   27"  4K      (≥2560px)  → 16px  ≈ 1.14× of baseline
   ─────────────────────────────────────────────────────── */
@media (max-width: 1440px) {
  .terminal-shell { --terminal-rem-base: 13px; }
}
/* 1441–1919: uses the default 14px set on .terminal-shell itself */
@media (min-width: 1920px) and (max-width: 2559px) {
  .terminal-shell { --terminal-rem-base: 15px; }
}
@media (min-width: 2560px) {
  .terminal-shell { --terminal-rem-base: 16px; }
}
```

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 1.4 — Remap Tailwind text-size classes inside `.terminal-mode`

**File:** `src/styles/terminal.css` — add to the `.terminal-mode` scoped overrides block (after line ~219, near the existing `color: var(--t-text)` line)

- [ ] **Step 1: Add Tailwind text-size overrides**

```css
/* ── Tailwind font-size utilities → scaled terminal tokens ── */
.terminal-mode .text-xs   { font-size: var(--t-text-xs)  !important; }
.terminal-mode .text-sm   { font-size: var(--t-text-sm)  !important; }
.terminal-mode .text-base { font-size: var(--t-text-base) !important; }
.terminal-mode .text-lg   { font-size: var(--t-text-lg)  !important; }
.terminal-mode .text-xl   { font-size: var(--t-text-xl)  !important; }
.terminal-mode .text-2xl  { font-size: calc(var(--terminal-rem-base) * 1.571) !important; } /* ≈22px */
.terminal-mode .text-3xl  { font-size: calc(var(--terminal-rem-base) * 1.857) !important; } /* ≈26px */
```

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 1.5 — Commit Phase 1

- [ ] **Step 1: Commit**

```bash
git add src/styles/terminal.css
git commit -m "feat(terminal): add --terminal-rem-base responsive scale token system

- Add --terminal-rem-base (default 14px) + font-size to .terminal-shell
- Derived --t-text-xs/sm/base/md/lg/xl via calc() — scale with base
- Add --t-space-xs/sm/md/lg/xl and --t-control-height-sm/md/lg/xl
- Add viewport breakpoints: 13px@≤1440 / 14px@default / 15px@≥1920 / 16px@≥2560
- Remove --t-text-* from :root (now defined in .terminal-shell)
- Remap Tailwind text-size classes inside .terminal-mode to scaled tokens
- Zero impact outside .terminal-shell"
```

**Phase 1 report:**
- Files changed: `src/styles/terminal.css`
- px removed: `--t-text-xs/sm/base/md/lg/xl` from `:root` (6 lines)
- px retained: `border-radius`, rail widths, structural `clamp()` bounds
- Public pages: no impact (changes scoped to `.terminal-shell` / `.terminal-mode`)
- Viewport check: not yet — tokens defined, visual changes come in Phase 2+

---

## Phase 2 — Core Typography

**Files:** `src/styles/terminal.css`  
**What changes:** Replace hard-coded `font-size: 11px` (and similar) with token references; update large stat/chart values to scale; add field-label and numeric utility classes.  
**What stays px:** `font-size: 10px` on the timeline-kind badge (sub-token detail); `clamp` bounds on growth-row-value (preserve existing vw responsiveness, update only min/max).  
**Public page impact:** None.

---

### Task 2.1 — Convert `font-size: 11px` occurrences to `var(--t-text-xs)`

**File:** `src/styles/terminal.css`

Affected lines (verify with `grep -n "font-size: 11px" src/styles/terminal.css`):
- Line ~546: `.terminal-header-brand .brand-page` (inside `@media max-width:1280px`)
- Line ~631: `.terminal-growth-card-label`
- Line ~649: `.terminal-growth-row`
- Line ~1169: `.terminal-result-meta-line`

- [ ] **Step 1: Replace all four occurrences**

For each, change `font-size: 11px;` to `font-size: var(--t-text-xs);`

Run after:
```bash
grep -n "font-size: 11px" /Users/edy/Desktop/货代招聘/src/styles/terminal.css
```
Expected: 0 results (all converted).

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 2.2 — Update large chart/stat font-size clamp values

**File:** `src/styles/terminal.css`

These use `clamp(Xpx, Yvw, Zpx)`. Update min and max to `calc(var(--terminal-rem-base) * N)` while keeping the vw middle (viewport-width responsiveness preserved).

- [ ] **Step 1: Update `.terminal-growth-row-value` (line ~656)**

Current:
```css
.terminal-growth-row-value {
  font-size: clamp(20px, 1.8vw, 26px);
```
New:
```css
.terminal-growth-row-value {
  font-size: clamp(calc(var(--terminal-rem-base) * 1.429), 1.8vw, calc(var(--terminal-rem-base) * 1.857));
```

- [ ] **Step 2: Update `.terminal-growth-row-value--sm` (line ~664)**

Current:
```css
.terminal-growth-row-value--sm {
  font-size: clamp(16px, 1.4vw, 20px);
```
New:
```css
.terminal-growth-row-value--sm {
  font-size: clamp(calc(var(--terminal-rem-base) * 1.143), 1.4vw, calc(var(--terminal-rem-base) * 1.429));
```

- [ ] **Step 3: Update `.terminal-trend-card-value` (line ~989)**

Current:
```css
.terminal-trend-card-value {
  font-size: clamp(36px, 3.4vw, 54px);
```
New:
```css
.terminal-trend-card-value {
  font-size: clamp(calc(var(--terminal-rem-base) * 2.571), 3.4vw, calc(var(--terminal-rem-base) * 3.857));
```

Also update the `@media (max-width: 1440px)` override for `.terminal-trend-card-value` (line ~1019):

Current:
```css
    font-size: clamp(34px, 3.4vw, 50px);
```
New:
```css
    font-size: clamp(calc(var(--terminal-rem-base) * 2.429), 3.4vw, calc(var(--terminal-rem-base) * 3.571));
```

- [ ] **Step 4: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 2.3 — Add `.terminal-field-label` and `.terminal-section-label` utility classes

**File:** `src/styles/terminal.css` — add near end of file before the `@media (max-width: 720px)` block

- [ ] **Step 1: Append new utility classes**

```css
/* ── Terminal label utilities ── */
.terminal-field-label {
  display: block;
  font-size: var(--t-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--t-text-muted);
  line-height: var(--t-line-tight);
}

.terminal-section-label {
  display: block;
  font-size: var(--t-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--t-text-muted);
  line-height: var(--t-line-tight);
}

.terminal-numeric {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 2.4 — Commit Phase 2

- [ ] **Step 1: Commit**

```bash
git add src/styles/terminal.css
git commit -m "feat(terminal): Phase 2 — core typography tokens

- Convert font-size: 11px → var(--t-text-xs) in 4 locations
- Update growth-row-value and trend-card-value clamp() to scale with --terminal-rem-base
- Add .terminal-field-label, .terminal-section-label, .terminal-numeric utilities"
```

**Phase 2 report:**
- Files changed: `src/styles/terminal.css`
- px removed: 4× `font-size: 11px`, 4× `clamp(Xpx, …)` min/max bounds
- px retained: `font-size: 10px` on `.terminal-timeline-kind` (icon-level badge), shadow values, `clamp` vw middles
- Public pages: no impact
- Viewport check: open Dashboard in browser, resize to 1280 → 2560px; growth-card numbers and trend values should visibly scale

---

## Phase 3 — Layout Spacing / Cards / Controls

**Files:** `src/styles/terminal.css`  
**What changes:** Dashboard grid gap/padding, card padding, action bar button height, chart header gap, candidate result card row sizing. Migrate `px` → `calc(var(--terminal-rem-base) * N)` or spacing tokens.  
**What stays px:** `clamp` vw-based middles, `border: 1px`, structural `minmax(Xpx, …)` grid column bounds (changing these could break the 3-column layout logic).  
**Public page impact:** None.

---

### Task 3.1 — Dashboard body gap + padding

**File:** `src/styles/terminal.css` — `.terminal-dashboard-body` (line ~565)

- [ ] **Step 1: Update `.terminal-dashboard-body`**

Current:
```css
.terminal-dashboard-body {
  gap: clamp(10px, 1.4vh, 16px);
  padding: clamp(10px, 1.6vh, 16px) 20px;
```
New:
```css
.terminal-dashboard-body {
  gap: clamp(calc(var(--terminal-rem-base) * 0.714), 1.4vh, var(--t-space-md));
  padding: clamp(calc(var(--terminal-rem-base) * 0.714), 1.6vh, var(--t-space-md)) var(--t-space-md);
```

- [ ] **Step 2: Update `.terminal-dashboard-main` gap (line ~581)**

Current: `gap: 16px;`  
New: `gap: var(--t-space-md);`

- [ ] **Step 3: Update `.terminal-dashboard-stats-aside-wrap` gap (line ~589)**

Current: `gap: 14px;`  
New: `gap: calc(var(--terminal-rem-base) * 1);`

- [ ] **Step 4: Update `.terminal-card-grid` gap (line ~598)**

Current: `gap: 16px;`  
New: `gap: var(--t-space-md);`

- [ ] **Step 5: Update `.terminal-platform-count-grid` gap (line ~604)**

Current: `gap: 16px;`  
New: `gap: var(--t-space-md);`

- [ ] **Step 6: Update `.terminal-insights-panel` (line ~608)**

Current: `gap: 16px; padding: 16px;`  
New: `gap: var(--t-space-md); padding: var(--t-space-md);`

- [ ] **Step 7: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 3.2 — Growth card padding + label spacing

**File:** `src/styles/terminal.css`

- [ ] **Step 1: Update `.terminal-growth-card` padding (line ~623)**

Current: `padding: clamp(16px, 2vh, 24px) 22px;`  
New: `padding: clamp(var(--t-space-md), 2vh, var(--t-space-lg)) calc(var(--terminal-rem-base) * 1.571);`

- [ ] **Step 2: Update `.terminal-growth-card-label` margin (line ~629)**

Current: `margin-bottom: clamp(14px, 2vh, 26px);`  
New: `margin-bottom: clamp(calc(var(--terminal-rem-base) * 1), 2vh, calc(var(--terminal-rem-base) * 1.857));`

- [ ] **Step 3: Update `.terminal-growth-card-rows` gap (line ~640)**

Current: `gap: clamp(10px, 1.6vh, 18px);`  
New: `gap: clamp(calc(var(--terminal-rem-base) * 0.714), 1.6vh, calc(var(--terminal-rem-base) * 1.286));`

- [ ] **Step 4: Update `.terminal-growth-row` gap (line ~647)**

Current: `gap: 12px;`  
New: `gap: var(--t-space-sm);`

- [ ] **Step 5: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 3.3 — Trend card padding

**File:** `src/styles/terminal.css`

- [ ] **Step 1: Update `.terminal-trend-card` default padding (line ~964)**

Current: `padding: 18px 22px 20px;`  
New: `padding: calc(var(--terminal-rem-base) * 1.286) calc(var(--terminal-rem-base) * 1.571) calc(var(--terminal-rem-base) * 1.429);`

- [ ] **Step 2: Update `.terminal-trend-card` `@media (max-width:1440px)` padding (line ~1015)**

Current: `padding: 16px 20px 18px;`  
New: `padding: var(--t-space-md) calc(var(--terminal-rem-base) * 1.429) calc(var(--terminal-rem-base) * 1.286);`

- [ ] **Step 3: Update `.terminal-trend-card-label` margin-bottom (line ~973)**

Current: `margin-bottom: 10px;`  
New: `margin-bottom: calc(var(--terminal-rem-base) * 0.714);`

- [ ] **Step 4: Update `.terminal-trend-card-footer` gap + padding-top (line ~1000)**

Current: `gap: 5px; padding-top: 10px;`  
New: `gap: calc(var(--terminal-rem-base) * 0.357); padding-top: calc(var(--terminal-rem-base) * 0.714);`

- [ ] **Step 5: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 3.4 — Action bar button height + padding

**File:** `src/styles/terminal.css`

- [ ] **Step 1: Update `.terminal-action-bar` gap + padding (line ~762)**

Current: `gap: 12px; padding: 12px 4px 4px;`  
New: `gap: var(--t-space-sm); padding: var(--t-space-sm) calc(var(--terminal-rem-base) * 0.286) calc(var(--terminal-rem-base) * 0.286);`

- [ ] **Step 2: Update `.terminal-action-bar-btn` (line ~773)**

Current:
```css
.terminal-action-bar-btn {
  gap: 10px;
  min-height: 44px;
  padding: 8px 16px;
```
New:
```css
.terminal-action-bar-btn {
  gap: calc(var(--terminal-rem-base) * 0.714);
  min-height: var(--t-control-height-xl);
  padding: calc(var(--terminal-rem-base) * 0.571) var(--t-space-md);
```

- [ ] **Step 3: Update `@media (max-width:1280px)` action-bar-btn (line ~789)**

Current: `min-height: 40px; padding: 7px 12px;`  
New: `min-height: calc(var(--terminal-rem-base) * 2.857); padding: calc(var(--terminal-rem-base) * 0.5) var(--t-space-sm);`

- [ ] **Step 4: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 3.5 — Dashboard responsive overrides (median breakpoint gaps)

**File:** `src/styles/terminal.css` — `@media (max-width:1440px)` dashboard block (line ~669)

- [ ] **Step 1: Update 1440px block gaps**

Current (lines ~672–675):
```css
    gap: 14px;
  }
  .terminal-dashboard-stats-aside-wrap {
    gap: 12px;
```
New:
```css
    gap: calc(var(--terminal-rem-base) * 1);
  }
  .terminal-dashboard-stats-aside-wrap {
    gap: var(--t-space-sm);
```

- [ ] **Step 2: Update 1280px block (line ~680)**

Current:
```css
  .terminal-dashboard-body {
    gap: 12px;
    padding: 12px 14px;
```
New:
```css
  .terminal-dashboard-body {
    gap: var(--t-space-sm);
    padding: var(--t-space-sm) calc(var(--terminal-rem-base) * 1);
```

- [ ] **Step 3: Update 1024px + max-height blocks similarly**

Lines ~713–756: change hard-coded `gap: 10px`, `gap: 8px`, `padding: 10px` to:
- `gap: 10px` → `gap: calc(var(--terminal-rem-base) * 0.714)`
- `gap: 8px` → `gap: var(--t-space-xs)`
- `padding: 10px` → `padding: calc(var(--terminal-rem-base) * 0.714)`

- [ ] **Step 4: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 3.6 — Candidate result card row + timeline sizing

**File:** `src/styles/terminal.css`

- [ ] **Step 1: Update `.terminal-result-meta-line` (already has font-size from Phase 2)**

Check for any `padding` or `height` px on this class and convert if present.

- [ ] **Step 2: Update `.terminal-timeline-row` (line ~1175)**

Current: `min-height: 24px; column-gap: 12px;`  
New: `min-height: calc(var(--terminal-rem-base) * 1.714); column-gap: var(--t-space-sm);`

- [ ] **Step 3: Update `.terminal-timeline-kind` (line ~1190)**

Current: `height: 18px; min-width: 44px; padding: 0 5px;`  
New: `height: calc(var(--terminal-rem-base) * 1.286); min-width: calc(var(--terminal-rem-base) * 3.143); padding: 0 calc(var(--terminal-rem-base) * 0.357);`

Keep `font-size: 10px` (too small to token-ize meaningfully, stays visually stable).

- [ ] **Step 4: Update `.terminal-result-pill-btn`**

The current values were updated earlier to `min-width: 96px; max-width: 120px`. Update to token-based:

Current:
```css
.terminal-result-pill-btn {
  width: 100%;
  min-width: 96px;
  max-width: 120px;
}
```
New:
```css
.terminal-result-pill-btn {
  width: 100%;
  min-width: calc(var(--terminal-rem-base) * 6.857);   /* ≈96px @ 14px */
  max-width: calc(var(--terminal-rem-base) * 8.571);   /* ≈120px @ 14px */
}
```

Also update `.terminal-result-card-actions`:
```css
.terminal-result-card-actions {
  width: max-content;
  min-width: calc(var(--terminal-rem-base) * 6.857);
  max-width: calc(var(--terminal-rem-base) * 8.571);
  justify-self: end;
  align-self: center;
}
```

- [ ] **Step 5: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 3.7 — Commit Phase 3

- [ ] **Step 1: Commit**

```bash
git add src/styles/terminal.css
git commit -m "feat(terminal): Phase 3 — layout spacing, cards, controls

- Dashboard body/main/aside gap + padding → calc(--terminal-rem-base * N)
- Growth card and trend card padding/margin → scaled
- Action bar button min-height and padding → --t-control-height-xl and tokens
- Timeline row height and column gap → scaled
- Pill button min/max-width → calc() tokens (scale with base)"
```

**Phase 3 report:**
- Files changed: `src/styles/terminal.css`
- px migrated: dashboard gaps (8 values), card padding (6 values), button heights (3 values), timeline sizes (4 values), pill button min/max-width
- px retained: `minmax(260px, …)` grid column bounds (structural), `clamp` vw middles, `border: 1px`, shadows
- Public pages: no impact
- Viewport check: open Dashboard + CandidatePool at 1280/1440/1920/2560px; row density, card spacing, button sizes should scale proportionally

---

## Phase 4 — CandidatePool + MiniChatWindow

**Files:** `src/features/candidatePool/components/CandidateMiniChatWindow.jsx`  
**What changes:** Window outer size (clamp + em), header font-sizes, avatar size.  
**What stays px:** `position: fixed`, `bottom: 24`, `right: rightOffset`, `zIndex: 8200`, `border: 1px`, shadow values.  
**Public page impact:** None.

---

### Task 4.1 — MiniChatWindow outer size (clamp + em)

**File:** `src/features/candidatePool/components/CandidateMiniChatWindow.jsx:116-141`

The `div` at line 116 has `position: fixed` outer container inline styles.

- [ ] **Step 1: Update outer container size properties**

Current:
```js
width:         380,
maxWidth:      'calc(100vw - 80px)',
height:        480,
```

New:
```js
// em inherits .terminal-shell font-size via DOM: 26em@13px=338px, 14px=364px, 15px=390px→capped
width:         'clamp(320px, 26em, 380px)',
maxWidth:      'calc(100vw - 3em)',
// 34em@13px=442px, 14px=476px, 15px=510px→capped
height:        'clamp(380px, 34em, 480px)',
maxHeight:     'calc(100vh - 3em)',
```

Keep unchanged: `position: 'fixed'`, `bottom: 24`, `right: rightOffset`, `zIndex: 8200`, `borderRadius: 10`, `overflow: 'hidden'`, `boxShadow`, `border`.

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 4.2 — MiniChatWindow header and avatar font-sizes

**File:** `src/features/candidatePool/components/CandidateMiniChatWindow.jsx`

- [ ] **Step 1: Update header container (line ~153)**

Current: `minHeight: 56, padding: '11px 12px 10px', gap: 10`  
New:
```js
minHeight: '4em',                                    /* ≈56px@14px, 52px@13px */
padding: '0.786em 0.857em 0.714em',                 /* ≈11 12 10px @ 14px */
gap: 'calc(0.714em)',                               /* ≈10px */
```

- [ ] **Step 2: Update avatar (line ~166)**

Current: `width: 34, height: 34, borderRadius: 9, fontSize: 14`  
New:
```js
width: '2.429em',         /* ≈34px@14px */
height: '2.429em',
borderRadius: '0.643em',  /* ≈9px@14px */
fontSize: 'var(--t-text-base)',
```

Keep `border: '1px solid ...'` (hairline, keep px).

- [ ] **Step 3: Update candidate name span (line ~184)**

Current: `fontSize: 13, maxWidth: 190`  
New:
```js
fontSize: 'var(--t-text-base)',
maxWidth: '13.571em',     /* ≈190px@14px */
```

- [ ] **Step 4: Update InvBadge and job title font-sizes if any are hard-coded px**

Check lines ~195–215 for any `fontSize: 11` or similar; replace with `'var(--t-text-xs)'`.

- [ ] **Step 5: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 4.3 — Verify rightOffset at all breakpoints

**File:** `src/features/candidatePool/components/CandidateMiniChatWindow.jsx:46-80`

The `rightOffset` is set by ResizeObserver tracking the dock's left edge:
```
rightOffset = window.innerWidth - dockEl.getBoundingClientRect().left
```

- [ ] **Step 1: Manual verification at three dock states**

Open browser at each viewport, open a conversation in CandidatePool, check:

| Viewport | Dock collapsed (36px wide) | Dock expanded (~200–240px) |
|---|---|---|
| 1280px | chat left edge ≈ 1280 - 36 - clampedWidth > 0 ✓ | chat left edge ≈ 1280 - 200 - clampedWidth > 0 ✓ |
| 1440px | OK (wider viewport) | OK |
| 2560px | OK (wider viewport, chat ≤ 380px) | OK |

- [ ] **Step 2: Check mobile fallback**

Resize browser to < 600px (dock hides, `rightOffset` stays `DEFAULT_RIGHT = 52`). Chat window `maxWidth: calc(100vw - 3em)` ≈ `calc(100vw - 39px)` at 13px base. Confirm no horizontal overflow.

- [ ] **Step 3: Verify content flow**

At 1280px viewport, confirm:
- Header row (avatar + name + badge) fully visible, not clipped
- Message thread scrolls (not overflowing window)
- Textarea + Send button visible, not pushed below window

---

### Task 4.4 — Commit Phase 4

- [ ] **Step 1: Commit**

```bash
git add src/features/candidatePool/components/CandidateMiniChatWindow.jsx
git commit -m "feat(terminal): Phase 4 — MiniChatWindow responsive clamp sizing

- width: clamp(320px, 26em, 380px) — scales with terminal base font
- height: clamp(380px, 34em, 480px)
- maxWidth/maxHeight: calc(100vw/vh - 3em) overflow guards
- Header padding, avatar size, name font-size → em/var(--t-text-*)
- position/bottom/right/z-index remain px (viewport-relative, safe)"
```

**Phase 4 report:**
- Files changed: `CandidateMiniChatWindow.jsx`
- px removed: `width: 380`, `height: 480`, `maxWidth`, `fontSize: 14/13`
- px retained: `bottom: 24`, `right: rightOffset`, `zIndex: 8200`, `border: 1px`, shadows, `borderRadius: 10` (structural visual)
- Public pages: no impact (CandidatePool is employer-only terminal route)
- Viewport check: open CandidatePool, click conversation button, verify chat window at 1280/1440/1920/2560px

---

## Phase 5 — Dashboard / Chart / Right Cards Regression

**Files:** `src/styles/terminal.css` — fix any discovered issues  
**Goal:** Visual verification pass at all four viewport widths. Fix remaining hard-coded values found during testing.

---

### Task 5.1 — Open Employer Dashboard and verify at 4 widths

- [ ] **Step 1: Test at 1280px**

In browser DevTools, set viewport width to 1280px. Check:
- [ ] Chart labels readable (not cut off, not too large)
- [ ] Stat numbers and date labels not clipped
- [ ] Growth card right column not overflowing
- [ ] Bottom meta lines ("vs 上周" etc.) not edge-clipped
- [ ] No internal scrollbars visible that shouldn't be there

- [ ] **Step 2: Test at 1440px**

Same checks as above.

- [ ] **Step 3: Test at 1920px**

Same checks. Spacing should feel slightly more generous.

- [ ] **Step 4: Test at 2560px**

Spacing should feel comfortable for a large monitor. Nothing should look tiny or excessively spaced.

---

### Task 5.2 — Open Candidate Pool and verify at 4 widths

- [ ] **Step 1: Check list rows at 1280px**

- [ ] Row height comfortable, not cramped
- [ ] Action buttons (完整简历, 已沟通, 已收藏) fit their content, not overflowing
- [ ] Filter sidebar not clipping labels
- [ ] Conversation dock (if expanded) not overlapping list

- [ ] **Step 2: Open mini chat window at 1280px**

- [ ] Window is noticeably smaller than before
- [ ] Header shows full name + job title without truncation
- [ ] Message thread area visible and scrollable
- [ ] Textarea + Send button fully visible, not pushed off-screen

- [ ] **Step 3: Test at 1920px and 2560px**

Chat window should scale up slightly (364px wide at 14px, 390px→capped at 380 at 15px).

---

### Task 5.3 — Fix any issues found during 5.1–5.2

For each visual issue found, locate the relevant CSS class in terminal.css and apply the same `calc(var(--terminal-rem-base) * N)` pattern.

Example fixes to look for:
- Any remaining `font-size: 11px` or `font-size: 12px` that should scale
- Any `padding: 16px` in dashboard card sections not yet converted
- Any `gap: 12px` or `gap: 14px` in key layout sections

- [ ] **Step 1: Apply fixes**

- [ ] **Step 2: Build**

```bash
npx vite build --mode production 2>&1 | tail -5
```

---

### Task 5.4 — Commit Phase 5

- [ ] **Step 1: Commit**

```bash
git add src/styles/terminal.css
git commit -m "fix(terminal): Phase 5 — dashboard/chart regression fixes from viewport testing"
```

**Phase 5 report:**
- Files changed: `src/styles/terminal.css`
- px migrated: any remaining values found during testing
- Viewport check: ✓ passed for Dashboard + CandidatePool at 1280/1440/1920/2560

---

## Phase 6 — Cross-Page Regression + Cleanup

**Goal:** Test all remaining pages, fix any remaining issues, final commit.

---

### Task 6.1 — Test remaining pages at 1280px and 1920px

For each page below, open in browser at 1280px and 1920px viewport. Mark as passing if layout is correct at both widths.

- [ ] **Match Result** (`/employer/match-result`): Panel widths, timeline, candidate section
- [ ] **Candidate Profile** (`/employer/candidate/:id`): Detail panel, tag pills, section spacing
- [ ] **Post Job** (`/employer/post-job`): Form field heights, 3-column grid, section labels
- [ ] **Messages** (`/employer/messages`): Conversation list width, chat area, composer height
- [ ] **Login → Terminal entry**: Nav rail renders, header visible, first page loads

Also verify public pages are unaffected:
- [ ] `/jobs` (JobMarketplace) — should look exactly the same as before
- [ ] `/` (landing) — unchanged

---

### Task 6.2 — Fix any cross-page regressions

Likely candidates if issues appear:
- Form fields in `PostJob` still using Tailwind `h-10` (40px) — won't scale but acceptable for Phase 6
- Message composer using fixed height — check `terminal-conv-dock` and message area classes

For each issue, apply `calc(var(--terminal-rem-base) * N)` to the relevant class in terminal.css.

- [ ] **Step 1: Apply fixes**

- [ ] **Step 2: Final build**

```bash
cd /Users/edy/Desktop/货代招聘
npx vite build --mode production 2>&1 | tail -8
```
Expected: `✓ built in` with no errors.

---

### Task 6.3 — Final commit

- [ ] **Step 1: Stage and commit all remaining changes**

```bash
git add src/styles/terminal.css src/features/candidatePool/components/CandidateMiniChatWindow.jsx
git commit -m "feat(terminal): Phase 6 — cross-page regression fixes and cleanup

Terminal responsive scale system complete:
- 13\" viewport (≤1440px): --terminal-rem-base = 13px (≈0.93× baseline)
- Standard (1441–1919px): --terminal-rem-base = 14px (baseline)
- Large (1920–2559px): --terminal-rem-base = 15px (≈1.07× baseline)
- 27\" / 4K (≥2560px): --terminal-rem-base = 16px (≈1.14× baseline)

All public routes unaffected. fixed/modal/dropdown elements safe."
```

---

## Final Report Template

After Phase 6, output this report:

```
## Terminal Scale System — Implementation Complete

### Modified files
- src/styles/terminal.css
- src/features/candidatePool/components/CandidateMiniChatWindow.jsx

### px → calc() migrations
[list of class names and what was changed]

### px retained (with reason)
- border: 1px — hairlines, physical pixel precision
- box-shadow px values — viewport-relative visual
- position: fixed coords (bottom/right/top/left) — viewport-relative
- border-radius ≤ 6px tokens — perceptually stable at all scales
- clamp() vw middles — viewport-proportion responsiveness
- grid minmax() structural bounds — layout integrity
- font-size: 10px on .terminal-timeline-kind — sub-token icon badge

### Viewport results
| Width | Scale | Visual |
|---|---|---|
| 1280px | 13px | ✓/✗ |
| 1440px | 13px | ✓/✗ |
| 1920px | 15px | ✓/✗ |
| 2560px | 16px | ✓/✗ |

### Requires manual follow-up
[list any remaining Tailwind h-* / p-* / gap-* that still don't scale]
```
