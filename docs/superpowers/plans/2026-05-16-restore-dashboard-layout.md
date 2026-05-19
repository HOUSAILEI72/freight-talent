# Restore Dashboard Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `/employer/dashboard` to its pre-responsive-pass visual layout without touching any candidate-pool code.

**Architecture:** Two targeted surgical edits — (1) revert GranularityControl button to simple inline-style only (no JS mouse handlers), (2) narrow the global `min-width:0` rule in terminal.css from `.terminal-mode *` to candidate-pool containers only. Dashboard.jsx itself is unchanged and needs no edits.

**Tech Stack:** React 19, Tailwind CSS, Recharts, CSS custom properties (`var(--t-*)`)

---

## Files

| File | Change |
|------|--------|
| `src/components/terminal/CandidateChartPanel.jsx` | Revert GranularityControl to simple buttons; keep `accessibilityLayer={false}` + `cursor={false}` |
| `src/styles/terminal.css` | Narrow global `min-width:0` rule to candidate-list containers only |

---

### Task 1: Revert GranularityControl to simple buttons

The diff added `onMouseEnter`, `onMouseLeave`, `onMouseDown`, `onMouseUp` handlers that mutate `style` via `e.currentTarget`. These are not needed (Dashboard hover is handled by the existing `transition-all` class) and introduce visual noise.

**Files:**
- Modify: `src/components/terminal/CandidateChartPanel.jsx` lines ~92–131

- [ ] **Step 1: Open the file and locate GranularityControl**

  The block to replace starts at the `{options.map((opt) => {` expression inside `GranularityControl`. Current (wrong) code:

  ```jsx
  {options.map((opt) => {
    const isActive = value === opt.value
    return (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className="px-2 py-1 rounded-[calc(var(--t-radius)-2px)] text-[12px] font-medium"
        style={{
          background: isActive ? c.ctrlActive : 'transparent',
          color: isActive ? c.ctrlActiveText : c.ctrlText,
          transition: 'background 120ms ease-out, color 120ms ease-out',
          outline: 'none',
        }}
        onMouseEnter={e => {
          if (isActive) return
          e.currentTarget.style.background = c.ctrlBorder
          e.currentTarget.style.color = isActive ? c.ctrlActiveText : (c.axisFill ?? c.ctrlText)
        }}
        onMouseLeave={e => {
          if (isActive) return
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = c.ctrlText
        }}
        onMouseDown={e => {
          e.currentTarget.style.opacity = '0.8'
        }}
        onMouseUp={e => {
          e.currentTarget.style.opacity = ''
        }}
      >
        {opt.label}
      </button>
    )
  })}
  ```

- [ ] **Step 2: Replace with the original simple version**

  Replace the entire block above with:

  ```jsx
  {options.map((opt) => (
    <button
      key={opt.value}
      onClick={() => onChange(opt.value)}
      className="px-2 py-1 rounded-[calc(var(--t-radius)-2px)] text-[12px] font-medium transition-all"
      style={{
        background: value === opt.value ? c.ctrlActive : 'transparent',
        color: value === opt.value ? c.ctrlActiveText : c.ctrlText,
      }}
    >
      {opt.label}
    </button>
  ))}
  ```

  Note: `transition-all` is back on the `className`, `isActive` variable is gone, no mouse handlers.

- [ ] **Step 3: Verify the BarChart + Tooltip fixes are intact**

  Scroll down to the `<BarChart>` usage (~line 212 in the modified file) and confirm these two attributes are present:
  - `<BarChart ... accessibilityLayer={false}>`
  - `<Tooltip ... cursor={false} />`

  These must be kept. Do NOT revert them.

---

### Task 2: Narrow the global min-width:0 rule in terminal.css

The current rule is:
```css
.terminal-mode *:not(svg):not(.recharts-wrapper):not(.recharts-surface):not(.recharts-layer):not(input[type="checkbox"]):not(input[type="radio"]) {
  min-width: 0;
}
```

This applies to every element inside `.terminal-mode`, including Dashboard metric cards, the chart container, and Growth cards. The fix: scope it only to candidate-list and split-sidebar containers.

**Files:**
- Modify: `src/styles/terminal.css`

- [ ] **Step 1: Find the global rule**

  Search for the comment block:
  ```
  /* ── Global min-width:0 inside terminal-mode prevents flex children
  ```
  The rule immediately follows that comment.

- [ ] **Step 2: Replace the global selector with scoped selectors**

  Replace this entire block (comment + rule):

  ```css
  /* ── Global min-width:0 inside terminal-mode prevents flex children
     from overflowing their containers on narrow/zoomed screens.
     SVG/Recharts elements and fixed-size UI atoms are excluded.     ── */
  .terminal-mode *:not(svg):not(.recharts-wrapper):not(.recharts-surface):not(.recharts-layer):not(input[type="checkbox"]):not(input[type="radio"]) {
    min-width: 0;
  }
  ```

  With this scoped version:

  ```css
  /* ── min-width:0 scoped to candidate-pool and split-sidebar containers only.
     Prevents flex overflow on narrow screens WITHOUT collapsing Dashboard cards.
     SVG/Recharts and form atoms excluded.                                    ── */
  .terminal-candidate-list-container *:not(svg):not(.recharts-wrapper):not(.recharts-surface):not(.recharts-layer):not(input[type="checkbox"]):not(input[type="radio"]),
  .terminal-split-sidebar *:not(svg):not(.recharts-wrapper):not(.recharts-surface):not(.recharts-layer):not(input[type="checkbox"]):not(input[type="radio"]) {
    min-width: 0;
  }
  ```

- [ ] **Step 3: Verify the t-truncate and t-wrap utilities still work**

  The `.t-truncate` and `.t-wrap` classes each declare `min-width: 0` on themselves — they are standalone utilities and do NOT depend on the removed global rule. No change needed there.

---

### Task 3: Build & smoke check

- [ ] **Step 1: Run the Vite production build**

  ```bash
  cd /Users/edy/Desktop/货代招聘
  npx vite build --mode production 2>&1 | tail -10
  ```

  Expected: `✓ built in X.XXs` — no errors.

- [ ] **Step 2: Start dev server**

  ```bash
  npm run dev -- --port 5174
  ```

  Open `http://localhost:5174/employer/dashboard`.

- [ ] **Step 3: Visual checklist (manual)**

  Confirm in browser:
  - [ ] Top 4 metric cards appear in a single row, same width as before
  - [ ] Candidate Trend chart fills its panel without being stretched vertically
  - [ ] Right-side Growth cards align with the chart height
  - [ ] Bottom 3 stat cards (Jobs / Applicant Candidates / Favorited Candidates) have compact original height
  - [ ] ActionBar buttons have original size and spacing
  - [ ] No horizontal scroll bar on the page
  - [ ] GranularityControl buttons (7D / 30D / 90D) still highlight on active selection

  Also check `/employer/candidate-pool` is not broken:
  - [ ] Result card grid still reflows at narrow widths
  - [ ] Snapshot column still appears/disappears correctly

- [ ] **Step 4: Run backend smoke test**

  ```bash
  cd /Users/edy/Desktop/货代招聘/backend && python -m pytest tests/ -x -q 2>&1 | tail -5
  ```

  Expected: no new failures introduced (these are backend tests; the changes are CSS/JSX only).

---

## Self-Review

**Spec coverage check:**
- ✅ GranularityControl reverted to simple buttons (Task 1)
- ✅ `accessibilityLayer={false}` + `cursor={false}` preserved (Task 1 Step 3)
- ✅ Global `min-width:0` narrowed to candidate-pool scope (Task 2)
- ✅ Dashboard-specific CSS selectors: none were changed in the diff — Dashboard.jsx and Dashboard-specific CSS selectors are untouched; only the global rule and CandidateChartPanel needed fixing
- ✅ Candidate-pool CSS preserved (Tasks only touch GranularityControl and the single global rule)
- ✅ Build + visual verification (Task 3)

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:** No new types introduced.
