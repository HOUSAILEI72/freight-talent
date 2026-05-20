# 候选人档案编辑页重设计 — 设计规格

**日期：** 2026-05-19  
**状态：** 已审核，进入实施

---

## 背景与目的

现有 `CandidateProfileBuilder.jsx`（1920 行单文件）是一个长滚动表单，没有分区导航、保存按钮只在底部、没有完整度指示。参考 BOSS 直聘的候选人档案编辑体验，重新设计成：

- 左侧永久分区导航（锚点跳转 + 完整度小圆点）
- 顶部 sticky 操作栏（保存按钮始终可见）
- 文档感 Section 样式（左蓝竖条 + 标题，无卡片 header 背景）
- 各 section 拆为独立子组件，降低维护难度

---

## 设计决策

### EDIT 界面

**整体布局：** `TerminalLayout` 壳 + 左侧 `ProfileSectionNav`（164px）+ 右侧 `main`（`FixedActionBar` + `ProfileScrollArea`）

**分区顺序：** 基础信息 → 当前任职 → 工作经历 → 项目经历 → 能力标签 → 教育与证书 → 期望薪资 → 简历附件

**字段网格：** 3 列为主（`g3`），复杂行用 `g4` 或 `g-2-1`；最大宽度 860px 约束主内容区

**输入框：** 全部自动高度伸缩（`AutoTextarea`，默认 1 行），不用固定 `<input>`

**Section 标题样式：** `3px 蓝竖条 + 14px 600 标题文字 + 右侧状态文字（✓已完善 / 待完善）`，无背景填充

**工作经历 字段（参考 BOSS）：**
- 公司名称 / 所属行业（g3 2+1）
- 所属部门（选填）/ 职位名称（g3 1+2）
- 在职时间（起 至 止）
- 工作内容：`AutoTextarea` + 工具栏 + AI润色按钮
- 工作业绩（选填）：同上
- 岗位标签（知识领域 + 硬技能，对应现有 knowledge_tags + hard_skill_tags）
- 软技能标签（对应现有 soft_skill_tags）

**项目经历 字段（参考 BOSS，新增）：**
- 项目名称 / 项目角色（g3 2+1）
- 项目链接（选填）/ 时间段起止（g3 2+1）
- 项目描述：`AutoTextarea` + 工具栏 + AI润色按钮
- 项目业绩（选填）：同上

**教育与证书 字段（参考 BOSS）：**
- 学校名称 / 学历（g3 2+1）
- 专业 / 时间段起止（g3 1+2）
- 在校经历（选填）：`AutoTextarea` + AI润色按钮
- 英语水平 / 资格证书（独立行）

**AI 润色按钮：**  
调用 `POST /api/v2/ai/polish`，传入 `{field, content, context}`，使用 DeepSeek API 返回润色后文本，流式替换 textarea 内容

### VIEW 界面

参考 BOSS 简历展示页：
- 左：纯文字简历目录导航
- 中：候选人姓名 + meta 信息行 + 各分区（左蓝竖条标题，段落文档感）
- 右：附件管理 + 简历诊断（待完善提示）+ 隐私设置

---

## 数据层变更

### 新增 DB 字段
`project_experiences` — JSON array，结构与 `work_experiences` 一致：
```json
[{"name": "项目名", "role": "角色", "link": "", "start": "2022-06", "end": "2022-12", "description": "...", "achievements": "..."}]
```
迁移文件：`0010_add_project_experiences.py`

### Flask PUT `/api/candidates/me`
新增 `project_experiences` 字段的读写和验证（同 `work_experiences` 模式）

### FastAPI 简历预览
`GET /api/v2/candidates/me/resume-preview`  
- COS 文件：生成 1h 预签名 URL → 返回 `{"url": "…"}`  
- 本地文件：`FileResponse` 直接 stream  
- 权限：owner only

### FastAPI AI 润色
`POST /api/v2/ai/polish`  
- 输入：`{field: str, content: str, context?: dict}`  
- 调用 DeepSeek API（`DEEPSEEK_API_KEY` 环境变量）  
- 流式返回 `text/event-stream`

---

## 前端组件结构

```
src/pages/candidate/TerminalCandidateProfile.jsx   (现有, 不动)
src/pages/candidate/CandidateProfileEdit.jsx        (新, 替代 CandidateProfileBuilder)
  ├── ProfileSectionNav.jsx                          (左侧导航 + 进度)
  ├── FixedActionBar.jsx                             (顶部 sticky 保存栏)
  └── sections/
      ├── BasicInfoSection.jsx
      ├── CurrentPositionSection.jsx
      ├── WorkExperienceSection.jsx   (含 WorkExpCard)
      ├── ProjectExperienceSection.jsx (含 ProjectExpCard, 新增)
      ├── SkillTagsSection.jsx
      ├── EducationSection.jsx        (含 EducationCard, 重构)
      ├── ExpectedSalarySection.jsx
      └── ResumeAttachmentSection.jsx (含 ResumePreviewModal)

src/components/ui/AutoTextarea.jsx                  (自动高度, 现已有, 复用)
src/components/ui/AiPolishButton.jsx                (新增, 调用 /api/v2/ai/polish)
src/features/candidateProfile/CandidateViewPage.jsx (新, VIEW 文档展示)
```

---

## 不改动范围

- `src/api/client.js`、`AuthContext.jsx`、`RequireAuth.jsx`、`socket.js`
- 公共浅色路由 `/candidates`、`/messages` 等的 `terminal=false` 分支
- Flask 现有路由（只新增字段，不删除旧字段）

---

## 验收标准

1. `npm run build` 无报错
2. `cd backend && python -m pytest tests/ -x -q` 全绿
3. EDIT 界面：8 个分区均可编辑，保存后刷新数据正确回填
4. 项目经历：添加/删除 entry，`PUT /api/candidates/me` 正确持久化
5. AI润色：点击按钮后 textarea 内容被流式替换（需 DEEPSEEK_API_KEY 配置）
6. 简历预览：点击「预览附件」打开 PDF modal，内容正确渲染
7. VIEW 界面：各分区数据正确展示，文档感布局与设计一致
