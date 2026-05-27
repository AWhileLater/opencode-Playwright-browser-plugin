---
name: browser-plugin
description: Browser automation via Playwright — navigate, click, type, screenshot, and execute JavaScript on any webpage
license: MIT
compatibility: opencode
---

# Browser Automation (opencode-browser-plugin)

Self-managed browser automation via Playwright, built into an OpenCode plugin. **No Chrome extension needed, no user Chrome required.** The plugin starts its own Chromium instance on first tool call and closes it on exit.

## Architecture

```
opencode CLI  ←→  Plugin (opencode-browser-plugin)  ←→  Playwright
                                                          ↕  Chromium
```

## Available Tools

### Navigation & Page Reading
- `browser_navigate(url)` — navigate to URL, return snapshot with @refs
- `browser_snapshot()` — get current page accessibility tree snapshot
- `browser_get_text()` — get all visible text content
- `browser_get_url()` — get current page URL

### Interaction
- `browser_click(ref)` — click element by @ref (e.g. @e1)
- `browser_type(ref, text, clear?)` — fill input field
- `browser_select(ref, value)` — select option in combobox
- `browser_press(key)` — press keyboard key
- `browser_click_position(x, y)` — click at pixel coordinates

### Navigation History
- `browser_back()` / `browser_forward()`

### Page Control
- `browser_scroll(direction, amount?)` — scroll page
- `browser_screenshot(full_page?)` — screenshot (returns PNG image)
- `browser_evaluate(script)` — execute JavaScript
- `browser_close()` — close browser and end session

## Workflow

```
1. browser_navigate("https://example.com")  → snapshot with @refs
2. browser_click(@e1)                        → new snapshot
3. browser_snapshot()                         → verify state
```

## Troubleshooting

- **Browser launch fails**: `npx playwright install chromium`
- **Headless mode**: set env `BROWSER_HEADLESS=true`
- **Element not found**: call `browser_snapshot()` again after page load
