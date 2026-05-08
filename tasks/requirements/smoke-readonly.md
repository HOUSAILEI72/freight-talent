# Smoke 需求：验证 DeepSeek 主控只读能力

## 目标

验证 DeepSeek 主控可以读取项目基本文件，生成技术栈摘要，但不修改任何业务文件。

## 要求

1. 读取 `AI_CONTEXT.md`。
2. 读取 `PROJECT_DECISIONS.md`。
3. 读取 `package.json`。
4. 读取 `backend/requirements.txt`（如果存在）。
5. 输出前后端技术栈摘要（版本号、主要依赖）。
6. 不允许修改任何业务文件。
7. 不允许调用官方 Claude。
8. 不允许读取密钥文件。

## 验收标准

- `git diff` 不应出现任何业务代码变更（允许新增 status 文件）。
- 输出包含前端框架版本、后端框架版本、数据库类型。
