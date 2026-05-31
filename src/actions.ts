import type { Page } from "playwright";
import { ensureBotOverlay, applyBotOverlayToAllPages } from "./bot-overlay.js";
import { getDevMode, setDevMode, typingDelayMs } from "./dev-mode.js";
import { CURSOR_BUILD_ID } from "./cursor-build.js";
import { ensureCursorOnPage, refreshCursorOnContext, spawnCursorImmediately } from "./virtual-cursor.js";
import {
  botActAt,
  botActOnLocator,
  botEnterPage,
  botMoveTo,
  centerOfLocator,
  viewportCenter,
} from "./cursor-motion.js";
import { captureAccessibilitySnapshot, getRefStore, resolveRefToCenter } from "./snapshot.js";
import {
  ensureSession,
  getSession,
  setActivePage,
  type LaunchOptions,
} from "./browser-manager-session.js";
import { browserKindLabel } from "./browsers.js";
import { getActivePage } from "./tabs.js";

async function getPage(): Promise<Page> {
  await ensureSession({ headless: false });
  const p = getActivePage();
  if (!p) throw new Error("No active browser page");
  return p;
}

export async function navigate(url: string, options?: LaunchOptions) {
  const s = await ensureSession({ ...options, headless: options?.headless ?? false });
  let page = s.page;
  if (page.isClosed()) {
    page = await s.context.newPage();
    setActivePage(page);
  }
  await spawnCursorImmediately(page);
  await ensureBotOverlay(page);
  await page.goto(url, { waitUntil: "commit", timeout: 45_000 });
  void page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
  await spawnCursorImmediately(page);
  await ensureBotOverlay(page);
  return {
    finalUrl: page.url(),
    browser: s.kind,
    label: browserKindLabel(s.kind),
  };
}

export async function goBack() {
  const p = await getPage();
  await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  await botEnterPage(p);
}

export async function goForward() {
  const p = await getPage();
  await p.goForward({ waitUntil: "domcontentloaded" }).catch(() => {});
  await botEnterPage(p);
}

export async function reload() {
  const p = await getPage();
  await p.reload({ waitUntil: "domcontentloaded" });
  await botEnterPage(p);
}

export async function snapshot(quick = false) {
  const p = await getPage();
  await spawnCursorImmediately(p);
  return captureAccessibilitySnapshot(p, { quick });
}

export async function waitReady(opts?: {
  selector?: string;
  text?: string;
  timeoutMs?: number;
}) {
  const p = await getPage();
  const timeout = opts?.timeoutMs ?? 6000;
  await Promise.all([
    p.waitForLoadState("domcontentloaded", { timeout }).catch(() => {}),
    opts?.selector
      ? p.locator(opts.selector).first().waitFor({ state: "visible", timeout }).catch(() => {})
      : Promise.resolve(),
    opts?.text
      ? p.getByText(opts.text, { exact: false }).first().waitFor({ state: "visible", timeout }).catch(() => {})
      : Promise.resolve(),
  ]);
  await spawnCursorImmediately(p);
  await ensureBotOverlay(p);
  return { url: p.url(), title: await p.title() };
}

export async function refreshBrowserCursor() {
  const s = getSession();
  if (!s) {
    await ensureSession({ headless: false });
    const s2 = getSession();
    if (!s2) throw new Error("No browser session");
    await refreshCursorOnContext(s2.context);
    return { cursorBuildId: CURSOR_BUILD_ID };
  }
  await refreshCursorOnContext(s.context);
  return { cursorBuildId: CURSOR_BUILD_ID };
}

export async function configureDevMode(opts: {
  enabled?: boolean;
  lockInput?: boolean;
  vignette?: boolean;
  fast?: boolean;
}) {
  const cfg = setDevMode(opts);
  const s = getSession();
  if (s) {
    const pages = s.context.pages().filter((pg) => !pg.isClosed());
    await applyBotOverlayToAllPages(pages);
    await Promise.all(
      pages.map((pg) =>
        pg.evaluate((fast) => {
          window.__agentFastMotion = fast;
        }, cfg.fast && cfg.enabled)
      )
    );
  }
  return cfg;
}

export async function devStart(url?: string, port = 3000) {
  setDevMode({ enabled: true, lockInput: true, vignette: true, fast: true });
  await ensureSession({ headless: false });
  const target =
    url ??
    process.env.BROWSER_CONTROL_DEV_URL ??
    `http://localhost:${process.env.BROWSER_CONTROL_DEV_PORT ?? port}`;
  const r = await navigate(target.startsWith("http") ? target : `http://${target}`);
  return { ...r, devUrl: target, devMode: getDevMode() };
}

export function getDevModeStatus() {
  return getDevMode();
}

export async function getPageInfo() {
  const p = await getPage();
  await ensureCursorOnPage(p);
  return { url: p.url(), title: await p.title() };
}

export async function waitMs(ms: number) {
  const p = await getPage();
  await ensureCursorOnPage(p);
  await p.waitForTimeout(Math.min(Math.max(0, ms), 120_000));
}

export async function waitFor(opts: {
  selector?: string;
  text?: string;
  urlIncludes?: string;
  timeoutMs?: number;
}) {
  const p = await getPage();
  const timeout = opts.timeoutMs ?? 30_000;
  if (opts.selector) await p.locator(opts.selector).first().waitFor({ state: "visible", timeout });
  if (opts.text) await p.getByText(opts.text, { exact: false }).first().waitFor({ state: "visible", timeout });
  if (opts.urlIncludes) await p.waitForURL((u) => u.toString().includes(opts.urlIncludes!), { timeout });
  await ensureCursorOnPage(p);
}

export async function clickRef(
  ref: string,
  opts?: { offsetX?: number; offsetY?: number; button?: "left" | "right" | "middle"; doubleClick?: boolean }
): Promise<string | undefined> {
  const p = await getPage();
  const center = await resolveRefToCenter(p, ref);
  if (!center) throw new Error(`Unknown ref "${ref}". Run browser_snapshot first.`);
  const r = await botActAt(p, center.x + (opts?.offsetX ?? 0), center.y + (opts?.offsetY ?? 0), {
    click: true,
    button: opts?.button,
    doubleClick: opts?.doubleClick,
  });
  return r.tabMessage;
}

export async function clickSelector(
  selector: string,
  opts?: { offsetX?: number; offsetY?: number; button?: "left" | "right" | "middle"; doubleClick?: boolean }
): Promise<string | undefined> {
  const p = await getPage();
  const loc = p.locator(selector).first();
  const c = await centerOfLocator(loc);
  if (!c) throw new Error(`Element not visible: ${selector}`);
  const r = await botActAt(p, c.x + (opts?.offsetX ?? 0), c.y + (opts?.offsetY ?? 0), {
    click: true,
    button: opts?.button,
    doubleClick: opts?.doubleClick,
  });
  return r.tabMessage;
}

export async function clickRole(
  role: string,
  name: string,
  opts?: { offsetX?: number; offsetY?: number; button?: "left" | "right" | "middle"; exact?: boolean }
) {
  const p = await getPage();
  const loc = p.getByRole(role as Parameters<Page["getByRole"]>[0], {
    name,
    exact: opts?.exact ?? false,
  }).first();
  await botActOnLocator(p, loc, { click: true, button: opts?.button });
}

export async function clickText(
  text: string,
  opts?: { exact?: boolean; button?: "left" | "right" | "middle" }
) {
  const p = await getPage();
  const loc = p.getByText(text, { exact: opts?.exact ?? false }).first();
  await botActOnLocator(p, loc, { click: true, button: opts?.button });
}

export async function clickAt(
  x: number,
  y: number,
  button: "left" | "right" | "middle" = "left",
  doubleClick = false
): Promise<string | undefined> {
  const p = await getPage();
  const r = await botActAt(p, x, y, { click: true, button, doubleClick });
  return r.tabMessage;
}

export async function listBrowserTabs() {
  const { listTabsWithTitles } = await import("./tabs.js");
  return listTabsWithTitles();
}

export async function switchBrowserTab(opts: { index?: number; urlIncludes?: string }) {
  const { switchToTab, switchToTabMatching } = await import("./tabs.js");
  if (opts.urlIncludes) return switchToTabMatching(opts.urlIncludes);
  return switchToTab(opts.index ?? 0);
}

export async function hoverRef(ref: string) {
  const p = await getPage();
  const center = await resolveRefToCenter(p, ref);
  if (!center) throw new Error(`Unknown ref "${ref}"`);
  await botMoveTo(p, center.x, center.y);
  await p.mouse.move(center.x, center.y);
}

export async function hoverSelector(selector: string) {
  const p = await getPage();
  const loc = p.locator(selector).first();
  const c = await centerOfLocator(loc);
  if (!c) throw new Error(`Not visible: ${selector}`);
  await botMoveTo(p, c.x, c.y);
  await p.mouse.move(c.x, c.y);
}

export async function hoverAt(x: number, y: number) {
  const p = await getPage();
  await botMoveTo(p, x, y);
  await p.mouse.move(x, y);
}

export async function drag(fromX: number, fromY: number, toX: number, toY: number) {
  const p = await getPage();
  await botActAt(p, fromX, fromY, { click: true });
  await p.mouse.down();
  await botMoveTo(p, toX, toY);
  await p.mouse.move(toX, toY);
  await p.mouse.up();
}

export async function fillSelector(selector: string, value: string) {
  const p = await getPage();
  const loc = p.locator(selector).first();
  await botActOnLocator(p, loc, { click: true });
  await loc.fill(value);
}

export async function fillRef(ref: string, value: string) {
  const p = await getPage();
  const meta = getRefStore().get(ref);
  if (!meta) throw new Error(`Unknown ref "${ref}"`);
  const loc = p.locator(meta.selector).first();
  await botActOnLocator(p, loc, { click: true });
  await loc.fill(value);
}

export async function typeText(text: string, submit = false, delayMs?: number) {
  const p = await getPage();
  await spawnCursorImmediately(p);
  const focused = await p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (focused) await botMoveTo(p, focused.x, focused.y);
  else {
    const c = await viewportCenter(p);
    await botMoveTo(p, c.x, c.y);
  }
  await p.keyboard.type(text, { delay: typingDelayMs(delayMs) });
  if (submit) await p.keyboard.press("Enter");
}

export async function pressKey(key: string) {
  const p = await getPage();
  await ensureCursorOnPage(p);
  await p.keyboard.press(key);
}

export async function selectOption(selector: string, value: string) {
  const p = await getPage();
  const loc = p.locator(selector).first();
  await botActOnLocator(p, loc, { click: true });
  await loc.selectOption(value);
}

export async function scroll(
  direction: "up" | "down" | "left" | "right",
  amount = 500
) {
  const p = await getPage();
  const c = await viewportCenter(p);
  await botMoveTo(p, c.x, c.y);
  const dy = direction === "down" ? amount : direction === "up" ? -amount : 0;
  const dx = direction === "right" ? amount : direction === "left" ? -amount : 0;
  await p.mouse.wheel(dx, dy);
}

export async function scrollToRef(ref: string) {
  const p = await getPage();
  const meta = getRefStore().get(ref);
  if (!meta) throw new Error(`Unknown ref "${ref}"`);
  await p.locator(meta.selector).first().scrollIntoViewIfNeeded();
  const center = await resolveRefToCenter(p, ref);
  if (center) await botMoveTo(p, center.x, center.y);
}

export async function evaluate(expression: string) {
  const p = await getPage();
  await ensureCursorOnPage(p);
  return p.evaluate(({ expr }) => {
    try {
      const fn = new Function(`return (${expr})`);
      const value = fn();
      return { ok: true as const, value: JSON.parse(JSON.stringify(value)) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, { expr: expression });
}

export async function screenshotBase64(fullPage = false) {
  const p = await getPage();
  await ensureCursorOnPage(p);
  const buf = await p.screenshot({ type: "png", fullPage });
  return buf.toString("base64");
}

export { ensureSession, closeSession, getSessionInfo, launchSession, getSession } from "./browser-manager-session.js";
