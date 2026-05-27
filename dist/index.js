import { tool } from "@opencode-ai/plugin";
import { chromium } from "playwright";
import { execSync } from "child_process";
import { existsSync } from "fs";

const interactiveRoles = new Set([
  "button", "link", "textbox", "combobox", "checkbox", "radio",
  "menuitem", "option", "searchbox", "slider", "switch", "tab",
  "treeitem", "spinbutton", "listbox", "menuitemcheckbox", "menuitemradio"
]);

let browser = null;
let page = null;
let browserPromise = null;
let pageReady = false;
let toolQueue = Promise.resolve();
let refs = new Map();
let refCounter = 0;

function serial(fn) {
  toolQueue = toolQueue.then(fn, fn);
  return toolQueue;
}

function isChromiumInstalled() {
  try {
    const execPath = chromium.executablePath();
    return existsSync(execPath);
  } catch {
    try {
      const r = execSync("npx playwright install --dry-run chromium 2>&1", { encoding: "utf8", timeout: 10000 });
      return r.includes("already installed");
    } catch { return false; }
  }
}

function installChromium() {
  console.error("Chromium not found. Installing...");
  try {
    execSync("npx playwright install chromium 2>&1", { stdio: "inherit", timeout: 120000 });
    console.error("Chromium installed successfully.");
    return true;
  } catch (e) {
    console.error(`Failed to install Chromium: ${e.message}`);
    console.error("Run manually: npx playwright install chromium");
    return false;
  }
}

async function ensureChromium() {
  if (isChromiumInstalled()) return;
  if (!installChromium()) {
    throw new Error(
      "Playwright Chromium is not installed.\n" +
      "Run: npx playwright install chromium\n" +
      "Or set PLAYWRIGHT_BROWSERS_PATH to a custom location."
    );
  }
}

async function ensureBrowser() {
  if (browser && browser.isConnected()) return browser;
  if (browserPromise) return browserPromise;
  browserPromise = (async () => {
    await ensureChromium();
    const headless = process.env.BROWSER_HEADLESS === "true";
    browser = await chromium.launch({ headless });
    page = await browser.newPage();
    pageReady = true;
    browser.on("disconnected", () => {
      browser = null;
      page = null;
      pageReady = false;
      browserPromise = null;
    });
    return browser;
  })();
  return browserPromise;
}

async function ensurePage() {
  if (pageReady) return page;
  await ensureBrowser();
  return page;
}

function skipRole(role) {
  return ["StaticText", "InlineTextBox", "generic", "GenericContainer",
    "none", "presentation", "ListMarker", "SVGRoot", "Window"].includes(role);
}

function buildAXTree(cdpNodes) {
  const map = new Map();
  for (const n of cdpNodes) map.set(n.nodeId, { ...n, _children: [] });
  let root = null;
  for (const n of cdpNodes) {
    const node = map.get(n.nodeId);
    if (n.childIds) {
      for (const cid of n.childIds) {
        const child = map.get(cid);
        if (child) node._children.push(child);
      }
    }
    if (n.role?.value === "RootWebArea" || (!n.parentId && !root)) root = node;
  }
  return root;
}

function walkAXTree(node, depth, lines) {
  if (!node) return;
  const role = node.role?.value || "";
  if (skipRole(role) || node.ignored) {
    if (node._children) for (const c of node._children) walkAXTree(c, depth, lines);
    return;
  }
  const name = node.name?.value || "";
  const label = name ? `${role} "${name.slice(0, 120)}"` : role;
  let ref = null;
  const roleLower = role.toLowerCase();
  if (interactiveRoles.has(roleLower) && name) {
    refCounter++;
    ref = `@e${refCounter}`;
    refs.set(ref, { role: roleLower, name, nodeId: node.nodeId });
  }
  lines.push(`${"  ".repeat(depth)}${ref ? `${label} ${ref}` : label}`);
  if (node._children) for (const c of node._children) walkAXTree(c, depth + 1, lines);
}

async function getSnapshot() {
  const p = await ensurePage();
  refs.clear();
  refCounter = 0;
  await p.waitForTimeout(500);
  const cdp = await p.context().newCDPSession(p);
  const axResult = await cdp.send("Accessibility.getFullAXTree");
  if (!axResult.nodes || axResult.nodes.length === 0) {
    return { content: "No accessible content on this page.", refs: [] };
  }
  const root = buildAXTree(axResult.nodes);
  if (!root) return { content: "Could not build accessibility tree.", refs: [] };
  const lines = [];
  walkAXTree(root, 0, lines);
  return {
    content: lines.join("\n"),
    refs: Array.from(refs.entries()).map(([r, info]) => ({ ref: r, role: info.role, name: info.name }))
  };
}

async function findElement(ref) {
  const info = refs.get(ref);
  if (!info) throw new Error(`Unknown ref: ${ref}`);
  const p = await ensurePage();
  const locators = p.getByRole(info.role, { name: info.name, exact: true });
  const count = await locators.count();
  if (count === 0) {
    const fuzzy = p.getByRole(info.role, { name: info.name });
    const fuzzyCount = await fuzzy.count();
    if (fuzzyCount === 0) throw new Error(`Element ${ref} (${info.role} "${info.name}") not found`);
    return fuzzy;
  }
  return locators;
}

async function forceKillBrowser() {
  if (!browser) return;
  try {
    const childProcess = browser.process();
    if (childProcess) {
      try { childProcess.kill("SIGKILL"); } catch (_) {}
    }
  } catch (_) {}
  try { await browser.close(); } catch (_) {}
  browser = null;
  page = null;
  pageReady = false;
  browserPromise = null;
}

function cleanupSync() {
  if (!browser) return;
  try {
    const childProcess = browser.process();
    if (childProcess) {
      try { childProcess.kill("SIGKILL"); } catch (_) {}
    }
  } catch (_) {}
  try { browser.close().catch(() => {}); } catch (_) {}
  browser = null;
  page = null;
  pageReady = false;
  browserPromise = null;
}

process.on("exit", cleanupSync);
const origExit = process.exit;
process.exit = function(code) {
  cleanupSync();
  origExit(code);
};

function snapshotText(snap) {
  let text = `Accessibility Tree:\n${snap.content}`;
  if (snap.refs.length > 0) {
    text += `\n\nInteractive elements:\n`;
    for (const r of snap.refs) {
      text += `  ${r.ref}: ${r.role} "${r.name}"\n`;
    }
  }
  return text;
}

async function handleNavigate(args) {
  await ensureBrowser();
  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const snap = await getSnapshot();
  return `${snapshotText(snap)}`;
}

async function handleSnapshot() {
  await ensurePage();
  const snap = await getSnapshot();
  return snapshotText(snap);
}

async function handleClick(args) {
  const locators = await findElement(args.ref);
  await locators.first().click();
  await page.waitForTimeout(500);
  const snap = await getSnapshot();
  return `Clicked ${args.ref}\n\n${snapshotText(snap)}`;
}

async function handleType(args) {
  const locators = await findElement(args.ref);
  const el = locators.first();
  if (args.clear !== false) await el.fill("");
  await el.fill(args.text);
  return `Typed "${args.text.slice(0, 100)}" into ${args.ref}`;
}

async function handleSelect(args) {
  const locators = await findElement(args.ref);
  await locators.first().selectOption(args.value);
  return `Selected "${args.value}" in ${args.ref}`;
}

async function handleScroll(args) {
  const p = await ensurePage();
  const dx = args.direction === "right" ? args.amount : args.direction === "left" ? -args.amount : 0;
  const dy = args.direction === "down" ? args.amount : args.direction === "up" ? -args.amount : 0;
  await p.evaluate(({ dx, dy }) => window.scrollBy(dx, dy), { dx, dy });
  return `Scrolled ${args.direction} by ${args.amount}px`;
}

async function handleBack() {
  const p = await ensurePage();
  await p.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const snap = await getSnapshot();
  return snapshotText(snap);
}

async function handleForward() {
  const p = await ensurePage();
  await p.goForward({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const snap = await getSnapshot();
  return snapshotText(snap);
}

async function handleScreenshot(args) {
  const p = await ensurePage();
  const buffer = await p.screenshot({ fullPage: args.full_page === true, type: "png" });
  const base64 = buffer.toString("base64");
  return {
    output: `Screenshot captured (${buffer.length} bytes)`,
    attachments: [{
      type: "file",
      mime: "image/png",
      url: `data:image/png;base64,${base64}`,
      filename: "screenshot.png"
    }]
  };
}

async function handleGetText() {
  const p = await ensurePage();
  const text = await p.evaluate(() => document.body.innerText);
  return text;
}

async function handleGetUrl() {
  const p = await ensurePage();
  return p.url();
}

async function handleEvaluate(args) {
  const p = await ensurePage();
  let result;
  try {
    result = await p.evaluate(args.script);
  } catch (e) {
    result = { error: e.message };
  }
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

async function handlePress(args) {
  const p = await ensurePage();
  await p.keyboard.press(args.key);
  return `Pressed ${args.key}`;
}

async function handleClickPosition(args) {
  const p = await ensurePage();
  await p.mouse.click(args.x, args.y);
  await page.waitForTimeout(500);
  const snap = await getSnapshot();
  return `Clicked at (${args.x}, ${args.y})\n\n${snapshotText(snap)}`;
}

async function handleClose() {
  await forceKillBrowser();
  return "Browser closed";
}

const skillInstructions = `# Browser Automation Tools (opencode-browser-plugin)

You have access to browser automation tools. Follow this workflow:

## Workflow: Snapshot → Interact → Verify

1. **Start**: \`browser_navigate\` to open a URL (returns accessibility tree with @refs)
2. **Snapshot**: \`browser_snapshot\` after every page change to get fresh @refs
3. **Interact**: Use \`browser_click\`, \`browser_type\`, \`browser_select\` with @refs from latest snapshot
4. **Verify**: \`browser_screenshot\`, \`browser_get_text\`, or \`browser_snapshot\` to confirm

## Key Principles

1. **Snapshot first** — always \`browser_navigate\` or \`browser_snapshot\` to understand page structure and get @refs
2. **Use @refs for interaction** — click, type, select via refs from latest snapshot (e.g. @e1, @e2)
3. **Screenshots** — \`browser_screenshot\` returns a PNG image
4. **JavaScript** — \`browser_evaluate\` for direct page manipulation when tools can't reach elements
5. **Coordinate click** — \`browser_click_position\` as last resort for hard-to-reach elements
6. **Close when done** — call \`browser_close\` to clean up browser resources

## Available Tools

- \`browser_navigate(url)\` — navigate to URL
- \`browser_snapshot()\` — get accessibility tree with @refs
- \`browser_click(ref)\` — click element by @ref
- \`browser_type(ref, text, clear?)\` — fill input field
- \`browser_select(ref, value)\` — select option
- \`browser_press(key)\` — press keyboard key
- \`browser_click_position(x, y)\` — click at coordinates
- \`browser_scroll(direction, amount?)\` — scroll page
- \`browser_back()\` / \`browser_forward()\` — history navigation
- \`browser_screenshot(full_page?)\` — take screenshot
- \`browser_evaluate(script)\` — run JavaScript
- \`browser_get_text()\` — get all visible text
- \`browser_get_url()\` — get current URL
- \`browser_close()\` — close browser
`;

export const OpenCodeBrowserPlugin = async (_ctx) => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(skillInstructions);
    },
    tool: {
      browser_navigate: tool({
        description: "Navigate to a URL and return page accessibility snapshot with @refs for interactive elements",
        args: {
          url: tool.schema.string().describe("URL to navigate to")
        },
        execute: (args) => serial(() => handleNavigate(args))
      }),
      browser_snapshot: tool({
        description: "Get the current page accessibility tree snapshot with interactive elements as @refs. Call after every page change to get fresh @refs.",
        args: {},
        execute: () => serial(() => handleSnapshot())
      }),
      browser_click: tool({
        description: "Click an element by its @ref (e.g. @e1). Returns new snapshot with fresh @refs.",
        args: {
          ref: tool.schema.string().describe("Element ref like @e1")
        },
        execute: (args) => serial(() => handleClick(args))
      }),
      browser_type: tool({
        description: "Type text into an input element by @ref",
        args: {
          ref: tool.schema.string().describe("Element ref like @e2"),
          text: tool.schema.string().describe("Text to type"),
          clear: tool.schema.boolean().optional().describe("Clear existing text first (default: true)")
        },
        execute: (args) => serial(() => handleType(args))
      }),
      browser_select: tool({
        description: "Select an option in a combobox/select by @ref",
        args: {
          ref: tool.schema.string().describe("Element ref like @e4"),
          value: tool.schema.string().describe("Option value or label to select")
        },
        execute: (args) => serial(() => handleSelect(args))
      }),
      browser_scroll: tool({
        description: "Scroll the page in a direction",
        args: {
          direction: tool.schema.enum(["down", "up", "left", "right"]).describe("Scroll direction"),
          amount: tool.schema.number().optional().default(500).describe("Scroll amount in pixels")
        },
        execute: (args) => serial(() => handleScroll(args))
      }),
      browser_back: tool({
        description: "Go back to the previous page and return snapshot",
        args: {},
        execute: () => serial(() => handleBack())
      }),
      browser_forward: tool({
        description: "Go forward to the next page and return snapshot",
        args: {},
        execute: () => serial(() => handleForward())
      }),
      browser_screenshot: tool({
        description: "Take a screenshot of the current page (returns a PNG image)",
        args: {
          full_page: tool.schema.boolean().optional().default(false).describe("Capture full page (not just viewport)")
        },
        execute: (args) => serial(() => handleScreenshot(args))
      }),
      browser_get_text: tool({
        description: "Get all visible text content from the current page",
        args: {},
        execute: () => serial(() => handleGetText())
      }),
      browser_get_url: tool({
        description: "Get the current page URL",
        args: {},
        execute: () => serial(() => handleGetUrl())
      }),
      browser_evaluate: tool({
        description: "Execute JavaScript in the page context and return the result",
        args: {
          script: tool.schema.string().describe("JavaScript code to execute")
        },
        execute: (args) => serial(() => handleEvaluate(args))
      }),
      browser_press: tool({
        description: "Press a keyboard key (e.g. Enter, Escape, Tab, ArrowDown)",
        args: {
          key: tool.schema.string().describe("Key to press (e.g. Enter, Escape, Tab)")
        },
        execute: (args) => serial(() => handlePress(args))
      }),
      browser_click_position: tool({
        description: "Click at specific pixel coordinates (useful for canvas or hard-to-reach elements)",
        args: {
          x: tool.schema.number().describe("X coordinate"),
          y: tool.schema.number().describe("Y coordinate")
        },
        execute: (args) => serial(() => handleClickPosition(args))
      }),
      browser_close: tool({
        description: "Close the browser and end the session. Call this when done to free resources.",
        args: {},
        execute: () => serial(() => handleClose())
      })
    }
  };
};

export default OpenCodeBrowserPlugin;
