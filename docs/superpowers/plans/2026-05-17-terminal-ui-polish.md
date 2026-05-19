# Terminal UI Polish — Chip / Label / Tabular-Nums Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 Terminal UI 的 chip 选中态（淡彩专业感）、field label 排版（11px / letter-spacing）、数字 tabular-nums，并修复 AI 智能分析提示框在 TerminalSelect / RegionSelector 中不可见的问题。

**Architecture:** 所有改动分两层：① `src/styles/terminal.css` 新增可复用 utility class；② 各页面 JSX 替换/补充硬编码 inline style 引用新 class。TerminalSelect 新增 `highlightStyle` prop 解决 AI hint 穿透问题。不触碰公共浅色路径、API、数据结构。

**Tech Stack:** React 19, Vite, Tailwind CSS, CSS custom properties (terminal tokens)

---

## 文件映射

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `src/styles/terminal.css` | 新增 chip / label / tabular-num utility classes |
| Modify | `src/components/terminal/TerminalSelect.jsx` | 新增 `highlightStyle` prop |
| Modify | `src/pages/employer/PostJob.jsx` | chip颜色、label排版、input高度、AI hint穿透 |
| Modify | `src/pages/employer/PersonalHeadhunting.jsx` | `chipStyle()` 选中态统一 |
| Modify | `src/components/charts/ChartTagSelector.jsx` | 行列表选中态颜色统一 |

---

### Task 1: terminal.css — 新增 utility classes

**Files:**
- Modify: `src/styles/terminal.css`（在文件末尾追加）

- [ ] **Step 1: 读取 terminal.css 末尾确认追加位置**

  `src/styles/terminal.css` 目前约 400 行，末尾是若干 `.terminal-mode` override 规则。在末尾新增一个清晰分隔区块。

- [ ] **Step 2: 追加 utility classes**

  在文件末尾追加以下内容（替换文件末尾的最后一个 `}` 之后，新起一段）：

  ```css
  /* ══════════════════════════════════════════════════════════════════
     Terminal Utility Classes
     可在任何 .terminal-mode 内直接用，不绑定具体业务页面
  ══════════════════════════════════════════════════════════════════ */

  /* ── Chip / Tag / Filter Button ─────────────────────────────────── */

  /* 基础轮廓（未选中） */
  .terminal-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--t-radius-sm);
    border: 1px solid var(--t-border);
    background: transparent;
    color: var(--t-text-secondary);
    font-family: var(--t-font-ui);
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: 0.02em;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: background 120ms, border-color 120ms, color 120ms;
  }

  /* 选中态 — 低饱和度蓝底 */
  .terminal-chip-selected {
    background: rgba(59, 130, 246, 0.07);
    border-color: rgba(59, 130, 246, 0.28);
    color: var(--t-text);
  }

  /* hover（未选中） */
  .terminal-chip:not(.terminal-chip-selected):hover {
    background: var(--t-bg-hover);
    border-color: var(--t-border-focus);
  }

  /* hover（选中） */
  .terminal-chip.terminal-chip-selected:hover {
    background: rgba(59, 130, 246, 0.11);
    border-color: rgba(59, 130, 246, 0.38);
  }

  /* disabled */
  .terminal-chip:disabled,
  .terminal-chip[aria-disabled="true"] {
    opacity: 0.38;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* focus-visible — 键盘可访问性 */
  .terminal-chip:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
  }

  /* ── Field Labels ────────────────────────────────────────────────── */

  /* 英文 label：uppercase + 0.06em */
  .terminal-field-label {
    display: block;
    font-family: var(--t-font-ui);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--t-text-secondary);
    margin-bottom: 4px;
    line-height: 1.3;
  }

  /* 中文 label：不 uppercase，0.04em */
  .terminal-field-label-cn {
    display: block;
    font-family: var(--t-font-cjk);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--t-text-secondary);
    margin-bottom: 4px;
    line-height: 1.3;
  }

  /* ── Tabular Numbers ─────────────────────────────────────────────── */

  .terminal-tabular-num {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
  }

  /* 数字输入框全局覆盖（terminal-mode 内） */
  .terminal-mode input[inputmode="numeric"],
  .terminal-mode input[inputmode="decimal"],
  .terminal-mode input[type="number"] {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
  }
  ```

- [ ] **Step 3: 验证无语法错误**

  ```bash
  cd /Users/edy/Desktop/货代招聘 && npx vite build --mode production 2>&1 | grep -E "error|Error|warning.*terminal" | head -10
  ```
  预期：无 CSS 语法错误。

- [ ] **Step 4: Commit**

  ```bash
  git add src/styles/terminal.css
  git commit -m "feat(terminal): add chip / field-label / tabular-num utility classes"
  ```

---

### Task 2: TerminalSelect.jsx — 新增 highlightStyle prop

**Files:**
- Modify: `src/components/terminal/TerminalSelect.jsx:19-28, 95-114`

AI hint 提示框作用在 wrapper div 上时，trigger button 的不透明背景会遮挡 inset shadow。解决方案：新增 `highlightStyle` prop，直接合并到 trigger button 的 style 中。

- [ ] **Step 1: 更新 Props 解构（第 19–28 行附近）**

  当前：
  ```jsx
  export function TerminalSelect({
    value,
    onChange,
    options = [],
    placeholder = '',
    hasValue,
    searchable = false,
    className = '',
    style,
  }) {
  ```

  改为：
  ```jsx
  export function TerminalSelect({
    value,
    onChange,
    options = [],
    placeholder = '',
    hasValue,
    searchable = false,
    className = '',
    style,
    highlightStyle,
  }) {
  ```

- [ ] **Step 2: 将 highlightStyle 合并到 triggerStyle（第 95–114 行附近）**

  当前 `triggerStyle` 末尾：
  ```js
    ...style,
  }
  ```

  改为：
  ```js
    ...style,
    ...highlightStyle,
  }
  ```

  完整 triggerStyle 改动结果（确认上下文正确）：
  ```js
  const triggerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    width: '100%',
    height: 30,
    padding: '0 8px',
    background: 'var(--t-bg-input)',
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--t-radius-sm)',
    color: selected ? 'var(--t-text)' : 'var(--t-text-muted)',
    fontFamily: 'var(--t-font-ui)',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
    userSelect: 'none',
    transition: 'border-color 120ms',
    ...style,
    ...highlightStyle,
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/terminal/TerminalSelect.jsx
  git commit -m "feat(terminal-select): add highlightStyle prop for AI hint passthrough"
  ```

---

### Task 3: PostJob.jsx — chip颜色 / label排版 / input高度 / AI hint穿透

**Files:**
- Modify: `src/pages/employer/PostJob.jsx`（多处，见下）

- [ ] **Step 1: 修复 SelectedSkillTag terminal 颜色（第 327–343 行附近）**

  当前 terminal 分支的 span style：
  ```js
  background: terminal ? 'var(--t-primary-muted)' : '#eff6ff',
  color: terminal ? 'var(--t-primary)' : '#2563eb',
  border: `1px solid ${terminal ? 'var(--t-primary)' : '#bfdbfe'}`,
  ```

  改为：
  ```js
  background: terminal ? 'rgba(59, 130, 246, 0.07)' : '#eff6ff',
  color: terminal ? 'var(--t-text)' : '#2563eb',
  border: `1px solid ${terminal ? 'rgba(59, 130, 246, 0.28)' : '#bfdbfe'}`,
  ```

- [ ] **Step 2: 更新 chipStyle() terminal 选中态（第 784–800 行附近）**

  当前 terminal 分支 active style：
  ```js
  return {
    className: 'px-3 py-1.5 rounded-lg text-sm border transition-colors',
    style: active
      ? { background: 'var(--t-primary)', color: '#fff', borderColor: 'var(--t-primary)' }
      : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' },
  }
  ```

  改为：
  ```js
  return {
    className: 'px-3 py-1.5 rounded-lg text-sm border transition-colors',
    style: active
      ? { background: 'rgba(59, 130, 246, 0.07)', color: 'var(--t-text)', borderColor: 'rgba(59, 130, 246, 0.28)' }
      : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' },
  }
  ```

- [ ] **Step 3: 更新 labelClass 使用 terminal-field-label-cn（第 754 行附近）**

  当前：
  ```js
  const labelClass = terminal
    ? 'block text-xs font-medium mb-1'
    : 'block text-sm font-medium text-slate-700 mb-1'
  ```

  改为：
  ```js
  const labelClass = terminal
    ? 'block terminal-field-label-cn mb-1'
    : 'block text-sm font-medium text-slate-700 mb-1'
  ```

- [ ] **Step 4: 更新 labelStyle — 移除 color 覆盖（已由 class 处理）（第 754 行下方约 10 行）**

  找到：
  ```js
  const labelStyle = terminal
    ? { color: 'var(--t-text-muted)' }
    : undefined
  ```

  改为（class 已设 color: var(--t-text-secondary)，删除内联覆盖）：
  ```js
  const labelStyle = terminal ? {} : undefined
  ```

- [ ] **Step 5: 拆分 inputStyle 和 textareaStyle，给 input 加 height:30（第 764–769 行）**

  当前：
  ```js
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', color: 'var(--t-text)', borderColor: 'var(--t-border)' }
    : undefined

  const textareaClass = inputClass + ' resize-none'
  const textareaStyle = inputStyle
  ```

  改为：
  ```js
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', color: 'var(--t-text)', borderColor: 'var(--t-border)', height: 30 }
    : undefined

  const textareaClass = inputClass + ' resize-none'
  const textareaStyle = terminal
    ? { background: 'var(--t-bg-input)', color: 'var(--t-text)', borderColor: 'var(--t-border)' }
    : undefined
  ```

- [ ] **Step 6: 新增 hintTriggerStyle 常量（在 hintBorderStyle 定义附近，第 1101 行）**

  在 `const hintBorderStyle = { ... }` 之后追加：
  ```js
  const hintTriggerStyle = { boxShadow: '0 0 0 2px #f59e0b inset' }
  ```

- [ ] **Step 7: 岗位板块 — TerminalSelect 改用 highlightStyle prop，wrapper 仅对 light 生效（第 1355–1380 行附近）**

  找到以下代码块（岗位板块字段）：
  ```jsx
  <div style={aiFieldHint && !functionCode ? hintBorderStyle : {}}>
    {terminal ? (
      <TerminalSelect
        value={functionCode}
        onChange={setFunctionCode}
        options={[{ value: '', label: '请选择板块' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
        placeholder="请选择板块"
        hasValue={!!functionCode}
      />
  ```

  改为：
  ```jsx
  <div style={!terminal && aiFieldHint && !functionCode ? hintBorderStyle : {}}>
    {terminal ? (
      <TerminalSelect
        value={functionCode}
        onChange={setFunctionCode}
        options={[{ value: '', label: '请选择板块' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
        placeholder="请选择板块"
        hasValue={!!functionCode}
        highlightStyle={aiFieldHint && !functionCode ? hintTriggerStyle : undefined}
      />
  ```

- [ ] **Step 8: 岗位工作城市 — wrapper 仅对 light 生效（第 1509–1525 行附近）**

  找到：
  ```jsx
  <div style={aiFieldHint && !location?.location_code ? hintBorderStyle : {}}>
    <RegionSelector
  ```

  改为（RegionSelector 暂不支持 highlightStyle，保留 wrapper 但 terminal 模式下用 outline 代替 inset，视觉已可接受）：
  ```jsx
  <div style={aiFieldHint && !location?.location_code ? hintBorderStyle : {}}>
    <RegionSelector
  ```
  
  > 此处保持不变——RegionSelector 自行有 border，wrapper 的 inset shadow 在 terminal 模式仍受遮挡，但 label 橙色 + 文字 hint 已足够。后续如需彻底修复可给 RegionSelector 加 highlightStyle prop，当前不在本次范围。

- [ ] **Step 9: 给所有数字 input 加 className terminal-tabular-num（薪资三字段 + 预估平均额，共 4 处）**

  搜索 `inputMode="numeric"` 以及 `type="number"` 的 input，共有以下几处（以实际文件为准，确认每一处）：
  - 最低月薪 input（约第 1840 行）
  - 最高月薪 input（约第 1870 行）
  - 预估平均额 input（约第 1930 行）

  对每个 terminal 分支的数字 input，在 `className={...inputClass}` 中追加 ` terminal-tabular-num`：
  ```jsx
  className={`${inputClass} terminal-tabular-num`}
  ```
  
  注意：非 terminal 分支保持原样，不加此 class。

- [ ] **Step 10: Commit**

  ```bash
  git add src/pages/employer/PostJob.jsx
  git commit -m "feat(postjob): unified chip color, label typography, input height, AI hint passthrough"
  ```

---

### Task 4: PersonalHeadhunting.jsx — 统一 chipStyle 选中态

**Files:**
- Modify: `src/pages/employer/PersonalHeadhunting.jsx:200-204`

- [ ] **Step 1: 更新 chipStyle 选中态（第 200–204 行）**

  当前：
  ```js
  function chipStyle(active) {
    return active
      ? { padding: '4px 11px', borderRadius: 4, border: '1px solid var(--t-primary)', background: 'var(--t-primary)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em' }
      : { padding: '4px 11px', borderRadius: 4, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em' }
  }
  ```

  改为：
  ```js
  function chipStyle(active) {
    return active
      ? { padding: '4px 11px', borderRadius: 4, border: '1px solid rgba(59, 130, 246, 0.28)', background: 'rgba(59, 130, 246, 0.07)', color: 'var(--t-text)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em' }
      : { padding: '4px 11px', borderRadius: 4, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em' }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/pages/employer/PersonalHeadhunting.jsx
  git commit -m "feat(headhunting): unify chip selected state to low-saturation blue"
  ```

---

### Task 5: ChartTagSelector.jsx — 选中行颜色统一

**Files:**
- Modify: `src/components/charts/ChartTagSelector.jsx:230-248`

- [ ] **Step 1: 更新选中行 background / color / hover（第 230–248 行附近）**

  当前：
  ```jsx
  style={{
    width: '100%', textAlign: 'left', padding: '7px 20px',
    fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: selected ? 'rgba(96,165,250,0.08)' : 'transparent',
    color: selected ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)',
    border: 'none', cursor: 'pointer',
  }}
  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
  onMouseLeave={e => { e.currentTarget.style.background = selected ? 'rgba(96,165,250,0.08)' : 'transparent' }}
  ```

  以及 Check icon 颜色：
  ```jsx
  {selected && <Check size={11} style={{ color: 'var(--t-chart-blue)', flexShrink: 0 }} />}
  ```

  改为：
  ```jsx
  style={{
    width: '100%', textAlign: 'left', padding: '7px 20px',
    fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: selected ? 'rgba(59, 130, 246, 0.07)' : 'transparent',
    color: selected ? 'var(--t-text)' : 'var(--t-text-secondary)',
    border: 'none', cursor: 'pointer',
  }}
  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
  onMouseLeave={e => { e.currentTarget.style.background = selected ? 'rgba(59, 130, 246, 0.07)' : 'transparent' }}
  ```

  以及 Check icon：
  ```jsx
  {selected && <Check size={11} style={{ color: 'var(--t-text-secondary)', flexShrink: 0 }} />}
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/charts/ChartTagSelector.jsx
  git commit -m "feat(chart-tag): unify selected row color to low-saturation blue"
  ```

---

### Task 6: 验证 + Build + Lint

**Files:** 无改动，只跑检查

- [ ] **Step 1: 运行 Vite build**

  ```bash
  cd /Users/edy/Desktop/货代招聘 && npx vite build --mode production 2>&1 | tail -8
  ```
  预期：`built in X.XXs`，无 error。

- [ ] **Step 2: 运行 ESLint（如果项目有 lint 配置）**

  ```bash
  cd /Users/edy/Desktop/货代招聘 && npx eslint src/styles/terminal.css src/components/terminal/TerminalSelect.jsx src/pages/employer/PostJob.jsx src/pages/employer/PersonalHeadhunting.jsx src/components/charts/ChartTagSelector.jsx 2>&1 | tail -20
  ```
  如果 eslint 不支持 .css，去掉 terminal.css。
  区分新增问题 vs 历史问题（历史问题不阻止 merge）。

- [ ] **Step 3: 最终 commit（如有遗漏文件）**

  ```bash
  git status
  ```

---

## 完成标准

- [ ] `.terminal-chip` / `.terminal-chip-selected` / `.terminal-field-label` / `.terminal-field-label-cn` / `.terminal-tabular-num` 均在 terminal.css 中定义
- [ ] TerminalSelect 接受 `highlightStyle` prop，AI hint 橙色框在 TerminalSelect 上可见
- [ ] PostJob 所有 chip 选中态从深蓝主色改为低饱和蓝底
- [ ] PostJob field label 统一 11px + 0.04em
- [ ] PostJob 数字 input 有 `terminal-tabular-num`
- [ ] PostJob terminal input 高度 30px，与 TerminalSelect 对齐
- [ ] PersonalHeadhunting chipStyle 与 PostJob 一致
- [ ] ChartTagSelector 选中行颜色与新 chip 规范一致
- [ ] `npx vite build` 通过，无新增 error
