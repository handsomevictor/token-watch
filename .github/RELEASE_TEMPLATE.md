Personal fork of [Token Monitor](https://github.com/Javis603/token-monitor) by **@Javis603** (MIT). Full credit to the original author — this fork adds personal customizations; see [docs/CUSTOMIZATIONS.md](https://github.com/handsomevictor/token-watch/blob/main/docs/CUSTOMIZATIONS.md).

**Open-source build, not paid-signed** — macOS / Windows will warn on first launch (instructions below).

## Which file should I download?
- **macOS (Apple Silicon, M1 and later)** — the `.dmg`
- **Windows 10/11** — `Token Monitor Setup ….exe` (installer, recommended) or `Token Monitor ….exe` (portable)
- The macOS `.zip` is the same app repackaged — ignore unless you need it. Intel Macs / Linux: run from source per the [README](https://github.com/handsomevictor/token-watch#readme).

## Open it past the security warning
- **macOS:** right-click the app → **Open** → **Open**, or run `xattr -dr com.apple.quarantine "/Applications/Token Monitor.app"`
- **Windows:** SmartScreen → **More info** → **Run anyway**

## What's in this fork
- Custom Claude data directory (`CLAUDE_CONFIG_DIR` / auto-detect)
- Usage rate graph (tokens / cost / output per minute, 1h–1w, selectable aggregation)
- Custom pricing overrides (mark subscription models as ~$0 for realistic cost)
- Top view-tab bar, cost-by-model ranking, budget alerts, project + AI-title session names
