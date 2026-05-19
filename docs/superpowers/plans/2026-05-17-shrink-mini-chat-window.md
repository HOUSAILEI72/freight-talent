# Shrink Floating Mini Chat Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the floating chat window in the candidate pool from 460×560px to 430×530px so it covers less of the candidate list.

**Architecture:** Single-file inline style change in `CandidateMiniChatWindow.jsx`. The window uses `fixed` positioning anchored to the right edge of `CandidateConversationDock` via a `ResizeObserver`. Only the `width` and `height` values change — no layout, positioning, or responsive logic is affected.

**Tech Stack:** React 19, inline styles (Terminal scoped), no CSS file changes needed.

---

### Task 1: Reduce width and height in CandidateMiniChatWindow

**Files:**
- Modify: `src/features/candidatePool/components/CandidateMiniChatWindow.jsx:127-129`

- [ ] **Step 1: Change width from 460 to 430**

In `CandidateMiniChatWindow.jsx` around line 127, change:
```js
width:         460,
```
to:
```js
width:         430,
```

- [ ] **Step 2: Change height from 560 to 530**

On line 129, change:
```js
height:        560,
```
to:
```js
height:        530,
```

- [ ] **Step 3: Verify mobile maxWidth is still safe**

Confirm line 128 still reads:
```js
maxWidth:      'calc(100vw - 80px)',
```
On a 390px mobile viewport: `maxWidth = 310px`, `right = 52px` → left edge at 28px. Safe, no overflow.

- [ ] **Step 4: Run frontend build**

```bash
cd /Users/edy/Desktop/货代招聘 && npx vite build --mode production 2>&1 | tail -5
```
Expected: `✓ built in` with no errors.

- [ ] **Step 5: Open browser and verify**

Navigate to `http://localhost:5173/employer/candidates` (or whichever dev server port), open a candidate conversation, confirm:
- Chat window is visibly smaller
- Header (avatar + name + badge) renders fully
- Message thread area scrolls
- Input textarea and Send button are not clipped

- [ ] **Step 6: Commit**

```bash
git add src/features/candidatePool/components/CandidateMiniChatWindow.jsx
git commit -m "feat(candidate-pool): shrink mini chat window to 430×530px"
```
