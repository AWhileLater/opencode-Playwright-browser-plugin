# opencode-Playwright-browser-plugin

Browser automation plugin for [OpenCode](https://opencode.ai) — navigate, click, type, screenshot, and execute JavaScript on any webpage using Playwright.

## Features

- **Zero config** — just add to `opencode.jsonc`, no MCP server needed
- **15 browser tools** — navigate, click, type, select, scroll, screenshot, evaluate JS, and more
- **Auto lifecycle** — Chromium starts on first use, cleans up on exit
- **Accessibility snapshots** — get interactive elements as @refs for precise interaction
- **Cross-platform** — works on Windows, macOS, and Linux

## Installation

### Method 1: Let OpenCode install it (recommended)

Copy this GitHub page URL and paste it to OpenCode with a prompt:

```
https://github.com/AWhileLater/opencode-Playwright-browser-plugin

Install this plugin for me
```

OpenCode will automatically:
1. Run `npm install` in your config directory
2. Add the plugin to `opencode.jsonc`
3. Download Chromium browser

Just restart OpenCode after it finishes.

### Method 2: Manual install

```bash
cd ~/.config/opencode
npm install AWhileLater/opencode-Playwright-browser-plugin
```

Chromium is downloaded automatically during install. If it fails:

```bash
npx playwright install chromium
```

Then add to `~/.config/opencode/opencode.jsonc`:

```json
{
  "plugin": ["opencode-Playwright-browser-plugin"]
}
```

Restart OpenCode after adding the plugin.

## Tools Reference

| Tool | Description |
|------|-------------|
| `browser_navigate(url)` | Navigate to URL, returns accessibility snapshot |
| `browser_snapshot()` | Get accessibility tree with interactive @refs |
| `browser_click(ref)` | Click element by @ref (e.g. @e1) |
| `browser_type(ref, text, clear?)` | Fill input field (default: clear first) |
| `browser_select(ref, value)` | Select option in combobox |
| `browser_press(key)` | Press keyboard key (Enter, Escape, Tab, etc.) |
| `browser_click_position(x, y)` | Click at pixel coordinates |
| `browser_scroll(direction, amount?)` | Scroll page (down/up/left/right) |
| `browser_back()` | Go back in history |
| `browser_forward()` | Go forward in history |
| `browser_screenshot(full_page?)` | Take a screenshot (returns PNG) |
| `browser_evaluate(script)` | Execute JavaScript in page context |
| `browser_get_text()` | Get all visible text on page |
| `browser_get_url()` | Get current page URL |
| `browser_close()` | Close browser and free resources |

## Usage Demo

### Open a webpage and interact

Ask OpenCode:

> "Go to google.com and search for 'Playwright'"

The plugin will:

```
1. browser_navigate("https://www.google.com")
   → Accessibility tree with @refs (search box @e1, search button @e2)

2. browser_type(@e1, "Playwright")
   → Fills the search box

3. browser_press("Enter")
   → Submits the search

4. browser_snapshot()
   → Returns fresh page state with search results
```

### Take a screenshot

> "Take a screenshot of the current page"

```
browser_screenshot()
→ Returns a PNG image
```

### Scrape page content

> "Get all the text from this page"

```
browser_get_text()
→ Returns all visible text content
```

### Execute JavaScript

> "Run document.title to check the page title"

```
browser_evaluate("document.title")
→ Returns the page title
```

### Full workflow example

In a single OpenCode session, you can:

> "Navigate to github.com/AWhileLater/opencode-Playwright-browser-plugin,
> take a screenshot of the repo page, and get the description text"

This translates to:

```
browser_navigate("https://github.com/AWhileLater/opencode-Playwright-browser-plugin")
  → snapshot with @refs (repo description, navigation links, etc.)

browser_screenshot()
  → returns PNG image of the repo page

browser_get_text()
  → returns all visible text from the repo page
```

### Close the browser

When finished, tell OpenCode:

> "Close the browser"

```
browser_close()
→ Browser closed, resources freed
```

## Workflow

```
Snapshot → Interact → Verify

browser_navigate("https://example.com")
  → heading "Welcome" @e1, link "Learn more" @e2

browser_click(@e2)
  → clicked, new snapshot returned

browser_snapshot()
  → refreshed state with fresh @refs
```

Always call `browser_snapshot()` after page changes to get updated @refs.

## Configuration

| Env variable | Default | Description |
|---|---|---|
| `BROWSER_HEADLESS` | `false` | Set to `true` to run headless (no visible UI) |

## Requirements

- OpenCode >= 1.0.0

## License

MIT
