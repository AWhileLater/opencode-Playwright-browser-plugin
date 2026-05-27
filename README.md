# opencode-Playwright-browser-plugin

Browser automation plugin for [OpenCode](https://opencode.ai) — navigate, click, type, screenshot, and execute JavaScript on any webpage using Playwright.

## Features

- **Zero config** — just add to `opencode.jsonc`, no MCP server needed
- **15 browser tools** — navigate, click, type, select, scroll, screenshot, evaluate JS, and more
- **Auto lifecycle** — Chromium starts on first use, cleans up on exit
- **Accessibility snapshots** — get interactive elements as @refs for precise interaction

## Quick Start

```json
{
  "plugin": ["opencode-Playwright-browser-plugin"]
}
```

## Tools

| Tool | Description |
|------|-------------|
| `browser_navigate(url)` | Navigate to URL |
| `browser_snapshot()` | Get accessibility tree with @refs |
| `browser_click(ref)` | Click element by @ref |
| `browser_type(ref, text, clear?)` | Fill input field |
| `browser_select(ref, value)` | Select option |
| `browser_press(key)` | Press keyboard key |
| `browser_click_position(x, y)` | Click at coordinates |
| `browser_scroll(direction, amount?)` | Scroll page |
| `browser_back()` / `browser_forward()` | History navigation |
| `browser_screenshot(full_page?)` | Take screenshot (PNG) |
| `browser_evaluate(script)` | Run JavaScript |
| `browser_get_text()` | Get visible text |
| `browser_get_url()` | Get current URL |
| `browser_close()` | Close browser |

## Installation

```bash
cd ~/.config/opencode
npm install AWhileLater/opencode-Playwright-browser-plugin
```

Add to `opencode.jsonc`:

```json
{
  "plugin": ["opencode-Playwright-browser-plugin"]
}
```

Chromium will be downloaded automatically during `npm install` (postinstall script).
If it fails, run manually:

```bash
npx playwright install chromium
```

## Requirements

- OpenCode >= 1.0.0

## License

MIT
