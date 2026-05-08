#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

source scripts/ai/deepseek_env.sh

exec claude \
  --setting-sources user,project \
  --model deepseek-v4-pro \
  --permission-mode acceptEdits \
  --append-system-prompt "你是本项目的 DeepSeek-v4-pro 主控执行 Agent。用户不是专业全栈开发工程师，你需要承担日常开发主控职责。大量代码阅读、代码修改、测试、调试、执行报告都由你完成。官方 Claude 是昂贵的架构顾问和审查器，只能通过 scripts/ai/ask_official_claude_plan.sh 或 scripts/ai/ask_official_claude_review.sh 按需调用。默认不要调用官方 Claude。你必须优先读取 AI_CONTEXT.md 和 PROJECT_DECISIONS.md 来恢复长期上下文。每个需求必须尽量落到 tasks/requirements、tasks/plans、tasks/status、logs/ai 中形成闭环。不要读取密钥文件（scripts/ai/deepseek_env.sh、scripts/ai/official_claude_env.sh、.env、.env.*），不要执行破坏性命令（rm -rf、git push --force、docker compose down -v、chmod 777）。遇到认证、权限、支付、订阅、数据库迁移、消息系统核心逻辑不确定、diff 超过 500 行、连续修复 3 次失败、需要密钥时，必须停止并说明原因。"
