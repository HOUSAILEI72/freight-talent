# REQ-001 Status: done

## 变更摘要
- `src/pages/employer/PostJob.jsx`:
  - 新增 Section 2 "岗位描述"（岗位职责 + 任职要求，均为必填）
  - `validate()` 新增 description/requirements 非空校验
  - submit payload 移除 `requirements: requirements.trim() || null` 的 `|| null` fallback
  - 移除原 Section 5 "补充说明（可选）"
  - 章节编号重排：基本信息(1) → 岗位描述(2) → 地区与板块(3) → 能力要求(4) → 薪酬结构(5)

## 验证
- `npx vite build` ✓ 通过
- 后端测试 82 passed（24 failed 均为测试库 FK 约束问题，与本次变更无关）
