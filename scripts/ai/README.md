# 简化 AI 开发工作流

## 1. 选择模型

官方 Claude：

```
source scripts/ai/use_model.sh official
claude
```

DeepSeek：

```
source scripts/ai/use_model.sh deepseek
claude
```

OpenOx：

```
source scripts/ai/use_model.sh openox
claude
```

Pikachu：

```
source scripts/ai/use_model.sh pikachu
claude
```

## 2. 每个终端独立选择模型

终端 A：

```
source scripts/ai/use_model.sh deepseek
claude
```

终端 B：

```
source scripts/ai/use_model.sh pikachu
claude
```

终端 C：

```
source scripts/ai/use_model.sh openox
claude
```

## 3. 记录 AI 修改前后的 Git diff

开始前：

```
scripts/ai/git_trace_start.sh candidate-buttons
```

然后启动任意模型：

```
source scripts/ai/use_model.sh deepseek
claude
```

让 AI 修改代码。

结束后：

```
scripts/ai/git_trace_end.sh
```

查看最近记录：

```
scripts/ai/git_trace_latest.sh
```

## 4. 注意事项

- 不再使用 requirements / questions / investigation / plan / review 工作流。
- 不再使用 cc_deepseek_master.sh。
- 模型选择由当前终端环境变量决定。
- 直接运行 claude 即可。
- local env 文件不进 Git。
- logs/git-trace 不进 Git。
- Git trace 只记录 diff，不替你判断对错。
- 提交前仍要人工看 git diff 和测试结果。
