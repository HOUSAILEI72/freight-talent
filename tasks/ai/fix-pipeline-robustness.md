# 任务单：修复 AI Pipeline 的 3 处健壮性问题

## 背景

主控架构审查发现 `scripts/ai/` 目录下有 3 处工程问题。本任务单只修复这 3 处，不做其他任何改动。

---

## 问题 1：FIFO 文件残留未清理

### 症状
`logs/ai/` 目录中存在孤立 FIFO 文件（`*.fifo`），由运行中断产生，永不自动清理。

### 根因
`run_deepseek_task.sh` 使用 `STREAM_RAW` 变量命名为 `*.raw.jsonl`，但某个版本曾用过 `*.fifo` 作为管道中转，中断后留下孤立文件。现有脚本没有清理逻辑。

### 修复方案
在 `scripts/ai/run_deepseek_task.sh` 的以下位置各加一行清理：

1. **脚本顶部**（`mkdir -p logs/ai` 之后）加：
   ```bash
   # 清理同名 FIFO 残留（如有）
   find logs/ai -maxdepth 1 -type p -name '*.fifo' -delete 2>/dev/null || true
   ```

2. **脚本末尾**（`exit "$PIPELINE_EXIT_CODE"` 之前）加：
   ```bash
   # 清理本次可能产生的 FIFO 残留
   find logs/ai -maxdepth 1 -type p -name '*.fifo' -delete 2>/dev/null || true
   ```

### 允许修改文件
- `scripts/ai/run_deepseek_task.sh`

---

## 问题 2：缺少 `claude` / `node` 前置检查

### 症状
`run_deepseek_task.sh` 直接运行 `claude -p ...`，若 CLI 不在 PATH，子进程层面失败，错误被淹没在日志里，诊断成本高。

### 修复方案
在 `scripts/ai/run_deepseek_task.sh` 的 `source scripts/ai/deepseek_env.sh` **之后**、`TASK_NAME=...` **之前**插入以下代码块：

```bash
# 前置依赖检查
if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: claude CLI not found in PATH. Please install Claude Code CLI first."
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH. stream_json_to_text.cjs requires Node.js."
  exit 1
fi
```

### 允许修改文件
- `scripts/ai/run_deepseek_task.sh`

---

## 问题 3：`enqueue_task.sh` 的 daemon 存活反馈静默

### 症状
daemon 运行时 `enqueue_task.sh` 不打印任何确认；用户不知道任务是否会被自动处理。

### 修复方案
将 `scripts/ai/enqueue_task.sh` 中的 daemon 状态检查块（最后 4 行）替换为：

**原代码：**
```bash
if scripts/ai/worker_daemon.sh status >/dev/null 2>&1; then
  :
else
  echo "提示：DeepSeek daemon 可能未运行。启动：scripts/ai/worker_daemon.sh start"
fi
```

**新代码：**
```bash
if scripts/ai/worker_daemon.sh status >/dev/null 2>&1; then
  echo "DeepSeek daemon is running. Task will be processed automatically."
  echo "Follow progress: scripts/ai/worker_daemon.sh tail"
else
  echo "⚠️  提示：DeepSeek daemon 未运行，任务已入队但不会自动执行。"
  echo "    启动 daemon：scripts/ai/worker_daemon.sh start"
  echo "    或直接运行：scripts/ai/run_deepseek_task.sh $QUEUE_FILE"
fi
```

注意：`$QUEUE_FILE` 是该脚本中已定义的变量，可直接引用。

### 允许修改文件
- `scripts/ai/enqueue_task.sh`

---

## 汇总：允许修改的文件

- `scripts/ai/run_deepseek_task.sh` — 问题 1 + 问题 2
- `scripts/ai/enqueue_task.sh` — 问题 3

## 禁止修改的文件

- 除上述两个文件之外的所有文件
- 特别禁止修改：`worker_daemon.sh` / `cc_arch.sh` / `stream_json_to_text.cjs` / 任何前端或后端源码

---

## 实现步骤

1. 读取 `scripts/ai/run_deepseek_task.sh` 全文，确认当前行号。
2. 在正确位置插入问题 1 的 FIFO 清理（头部 + 尾部各一处）。
3. 在正确位置插入问题 2 的前置检查代码块。
4. 读取 `scripts/ai/enqueue_task.sh` 全文，确认 daemon 检查块的位置。
5. 替换问题 3 的 daemon 反馈代码块。
6. 完成后读取两个文件全文，肉眼验证改动正确，无误删/误插。
7. 运行以下验证命令，确认语法无误：
   ```bash
   bash -n scripts/ai/run_deepseek_task.sh && echo "run_deepseek_task.sh syntax OK"
   bash -n scripts/ai/enqueue_task.sh && echo "enqueue_task.sh syntax OK"
   ```
8. 输出完成报告后停止。

---

## 验收标准

- [ ] `scripts/ai/run_deepseek_task.sh` 在 `mkdir -p logs/ai` 后有 FIFO 清理
- [ ] `scripts/ai/run_deepseek_task.sh` 在 `exit "$PIPELINE_EXIT_CODE"` 前有 FIFO 清理
- [ ] `scripts/ai/run_deepseek_task.sh` 有 `command -v claude` 和 `command -v node` 前置检查
- [ ] `scripts/ai/enqueue_task.sh` daemon 存活时打印确认信息
- [ ] `scripts/ai/enqueue_task.sh` daemon 未运行时打印带 `$QUEUE_FILE` 的直接运行提示
- [ ] `bash -n scripts/ai/run_deepseek_task.sh` 返回 0
- [ ] `bash -n scripts/ai/enqueue_task.sh` 返回 0
- [ ] `git diff` 仅包含上述两个文件的改动，无其他变动

---

## 停止条件

完成所有 8 个实现步骤并打印验收报告后**立即停止**，不做其他任何事情。
