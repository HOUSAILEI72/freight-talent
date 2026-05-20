# Fix AI Hint Border Clipping in PostJob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/employer/jobs/new` 页面 AI 智能分析缺字段提示框的橙色边框从 `outline + outlineOffset`（向外扩，被 overflow 裁剪）改为 `boxShadow inset`（不外扩，不被裁剪）。

**Architecture:** 只改 `hintBorderStyle` 常量（第 1101–1105 行），三处调用点（岗位名称 / 岗位板块 / 岗位工作城市）无需改动，因为它们直接引用同一常量。改动范围极小，不触及任何公共路径或 Terminal 主题 token。

**Tech Stack:** React 19, inline style object

---

## 文件映射

| 操作 | 路径 | 行号 |
|------|------|------|
| Modify | `src/pages/employer/PostJob.jsx` | 1101–1105 |

三处消费点（只读，不改）：

| 消费点 | 条件 | 行号 |
|--------|------|------|
| 岗位名称 wrapper | `aiFieldHint && !title.trim()` | 1242 |
| 岗位板块 wrapper | `aiFieldHint && !functionCode` | 1363 |
| 岗位工作城市 wrapper | `aiFieldHint && !location?.location_code` | 1517 |

---

### Task 1: 替换 `hintBorderStyle`，改用 inset box-shadow

**Files:**
- Modify: `src/pages/employer/PostJob.jsx:1101-1105`

- [ ] **Step 1: 确认当前内容**

  打开 `src/pages/employer/PostJob.jsx`，定位第 1101–1105 行，确认当前内容为：

  ```js
  const hintBorderStyle = {
    outline: '2px solid #f59e0b',
    outlineOffset: 2,
    borderRadius: 6,
  }
  ```

- [ ] **Step 2: 替换为 inset box-shadow**

  将上述代码替换为：

  ```js
  const hintBorderStyle = {
    boxShadow: '0 0 0 2px #f59e0b inset',
    borderRadius: 6,
  }
  ```

  > **为什么用 inset：** `outline` / `outlineOffset` 在元素外侧绘制，超出滚动容器后被 `overflow-y: auto` 裁剪，导致左侧橙色边框消失。`inset` 阴影在元素内侧绘制，不占用外部空间，不受 overflow 影响。
  >
  > **borderRadius 保留：** `box-shadow inset` 会跟随 `borderRadius` 圆角，视觉一致。

- [ ] **Step 3: 确认三处调用点不需要改动**

  分别检查以下行，确认它们直接使用 `hintBorderStyle`，无需改动：

  ```
  line 1242: <div style={aiFieldHint && !title.trim() ? hintBorderStyle : {}}>
  line 1363: <div style={aiFieldHint && !functionCode ? hintBorderStyle : {}}>
  line 1517: <div style={aiFieldHint && !location?.location_code ? hintBorderStyle : {}}>
  ```

- [ ] **Step 4: 前端构建验证**

  ```bash
  cd /Users/edy/Desktop/货代招聘
  npx vite build --mode production 2>&1 | tail -5
  ```

  预期输出：`built in X.XXs`（无 error，无 warning 涉及 PostJob）

- [ ] **Step 5: 手动功能验证**

  1. 启动开发服务器（或已运行则跳过）
  2. 访问 `/employer/jobs/new`
  3. 切换到 Terminal 视图（三列布局）
  4. **不填** 岗位名称、岗位板块、岗位工作城市
  5. 点击「AI 智能分析」按钮
  6. 确认三个字段的 wrapper 四边橙色框完整可见（左侧不再被裁剪）
  7. 填入三个字段后再次点击，确认橙色框消失，无视觉残留

- [ ] **Step 6: Commit**

  ```bash
  git add src/pages/employer/PostJob.jsx
  git commit -m "fix(postjob): replace outline+outlineOffset with inset box-shadow to fix AI hint clipping"
  ```

---

## 完成标准

- [ ] `hintBorderStyle` 不再使用 `outline` 或 `outlineOffset`
- [ ] 三个 AI 必填提示 wrapper 橙色框四边完整（Terminal 三列布局下）
- [ ] 公共浅色页面结构、Navbar、`/candidate/upload` 路径均未改动
- [ ] `npx vite build` 无报错
