# Token Monitor — 个人定制 / 改动记录 (Customizations & Changelog)

> 这是基于上游 [`Javis603/token-monitor`](https://github.com/Javis603/token-monitor)（MIT）的个人定制分支记录。
> 环境：macOS (Apple Silicon)，Claude Code 使用 `CLAUDE_CONFIG_DIR=~/.claude-personal`。
> 本文件汇总：安全审计结论、已修复的 bug、已新增的功能、待办改进建议、以及关键技术参考。

---

## 0. 总览 (Status at a glance)

| 类别 | 数量 | 状态 |
|---|---|---|
| 安全审计 | 1 轮 multi-agent 全量审计 | ✅ 无恶意代码，可安全运行 |
| 修复的 Bug | 5 | ✅ 全部修复 + 测试 |
| 新增功能 | 11 | ✅ 全部实现 + 测试 |
| 测试 | 526 → 532 | ✅ 全绿 |
| 待办改进建议 | 见 §4 | ⏳ 未实现 |

---

## 1. 安全审计结论 (Security Audit)

对全部 ~18k 行源码做了 multi-agent 审计（更新器/供应链、凭据/鉴权、网络外泄、Electron 安全、Hub 服务端、原生 FFI/文件系统）。

- **结论：可安全运行，0 处确认的恶意代码 / 后门 / 数据外泄。**
- 每个凭据只发往其官方 API（Anthropic / Cursor / OpenCode / DeepSeek），全部硬编码域名，无第三方外泄。
- 自更新器（`tokscaleUpdater.js`）异常严谨：仅 npm 官方源 + SHA-512 校验 + 包身份校验 + 拒绝符号/硬链接 + smoke test。
- 唯一 high 级 finding（Hub 默认绑 `0.0.0.0` + 可空密钥）经对抗验证降级为 low：hub 是 opt-in，GUI 会自动生成随机密钥，且只暴露聚合用量（无凭据/源码/对话）。
- `tokscale` 是预编译 Rust 二进制（adhoc 签名、未 Apple 公证）→ macOS Gatekeeper 会弹"未公证"提示，**非病毒**；机器码层面未逐条审计（开源预编译二进制通病）。

---

## 2. 修复的 Bug (Bugs Fixed)

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| B1 | Day 显示 0、历史很少（实际一直在用 CC） | `tokscale` 写死只扫 `~/.claude`，但本机 `CLAUDE_CONFIG_DIR=~/.claude-personal` | collector 新增 `resolvedClaudeConfigDir()`/`claudeProjectsDir()` + 合成 `--home` 符号链接树（`scan-home`），让 tokscale 扫到正确目录；JS 侧 session 时间戳 + 文件监听路径同步 |
| B2 | 点 session 显示 "transcript not found" | session-detail 解析链同样写死 `~/.claude`（B1 只修了 collector） | `resolveSessionFile`/`readSessionDetail`/`session:getDetail` 透传 `claudeConfigDir` |
| B3 | 只有顶部一小条能拖动 | 标题栏 30px 太矮 + 右侧 148px no-drag | 标题栏 30 → 56px；交互控件显式 no-drag |
| B4 | 设置齿轮按钮消失找不到 | 窗口 <280px 时整个 footer 被 `display:none` | 改为只隐藏次要内容、永远保留齿轮；齿轮默认放底部常驻 |
| B5 | DAY/MONTH/TOTAL 与右上角窗口按钮重叠 | 自己引入的回归：为"齿轮常驻"加的 CSS 把窗口按钮永久显示，与周期标签抢同一个 148px 框 | 移除该规则；齿轮改放底部（`settingsInTitlebar=false`） |

---

## 3. 新增功能 (Features Added)

### 3.1 设置项 (Settings)
| 功能 | 位置 | 说明 |
|---|---|---|
| 可调用量刷新频率 | Window → 刷新间隔 | 15s–15m，默认 5m；空闲时的重算频率（活动时仍秒级） |
| 数字动画开关 | Appearance → 数字变化动画 | 关闭=数字直接跳变 |
| 数字动画提速 | （内部） | 2.2s → 0.6s |
| 始终置顶（含全屏） | Window | macOS `screen-saver` 层级 + 跨全屏可见 |
| 更大默认窗口 | （内部） | 360×500 → 500×720 |
| 按模型看 cost | Appearance → 模型视图按花费排序 | Model 视图 cost 为主、按花费排序、柱长按花费 |
| **自定义数据目录** | Collection → Claude 数据目录 | 下拉自动识别 `~/.claude*` / `CLAUDE_CONFIG_DIR` + Browse；通用非专属 |
| 预算阈值 + 桌面通知 | Main → 每日/每月预算 | 到 50/80/100% 弹通知、金额变琥珀→红（单位 USD） |
| 今日 vs 昨日 | 主数字下方 | "↑18% vs 昨天"（需开启 History） |
| 月底花费预测 | Month 视图 | 按当前速度推算月底总花费 |
| **自定义单价覆盖** | Collection → 自定义单价 | 按模型填真实 input/output/cache 单价，或勾"免费"把订阅制模型计为 ~$0；写入 `~/.config/tokscale/custom-pricing.json`，纯本地不联网，数秒生效。**解决订阅制/列表价不准** |

### 3.2 布局 (Layout)
- **顶部视图 tab 栏**：把原底部循环按钮换成标题栏下方的横向 tab（tool/model/session/limits/trends/status），点击直达、高亮当前，遵循隐藏/排序偏好。
- 删除了底部左下角的循环按钮。

### 3.3 用量速率走势图 (Usage Rate Graph) — 弹出式仪表盘"速率"标签页
- 路径：widget 顶部 Trends tab → 点迷你图 → 弹出仪表盘 → **速率** 标签页。
- **指标可切换**：Token/分钟、成本/分钟、输出/分钟。
- **时间窗**：1h / 3h / 6h / 12h / 1d / 1w。
- **聚合粒度（aggregate）**：Auto / 30s / 1m / 5m / 15m / 1h。
- **数据来源（混合）**：细窗口自采样（每 tick 记录累计 today 值，算 Δ/时间）；早段 & 1d/1w 用 `tokscale hourly` 回填历史。
- 新增纯函数模块 `src/shared/rateSeries.js`（含单测）+ `usageCharts.js` 的折线/面积图引擎。

### 3.4 Session 名字带项目目录
- session 行从纯 UUID 改为显示**项目文件夹名**（从会话 `cwd` 提取），例：`token-monitor · claude-opus-4-8`。

---

## 4. 待办 / 改进建议 (Pending Improvements — NOT yet implemented)

来自 multi-agent 头脑风暴，按价值排序：

| 优先级 | 想法 | 说明 |
|---|---|---|
| 🔴 高 | 额度临近通知 | 某 provider 额度用到阈值时弹一次通知，复用已有额度数据，不增加联网 |
| 🔴 高 | 官方账单对账 ⭐ | 定期拉 Anthropic Admin Cost API，显示"估算 vs 实际账单"差额（需联网 + 组织级 admin API key） |

> 注：~~自定义单价覆盖 UI~~ 已实现（见 §3.1）。
| 🟡 中 | 键盘快捷键 | 1/2/3 切周期、Tab 切视图 |
| 🟡 中 | 按项目/仓库看花费 | 路径已编码项目目录，可聚合"哪个项目最烧钱" |
| 🟡 中 | 内联 7 天 sparkline | 主数字旁画迷你趋势线 |
| 🟡 中 | 紧凑/详细视图切换 | 小窗口塞更多行 |
| ⚪ 低 | 按花费强度给柱子上色 / 闲置降频变暗 / CSV 导出 / 托盘文字自定义 | 视觉/便利增强 |

---

## 5. 关键技术参考 (Technical Reference)

### 5.1 文件位置 (macOS)
| 文件 | 路径 |
|---|---|
| 设置 | `~/Library/Application Support/Token Monitor/settings.json` |
| 速率采样 | `~/Library/Application Support/Token Monitor/usage-rate.json` |
| tokscale 扫描合成 home | `~/Library/Application Support/Token Monitor/scan-home/`（`.claude` → `$CLAUDE_CONFIG_DIR` 符号链接） |
| Claude 会话（本机） | `~/.claude-personal/projects/<项目编码>/<uuid>.jsonl` |

### 5.2 速率采样行为
- **频率**：事件驱动——CC 写文件时 ~2–3.5s 一次，空闲时按"刷新间隔"（默认 5min）。
- **持久化**：写入 `usage-rate.json`（4s 防抖），重启不丢，保留约 13h 滚动窗口。
- **关闭期间**：不采样 → 细窗口有空档；1d/1w 由 tokscale 回填，不受影响。
- **回填**：细窗口中早于"首个样本"的部分用 tokscale hourly 按小时回填。

### 5.3 Cost 计算准确性（重要）
- token-monitor 自己不算钱，全靠 `tokscale`：四类 token（input/output/cache-read/cache-write）× 各自单价。
- 单价来自**社区公开列表价**（LiteLLM / models.dev / OpenRouter），**不是你的真实账单**。
- ⚠️ 订阅制（Claude Pro/Max 等固定月费）被按 API 列表价估算 → 是"API 等价成本"，非实付。
- ⚠️ `unknown` / `<synthetic>` 行查不到单价 → 显示 token 但 $0，会低估总额。
- ⚠️ 货币换算用写死汇率（TWD 31.5 / HKD 7.8 / CNY 6.8），从不更新。
- 最准方法：各家官方账单 API（如 Anthropic Admin Usage/Cost API）。建议把 tokscale 估算当趋势参考，月度与官方账单对账。

### 5.4 打包 / 发布
- 运行：`npm install && npm start`。打包 macOS：`npm run dist:mac`（产出 `dist/*.dmg`）。
- app **未签名未公证** → 分发后 Gatekeeper 需手动放行。
- `appUpdater.js` 检查的是**原作者** repo 的 releases；自行发布需改成自己的 repo。
- 测试：`node --test 'tests/**/*.test.js'`（532 全绿）。

### 5.5 改动文件清单（相对上游）
`src/shared/`: `collector.js`, `sessionFiles.js`, `sessionDetail.js`, `rateSeries.js`(新)
`src/electron/`: `main.js`, `preload.js`
`src/electron/renderer/`: `app.js`, `dashboard.js`, `usageCharts.js`, `sessionRows.js`, `index.html`, `dashboard.html`, `styles.css`, `dashboard.css`, `i18n.js`
`tests/shared/`: `rateSeries.test.js`(新), `sessionFiles.test.js`, `collectorForceLimits.test.js`, `collectorLoadGuards.test.js`

---

*最后更新：见 git 历史。本文件由定制过程逐步维护。*
