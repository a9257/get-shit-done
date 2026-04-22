---
name: qoder-upstream-sync
description: Sync Qoder fork from upstream GSD origin/main and rewrite complete Qoder runtime adaptation. Use when the user asks to rebase, sync upstream, update to latest version, or redo Qoder adaptation. Covers git reset, install.js 19-point adaptation, hooks, tests, .qoder directory sync, push, npx install, and end-to-end verification.
---

# Qoder Upstream Sync & Adaptation

Sync `feat/qoder-runtime` branch from upstream `origin/main` and rewrite complete Qoder runtime adaptation on the latest codebase.

## Git Topology

| Remote | URL | Role |
|--------|-----|------|
| `origin` | gsd-build/get-shit-done | Upstream source |
| `fork` | a9257/get-shit-done | Our customized fork |
| Branch | `feat/qoder-runtime` | All Qoder work lives here |
| Backup | `backup/qoder-runtime-vX.Y` | Safety net before reset |

## Workflow

```
Export Ref → Backup → Reset → Research Patterns → Rewrite → Test → Push → npx Install → Verify
```

### Task 1: Export & Backup

```bash
# Export current adaptation as reference
git diff origin/main..feat/qoder-runtime -- bin/install.js > /tmp/qoder-adaptation-reference.diff
cp bin/install.js /tmp/qoder-ref-install.js
cp hooks/gsd-check-update.js /tmp/qoder-ref-hooks.js

# Create backup branch
git branch backup/qoder-runtime-$(git describe --tags --abbrev=0 2>/dev/null || echo "prev") feat/qoder-runtime

# Reset to upstream
git fetch origin
git reset --hard origin/main
```

### Task 2: Research Upstream Patterns

Before writing code, study the latest `bin/install.js` to understand current runtime patterns:

```bash
# Check all registered runtimes
grep -n 'allRuntimes\|selectedRuntimes' bin/install.js | head -20

# Study a similar runtime's adaptation (Antigravity is closest reference)
grep -n 'antigravity\|Antigravity\|ANTIGRAVITY' bin/install.js | head -40

# Find the 19 modification points (search for any existing runtime name)
grep -n 'isAntigravity\|isCopilot\|isCline' bin/install.js | head -60
```

Key patterns to identify:
- Argument parsing block (~L70-110)
- `getDirName()`, `getConfigDirFromHome()`, `getGlobalDir()` functions
- `convertClaude*` conversion function family
- `copyWithPathReplacement()` JS/MD branch logic
- Agent install `else if` chain (~L5800-5900)
- Uninstall cleanup and labels
- `finishInstall` messaging
- Help text and `allRuntimes` array
- Interactive menu entries

### Task 3: Rewrite bin/install.js — 19 Modification Points

All modifications follow the pattern of existing runtimes (Antigravity/Copilot/Codex). Below is the **complete checklist**:

#### 3.1 Argument & Runtime Registration

| # | Location | What to add |
|---|----------|-------------|
| 1 | Arg parsing | `const hasQoder = args.includes('--qoder');` |
| 2 | `--all` list | Add `'qoder'` to selectedRuntimes array |
| 3 | Conditional push | `if (hasQoder) selectedRuntimes.push('qoder');` |
| 4 | `allRuntimes` array | Add `'qoder'` |
| 5 | Interactive menu | `{ name: 'Qoder', value: 'qoder' }` |

#### 3.2 Directory & Path Mapping

| # | Location | What to add |
|---|----------|-------------|
| 6 | `getDirName()` | `if (runtime === 'qoder') return '.qoder';` |
| 7 | `getConfigDirFromHome()` | `if (runtime === 'qoder') return "'.qoder'";` |
| 8 | `getGlobalDir()` | QODER_CONFIG_DIR env var support, default `~/.qoder` |

#### 3.3 Conversion Functions (CRITICAL)

| # | Function | Purpose |
|---|----------|---------|
| 9 | `convertClaudeToQoderMarkdown()` | Main content conversion |
| 10 | `convertClaudeCommandToQoderSkill()` | Skill file conversion |
| 11 | `convertClaudeAgentToQoderAgent()` | Agent file conversion + `convertQoderToolName()` |

**convertClaudeToQoderMarkdown** must include ALL these replacements (order matters):

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
  converted = converted.replace(/\$HOME\/\.claude\b/g, '$HOME/.qoder');   // bare path (no trailing /)
  converted = converted.replace(/\$HOME\/\.claude\//g, '$HOME/.qoder/');
  converted = converted.replace(/~\/\.claude\b/g, '~/.qoder');            // bare path
  converted = converted.replace(/~\/\.claude\//g, '~/.qoder/');
  converted = converted.replace(/\.\/\.claude\b/g, './.qoder');           // bare path
  converted = converted.replace(/\.claude\//g, '.qoder/');                // general (must be last)
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

#### 3.4 Installation Flow

| # | Location | What to add |
|---|----------|-------------|
| 12 | `copyCommandsAsQoderSkills()` | Skills dir structure `skills/gsd-*/SKILL.md` |
| 13 | `copyWithPathReplacement()` | `isQoder` var + MD/JS file processing branches |
| 14 | Agent install `else if` chain | `} else if (isQoder) { content = convertClaudeAgentToQoderAgent(content); }` |

#### 3.5 Uninstall & Finish

| # | Location | What to add |
|---|----------|-------------|
| 15 | Uninstall skills cleanup | Add `\|\| isQoder` condition |
| 16 | Uninstall label | `if (runtime === 'qoder') runtimeLabel = 'Qoder';` |
| 17 | `finishInstall` | `program = 'Qoder'`, `command = '/gsd-new-project'` |

#### 3.6 Help & Banner

| # | Location | What to add |
|---|----------|-------------|
| 18 | Banner text | Add "Qoder" |
| 19 | Help text | `--qoder` option + `QODER_CONFIG_DIR` env var |

### Task 4: Update hooks/gsd-check-update.js

Add `.qoder` to `detectConfigDir` directory list (**before** `.claude`):

```javascript
for (const dir of ['.qoder', '.claude', '.gemini', ...]) {
```

### Task 5: Update/Create Tests

Create `tests/qoder-install.test.cjs` with coverage for:
- `getDirName('qoder')` → `.qoder`
- `getConfigDirFromHome('qoder')` → `'.qoder'`
- `getGlobalDir` with QODER_CONFIG_DIR env var priority
- Path replacement correctness
- Source code integration tests (runtime in allRuntimes, menu entry exists)

### Task 6: Sync .qoder/ Directory

Copy latest agents, skills, hooks, manifest, settings from upstream `.claude/` structure:

```bash
# Compare counts with upstream
echo "Agents: $(ls .qoder/agents/*.md | wc -l)"
echo "Skills: $(find .qoder/skills -name 'SKILL.md' | wc -l)"
echo "Hooks: $(ls .qoder/hooks/*.js | wc -l)"
```

### Task 7: Test → Push → npx Install → Verify

```bash
# Run tests
npx vitest run tests/qoder-install.test.cjs
npx vitest run  # Full suite

# Push
git push fork feat/qoder-runtime

# Install from GitHub (NOT local)
npx --yes github:a9257/get-shit-done#feat/qoder-runtime --qoder --global

# Verify
echo "=== Agents ===" && ls ~/.qoder/agents/*.md | wc -l
echo "=== Skills ===" && find ~/.qoder -path "*/skills/*" -name "*.md" | wc -l
echo "=== .claude残留 ===" && grep -rn '\.claude' ~/.qoder/agents/ --include="*.md" | grep -v 'Claude Code' | grep -v 'claudeignore' | wc -l
echo "=== 独立Claude引用 ===" && grep -rn '\bClaude\b' ~/.qoder/agents/ --include="*.md" | grep -v 'Claude Code' | grep -v 'claudeignore' | grep -v 'Qoder' | wc -l
```

## Known Pitfalls

### 1. Path Replacement Order
`$HOME/.claude/` 和 `~/.claude/` 必须在通用 `.claude/` 替换**之前**。否则通用规则先匹配，特定前缀被跳过。bare 路径（无尾部 `/`）需要 `\b` 边界匹配。

### 2. Hook JS 文件中的 detectConfigDir
`detectConfigDir` 数组包含 `.claude` 是**故意的**（用于多运行时探测）。安装时的路径替换**不能**替换 hook JS 文件中的 `.claude` → `.qoder`，否则会产生重复条目。需要在 `copyWithPathReplacement` 中对 hook JS 文件做特殊处理。

### 3. Agent 安装 else if 链
`convertClaudeAgentToQoderAgent()` 必须在 agent 安装的 `else if` 链中有独立分支。仅在外层 `if (!isCopilot && !isAntigravity && !isQoder)` 排除不够——还需要在转换链中显式调用。

### 4. neutralizeAgentReferences
所有 `convertClaude*Markdown()` 函数 return 前必须调用 `neutralizeAgentReferences(converted, 'AGENTS.md')`。这将独立的 "Claude" agent 引用替换为 "the agent"，参考 Antigravity/Codex/Copilot 实现。

### 5. npx GitHub 安装 vs NPM 安装
npx github 会克隆整个仓库（含 docs/tests），而 NPM 只下载 `package.json` files 字段。安装器报告的未替换引用中，docs/ 和 tests/ 下的属于正常。

### 6. Fork 禁用自动更新
Fork 分支不启用官方 npm 更新流程，避免覆盖自定义修改。但保留 `.qoder` 配置目录支持。

### 7. 命名规则
Qoder 仅支持 kebab-case（小写字母、数字、连字符）。`gsd:xxx` 格式不支持，必须转为 `gsd-xxx`。

## Verification Checklist

```
Task Progress:
- [ ] 导出参考 diff 和备份分支
- [ ] git reset --hard origin/main
- [ ] 研究上游最新 runtime 模式
- [ ] bin/install.js 19 处修改全部完成
- [ ] hooks/gsd-check-update.js detectConfigDir 更新
- [ ] tests/qoder-install.test.cjs 通过
- [ ] .qoder/ 目录同步完成
- [ ] 全量测试通过
- [ ] git push fork feat/qoder-runtime
- [ ] npx GitHub 远程安装成功
- [ ] agents .claude 残留 ≤ 2（.claudeignore 合理残留）
- [ ] 独立 "Claude" agent 引用 = 0
- [ ] skills .claude 残留 = 0（superpowers 子仓库除外）
- [ ] hooks 语法全部通过
- [ ] detectConfigDir 无重复条目
```

## Additional Resources

- Reference diff: `/tmp/qoder-adaptation-reference.diff`
- Closest reference runtime: **Antigravity** (search `isAntigravity` in install.js)
- Backup branch naming: `backup/qoder-runtime-vX.Y`
