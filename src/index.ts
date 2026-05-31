#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BROWSER_CATALOG } from "./browsers.js";
import * as act from "./actions.js";

const browserKindSchema = z.enum(["chromium", "chrome", "edge", "firefox"]);

const AGENT_INSTRUCTIONS = `You control a real browser ONLY via browser_* MCP tools below.
NEVER create or run .mjs/.js helper scripts in the project — all automation goes through these tools.

Workflow:
1. browser_navigate (or browser_launch) — opens a visible window; blue BOT cursor is always on screen.
2. browser_snapshot — get element refs, then browser_click / browser_fill_ref / browser_hover.
3. Or use browser_click_selector, browser_click_text, browser_click_role without snapshot.
4. browser_wait / browser_wait_for when pages load slowly.
5. browser_screenshot to verify state.
6. Links that open a **new tab** are auto-detected — focus switches to the new tab. Use browser_tabs to list/switch manually.

The virtual cursor moves smoothly to every target before click/type. Every click shows press + ripple animation.`;

function clickReply(label: string, tabNote?: string) {
  const extra = tabNote ? `\n${tabNote}` : "";
  return { content: [{ type: "text" as const, text: `${label}${extra}` }] };
}

const server = new McpServer(
  {
    name: "browser-control-mcp",
    version: "0.5.1",
  },
  { instructions: AGENT_INSTRUCTIONS }
);

server.tool("browser_list", "Supported browsers: chromium, chrome, edge, firefox.", {}, async () => {
  const lines = BROWSER_CATALOG.map(
    (b) => `- ${b.kind}: ${b.label} — ${b.description}${b.installHint ? ` (${b.installHint})` : ""}`
  );
  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
});

server.tool(
  "browser_launch",
  "Open visible browser (BOT cursor always shown). browser=chromium|chrome|edge|firefox.",
  { browser: browserKindSchema.optional() },
  async (args) => {
    const { kind, label } = await act.launchSession({ browser: args.browser, headless: false });
    return { content: [{ type: "text", text: `Launched ${label} (${kind}). BOT cursor active.` }] };
  }
);

server.tool("browser_status", "Active session URL and browser engine.", {}, async () => {
  const info = act.getSessionInfo();
  if (!info.active) return { content: [{ type: "text", text: "No session. Call browser_navigate or browser_launch." }] };
  const tabs = await act.listBrowserTabs();
  const tabLines = tabs.map((t) => `  [${t.index}]${t.active ? " *" : ""} ${t.title || t.url}`).join("\n");
  return {
    content: [
      {
        type: "text",
        text: `${info.label} (${info.kind})\nActive: ${info.url ?? "(blank)"}\nTabs (${info.tabCount ?? tabs.length}):\n${tabLines || "  (none)"}`,
      },
    ],
  };
});

server.tool(
  "browser_tabs",
  "List open tabs or switch active tab. New-tab links are auto-focused after clicks.",
  {
    action: z.enum(["list", "switch"]),
    index: z.number().int().min(0).optional(),
    urlIncludes: z.string().optional(),
  },
  async (args) => {
    if (args.action === "list") {
      const tabs = await act.listBrowserTabs();
      const lines = tabs.map(
        (t) => `[${t.index}]${t.active ? " (active)" : ""} ${t.title}\n    ${t.url}`
      );
      return { content: [{ type: "text", text: lines.join("\n") || "No tabs" }] };
    }
    const tab = await act.switchBrowserTab({ index: args.index, urlIncludes: args.urlIncludes });
    return {
      content: [{ type: "text", text: `Active tab [${tab.index}]: ${tab.title}\n${tab.url}` }],
    };
  }
);

server.tool(
  "browser_navigate",
  "Go to URL. Visible window + smooth BOT cursor. Never use external scripts.",
  {
    url: z.string().min(1),
    browser: browserKindSchema.optional(),
  },
  async (args) => {
    const url = args.url.startsWith("http") ? args.url : `https://${args.url}`;
    const r = await act.navigate(url, { browser: args.browser, headless: false });
    return { content: [{ type: "text", text: `OK ${r.finalUrl} (${r.label})` }] };
  }
);

server.tool("browser_back", "Browser back.", {}, async () => {
  await act.goBack();
  const i = await act.getPageInfo();
  return { content: [{ type: "text", text: i.url }] };
});

server.tool("browser_forward", "Browser forward.", {}, async () => {
  await act.goForward();
  const i = await act.getPageInfo();
  return { content: [{ type: "text", text: i.url }] };
});

server.tool("browser_reload", "Reload page.", {}, async () => {
  await act.reload();
  const i = await act.getPageInfo();
  return { content: [{ type: "text", text: i.url }] };
});

server.tool(
  "browser_get_page_info",
  "Current URL and document title.",
  {},
  async () => {
    const i = await act.getPageInfo();
    return { content: [{ type: "text", text: `URL: ${i.url}\nTitle: ${i.title}` }] };
  }
);

server.tool(
  "browser_snapshot",
  "Page tree with refs for browser_click / browser_fill_ref / browser_hover / browser_scroll_to_ref.",
  {},
  async () => {
    const yaml = await act.snapshot();
    return { content: [{ type: "text", text: yaml }] };
  }
);

server.tool(
  "browser_wait",
  "Pause milliseconds (max 120000). Cursor stays visible.",
  { ms: z.number().int().positive() },
  async (args) => {
    await act.waitMs(args.ms);
    return { content: [{ type: "text", text: `Waited ${args.ms}ms` }] };
  }
);

server.tool(
  "browser_wait_for",
  "Wait until selector, text, or URL fragment appears.",
  {
    selector: z.string().optional(),
    text: z.string().optional(),
    urlIncludes: z.string().optional(),
    timeoutMs: z.number().optional(),
  },
  async (args) => {
    await act.waitFor(args);
    return { content: [{ type: "text", text: "Condition met." }] };
  }
);

server.tool(
  "browser_click",
  "Click element by ref from browser_snapshot. Smooth cursor + click animation.",
  {
    ref: z.string(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    doubleClick: z.boolean().optional(),
  },
  async (args) => {
    const note = await act.clickRef(args.ref, args);
    return clickReply(`Clicked ${args.ref}`, note);
  }
);

server.tool(
  "browser_click_selector",
  "Click by CSS selector (e.g. #submit, button.ytp-play-button).",
  {
    selector: z.string(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    doubleClick: z.boolean().optional(),
  },
  async (args) => {
    const note = await act.clickSelector(args.selector, args);
    return clickReply(`Clicked ${args.selector}`, note);
  }
);

server.tool(
  "browser_click_text",
  "Click element containing visible text (e.g. Accept all, 재생, Sign in).",
  {
    text: z.string(),
    exact: z.boolean().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
  },
  async (args) => {
    await act.clickText(args.text, args);
    return { content: [{ type: "text", text: `Clicked text "${args.text}"` }] };
  }
);

server.tool(
  "browser_click_role",
  "Click by accessibility role + name (e.g. role=button name=Subscribe).",
  {
    role: z.string(),
    name: z.string(),
    exact: z.boolean().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
  },
  async (args) => {
    await act.clickRole(args.role, args.name, args);
    return { content: [{ type: "text", text: `Clicked ${args.role} "${args.name}"` }] };
  }
);

server.tool(
  "browser_click_xy",
  "Click viewport coordinates with cursor animation.",
  {
    x: z.number(),
    y: z.number(),
    button: z.enum(["left", "right", "middle"]).optional(),
    doubleClick: z.boolean().optional(),
  },
  async (args) => {
    const note = await act.clickAt(args.x, args.y, args.button, args.doubleClick);
    return clickReply(`Clicked (${args.x},${args.y})`, note);
  }
);

server.tool(
  "browser_hover",
  "Move BOT cursor to ref (from snapshot) without clicking.",
  { ref: z.string() },
  async (args) => {
    await act.hoverRef(args.ref);
    return { content: [{ type: "text", text: `Hover ${args.ref}` }] };
  }
);

server.tool(
  "browser_hover_selector",
  "Move BOT cursor to CSS selector.",
  { selector: z.string() },
  async (args) => {
    await act.hoverSelector(args.selector);
    return { content: [{ type: "text", text: `Hover ${args.selector}` }] };
  }
);

server.tool(
  "browser_drag",
  "Drag from (fromX,fromY) to (toX,toY) with cursor following.",
  {
    fromX: z.number(),
    fromY: z.number(),
    toX: z.number(),
    toY: z.number(),
  },
  async (args) => {
    await act.drag(args.fromX, args.fromY, args.toX, args.toY);
    return { content: [{ type: "text", text: "Drag done." }] };
  }
);

server.tool(
  "browser_fill",
  "Fill input by CSS selector; cursor moves to field first.",
  { selector: z.string(), value: z.string() },
  async (args) => {
    await act.fillSelector(args.selector, args.value);
    return { content: [{ type: "text", text: `Filled ${args.selector}` }] };
  }
);

server.tool(
  "browser_fill_ref",
  "Fill input by snapshot ref.",
  { ref: z.string(), value: z.string() },
  async (args) => {
    await act.fillRef(args.ref, args.value);
    return { content: [{ type: "text", text: `Filled ${args.ref}` }] };
  }
);

server.tool(
  "browser_type",
  "Type text character-by-character; cursor on field. submit=true presses Enter. delayMs=90 default.",
  {
    text: z.string(),
    submit: z.boolean().optional(),
    delayMs: z.number().optional(),
  },
  async (args) => {
    await act.typeText(args.text, args.submit ?? false, args.delayMs ?? 28);
    return { content: [{ type: "text", text: `Typed: ${args.text}` }] };
  }
);

server.tool(
  "browser_select_option",
  "Select dropdown option by CSS selector.",
  { selector: z.string(), value: z.string() },
  async (args) => {
    await act.selectOption(args.selector, args.value);
    return { content: [{ type: "text", text: `Selected ${args.value}` }] };
  }
);

server.tool(
  "browser_press_key",
  "Press key (Enter, Escape, Tab, ArrowDown, k, Space, ...).",
  { key: z.string() },
  async (args) => {
    await act.pressKey(args.key);
    return { content: [{ type: "text", text: `Key ${args.key}` }] };
  }
);

server.tool(
  "browser_scroll",
  "Scroll page; cursor stays in view. direction up|down|left|right.",
  {
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number().optional(),
  },
  async (args) => {
    await act.scroll(args.direction, args.amount);
    return { content: [{ type: "text", text: `Scrolled ${args.direction}` }] };
  }
);

server.tool(
  "browser_scroll_to_ref",
  "Scroll element into view then move cursor to it.",
  { ref: z.string() },
  async (args) => {
    await act.scrollToRef(args.ref);
    return { content: [{ type: "text", text: `Scrolled to ${args.ref}` }] };
  }
);

server.tool(
  "browser_evaluate",
  "Run JavaScript expression in page; returns JSON-serializable result.",
  { expression: z.string() },
  async (args) => {
    const result = await act.evaluate(args.expression);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "browser_screenshot",
  "PNG screenshot (BOT cursor visible in image).",
  { fullPage: z.boolean().optional() },
  async (args) => {
    const b64 = await act.screenshotBase64(args.fullPage ?? false);
    return {
      content: [
        { type: "text", text: "Screenshot:" },
        { type: "image", data: b64, mimeType: "image/png" },
      ],
    };
  }
);

server.tool("browser_close", "Close browser.", {}, async () => {
  await act.closeSession();
  return { content: [{ type: "text", text: "Closed." }] };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("browser-control-mcp v0.3 — BOT cursor always on");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
