# DeepSeek Cache Monitor

A dependency-free local dashboard for monitoring DeepSeek prompt-cache hit rates from OpenCodex usage logs.

## Features

- Cache hit rate, hit/miss token counts, and request totals
- Time ranges: 1 hour, 5 hours, 1 day, 7 days, 30 days, or all time
- Per-model statistics and recent-request details
- Auto-refreshes every 5 seconds
- Read-only: it does not modify Codex, OpenCodex, or the usage log
- Uses only Node.js built-in modules

## Requirements

- Node.js 18 or newer
- OpenCodex usage log in JSONL format, or another compatible log file

## Usage

PowerShell:

```powershell
node .\deepseek-cache-monitor.js 8790
```

Then open <http://127.0.0.1:8790/>.

The default log path is:

```text
<user-home>/.opencodex/usage.jsonl
```

To use another log file:

```powershell
$env:CODEX_USAGE_LOG = "C:\path\to\usage.jsonl"
node .\deepseek-cache-monitor.js 8790
```

The port can also be set with `DEEPSEEK_CACHE_PORT`.

## Data handling

The monitor reads the local log file and exposes the dashboard only on `127.0.0.1`. It does not send log data to any remote service. Do not commit API keys, Codex configuration files, or personal usage logs.

## Cache calculation

For each request, the monitor reads the cached-input and total-input token fields when available:

```text
cache hit rate = cached input tokens / total input tokens
```

The exact field names depend on the proxy/provider log format. The script recognizes common OpenCodex and DeepSeek-compatible names, including `cachedInputTokens`, `promptCacheHitTokens`, and `prompt_cache_hit_tokens`.

## License

No license has been selected yet. Add one if you plan to accept external contributions or define reuse permissions.
