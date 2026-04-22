---
name: qoder-upstream-sync
description: Sync Qoder fork from upstream GSD origin/main and rewrite complete Qoder runtime adaptation. Use when the user asks to rebase, sync upstream, update to latest version, or redo Qoder adaptation. Covers git reset, install.js 19-point adaptation, hooks, tests, .qoder directory sync, push, npx install, and end-to-end verification.
---

# Qoder Upstream Sync & Adaptation

增量同步 `feat/qoder-runtime` 分支与上游 `origin/main`，仅修改受上游变更影响的部分。

## Git Topology

| Remote | URL | Role |
|--------|-----|------|
| `origin` | gsd-build/get-shit-done | Upstream source |
| `fork` | a9257/get-shit-done | Our customized fork |
| Branch | `feat/qoder-runtime` | All Qoder work lives here |
| Backup | `backup/qoder-runtime-vX.Y` | Safety net before merge |

---

## 核心工作流（5 步）

```
拉取上游 → 增量适配 → 推送远程 → npx 全局安装 → 完整验证
```

### Step 1: 拉取上游最新

```bash
git fetch origin
git log --oneline feat/qoder-runtime..origin/main | head -20   # 查看新增提交
git diff --stat feat/qoder-runtime..origin/main                # 变更文件概览
```

重点分析：
- 上游是否新增/修改了 runtime 适配模式（搜索 `isAntigravity`, `isCopilot`, `isCline`, `isCodex`）
- `bin/install.js` 中哪些区域发生变动
- agents/skills/hooks 源文件是否有新增或改名
- 转换函数模板是否有更新

### Step 2: 增量适配 Qoder

**合并策略**：优先使用 `git merge origin/main` 或 `git rebase origin/main`。只在冲突特别严重、无法合理解决时才考虑 reset + 重写。

```bash
# 创建安全备份
git branch backup/qoder-runtime-$(date +%Y%m%d) feat/qoder-runtime

# 合并上游
git merge origin/main
# 或: git rebase origin/main
```

**冲突解决原则**：
- `bin/install.js` 冲突：保留上游结构，重新嵌入 Qoder 适配代码
- agents/skills/hooks 冲突：以上游为准，重新应用 Qoder 转换
- 其他文件：通常接受上游版本

**按变更类型做增量适配**：

| 上游变更类型 | 适配动作 |
|-------------|---------|
| 新增 runtime 适配模式 | 参考"适配参考清单"对齐，在对应位置加入 Qoder 分支 |
| 修改转换函数模板 | 参考"转换函数参考"同步更新 Qoder 转换函数 |
| 更新 agents/skills/hooks 源文件 | 同步 `.qoder/` 目录，重新应用转换 |
| 修改 `detectConfigDir` 或 hook 逻辑 | 确认 `.qoder` 仍在探测列表且无重复 |
| 新增测试 | 检查是否需要新增对应 Qoder 测试 |

### Step 3: 推送到远程

```bash
git push fork feat/qoder-runtime
```

如果 rebase 导致历史分叉：`git push fork feat/qoder-runtime --force-with-lease`

### Step 4: npx 全局安装

```bash
# 首选：从 GitHub 远程安装
npx --yes github:a9257/get-shit-done#feat/qoder-runtime --qoder --global

# 备用：本地安装（npx 失败时）
node bin/install.js --qoder --global
```

### Step 5: 完整验证

```bash
# 数量检查
echo "=== Agents ===" && ls ~/.qoder/agents/*.md | wc -l
echo "=== Skills ===" && find ~/.qoder -path "*/skills/*" -name "*.md" | wc -l
echo "=== Hooks ==="  && ls ~/.qoder/hooks/*.js 2>/dev/null | wc -l

# .claude 残留检查（≤ 2 为合理，.claudeignore 等正常残留）
echo "=== .claude残留 ===" && grep -rn '\.claude' ~/.qoder/agents/ --include="*.md" | grep -v 'Claude Code' | grep -v 'claudeignore' | wc -l

# 独立 Claude 引用检查（应为 0）
echo "=== 独立Claude引用 ===" && grep -rn '\bClaude\b' ~/.qoder/agents/ --include="*.md" | grep -v 'Claude Code' | grep -v 'claudeignore' | grep -v 'Qoder' | wc -l

# hooks 语法检查
for f in ~/.qoder/hooks/*.js; do node -c "$f" && echo "OK: $f"; done

# detectConfigDir 无重复
grep -n 'detectConfigDir\|\.qoder.*\.qoder' ~/.qoder/hooks/*.js
```

---

## 适配参考清单（增量检查项）

> **注意**：以下 19 个修改点是**参考检查项**，不是每次必做项。仅当上游变更影响到对应区域时才需要检查和修改。

### A. 参数 & Runtime 注册（5 项）

| # | 位置 | 内容 |
|---|------|------|
| 1 | Arg parsing | `const hasQoder = args.includes('--qoder');` |
| 2 | `--all` 列表 | `selectedRuntimes` 数组包含 `'qoder'` |
| 3 | Conditional push | `if (hasQoder) selectedRuntimes.push('qoder');` |
| 4 | `allRuntimes` 数组 | 包含 `'qoder'` |
| 5 | Interactive menu | `{ name: 'Qoder', value: 'qoder' }` |

### B. 目录 & 路径映射（3 项）

| # | 位置 | 内容 |
|---|------|------|
| 6 | `getDirName()` | `if (runtime === 'qoder') return '.qoder';` |
| 7 | `getConfigDirFromHome()` | `if (runtime === 'qoder') return "'.qoder'";` |
| 8 | `getGlobalDir()` | QODER_CONFIG_DIR 环境变量支持，默认 `~/.qoder` |

### C. 转换函数（3 项）

| # | 函数 | 用途 |
|---|------|------|
| 9 | `convertClaudeToQoderMarkdown()` | 主内容转换 |
| 10 | `convertClaudeCommandToQoderSkill()` | Skill 文件转换 |
| 11 | `convertClaudeAgentToQoderAgent()` | Agent 文件转换 + `convertQoderToolName()` |

### D. 安装流程（3 项）

| # | 位置 | 内容 |
|---|------|------|
| 12 | `copyCommandsAsQoderSkills()` | Skills 目录结构 `skills/gsd-*/SKILL.md` |
| 13 | `copyWithPathReplacement()` | `isQoder` 变量 + MD/JS 文件处理分支 |
| 14 | Agent install `else if` 链 | `} else if (isQoder) { content = convertClaudeAgentToQoderAgent(content); }` |

### E. 卸载 & 完成（3 项）

| # | 位置 | 内容 |
|---|------|------|
| 15 | Uninstall skills cleanup | 添加 `\|\| isQoder` 条件 |
| 16 | Uninstall label | `if (runtime === 'qoder') runtimeLabel = 'Qoder';` |
| 17 | `finishInstall` | `program = 'Qoder'`, `command = '/gsd-new-project'` |

### F. Help & Banner（2 项）

| # | 位置 | 内容 |
|---|------|------|
| 18 | Banner text | 添加 "Qoder" |
| 19 | Help text | `--qoder` 选项 + `QODER_CONFIG_DIR` 环境变量 |

---

## 转换函数参考

> 当上游修改了其他 runtime 的转换函数模板时，参考此代码同步更新 Qoder 转换函数。

```javascript
function convertClaudeToQoderMarkdown(content) {
  let converted = convertSlashCommandsToQoderSkillMentions(content);
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  // CLAUDE.md → AGENTS.md (4 patterns: backtick-wrapped, ./ prefixed, plain)
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`AGENTS.md`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, 'AGENTS.md');
  converted = converted.replace(/`CLAUDE\.md`/g, '`AGENTS.md`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, 'AGENTS.md');
  // Path replacements — ORDER MATTERS (specific before general)
  converted = converted.replace(/\.claude\/skills\//g, '.qoder/skills/');
  converted = converted.replace(/\.\/\.claude\//g, './.qoder/');
  converted = converted.replace(/\$HOME\/\.claude\b/g, '$HOME/.qoder');
  converted = converted.replace(/\$HOME\/\.claude\//g, '$HOME/.qoder/');
  converted = converted.replace(/~\/\.claude\b/g, '~/.qoder');
  converted = converted.replace(/~\/\.claude\//g, '~/.qoder/');
  converted = converted.replace(/\.\/\.claude\b/g, './.qoder');
  converted = converted.replace(/\.claude\//g, '.qoder/');  // general (must be last)
  // Remove Claude Code specific bug references
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  // Brand replacement
  converted = converted.replace(/\bClaude Code\b/g, 'Qoder');
  // CRITICAL: neutralize standalone "Claude" agent references
  converted = neutralizeAgentReferences(converted, 'AGENTS.md');
  return converted;
}
```

---

## 已知坑点

### 1. 路径替换顺序
`$HOME/.claude/` 和 `~/.claude/` 必须在通用 `.claude/` 替换**之前**。否则通用规则先匹配，特定前缀被跳过。bare 路径（无尾部 `/`）需要 `\b` 边界匹配。

### 2. Hook JS 文件中的 detectConfigDir
`detectConfigDir` 数组包含 `.claude` 是**故意的**（用于多运行时探测）。安装时的路径替换**不能**替换 hook JS 文件中的 `.claude` → `.qoder`，否则会产生重复条目。需要在 `copyWithPathReplacement` 中对 hook JS 文件做特殊处理。

### 3. Agent 安装 else if 链
`convertClaudeAgentToQoderAgent()` 必须在 agent 安装的 `else if` 链中有独立分支。仅在外层 `if (!isCopilot && !isAntigravity && !isQoder)` 排除不够——还需要在转换链中显式调用。

### 4. neutralizeAgentReferences
所有 `convertClaude*Markdown()` 函数 return 前必须调用 `neutralizeAgentReferences(converted, 'AGENTS.md')`。将独立的 "Claude" agent 引用替换为 "the agent"，参考 Antigravity/Codex/Copilot 实现。

### 5. npx GitHub 安装 vs NPM 安装
npx github 会克隆整个仓库（含 docs/tests），而 NPM 只下载 `package.json` files 字段。安装器报告的未替换引用中，docs/ 和 tests/ 下的属于正常。

### 6. Fork 禁用自动更新
Fork 分支不启用官方 npm 更新流程，避免覆盖自定义修改。但保留 `.qoder` 配置目录支持。

### 7. 命名规则
Qoder 仅支持 kebab-case（小写字母、数字、连字符）。`gsd:xxx` 格式不支持，必须转为 `gsd-xxx`。

---

## 验证清单

```
同步验证:
- [ ] git fetch origin & 分析上游变更范围
- [ ] 增量合并/适配完成（非全量重写）
- [ ] bin/install.js Qoder 适配点完整（受影响部分已更新）
- [ ] hooks/gsd-check-update.js detectConfigDir 含 .qoder 且无重复
- [ ] .qoder/ 目录与上游 .claude/ 数量对齐
- [ ] 测试通过: npx vitest run tests/qoder-install.test.cjs
- [ ] git push fork feat/qoder-runtime
- [ ] npx GitHub 远程安装成功
- [ ] agents .claude 残留 ≤ 2（.claudeignore 合理残留）
- [ ] 独立 "Claude" agent 引用 = 0
- [ ] hooks 语法全部通过
- [ ] detectConfigDir 无重复条目
```

## Additional Resources

- Closest reference runtime: **Antigravity**（搜索 `isAntigravity` in install.js）
- Backup branch naming: `backup/qoder-runtime-vX.Y` 或 `backup/qoder-runtime-YYYYMMDD`
