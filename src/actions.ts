import type { Locator, Page } from "playwright";
import {
  animateCursorClick,
  animateCursorMove,
  ensureCursorOnPage,
  getCursorPosition,
} from "./virtual-cursor.js";
import { captureAccessibilitySnapshot, getRefStore, resolveRefToCenter } from "./snapshot.js";
import { ensureSession, getSession, type LaunchOptions } from "./browser-manager-session.js";
import { browserKindLabel } from "./browsers.js";

async function getPage(): Promise<Page> {
  return (await ensureSession({ headless: false })).page;
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number } | null> {
  const box = await locator.first().boundingBox();
  if (!box) return null;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function actAt(x: number, y: number, withClick: boolean): Promise<void> {
  const p = await getPage();
  await ensureCursorOnPage(p);
  await animateCursorMove(p, x, y);
  if (withClick) await animateCursorClick(p, x, y);
}

export async function navigate(url: string, options?: LaunchOptions) {
  const s = await ensureSession({ ...options, headless: options?.headless ?? false });
  await s.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await s.page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await ensureCursorOnPage(s.page);
  const pos = await getCursorPosition(s.page);
  await animateCursorMove(s.page, Math.min(pos.x, 600), Math.min(pos.y, 400));
  return {
    finalUrl: s.page.url(),
    browser: s.kind,
    label: browserKindLabel(s.kind),
  };
}

export async function goBack() {
  const p = await getPage();
  await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  await ensureCursorOnPage(p);
}

export async function goForward() {
  const p = await getPage();
  await p.goForward({ waitUntil: "domcontentloaded" }).catch(() => {});
  await ensureCursorOnPage(p);
}

export async function reload() {
  const p = await getPage();
  await p.reload({ waitUntil: "domcontentloaded" });
  await ensureCursorOnPage(p);
}

export async function snapshot() {
  return captureAccessibilitySnapshot(await getPage());
}

export async function getPageInfo() {
  const p = await getPage();
  await ensureCursorOnPage(p);
  return { url: p.url(), title: await p.title() };
}

export async function waitMs(ms: number) {
  const p = await getPage();
  await p.waitForTimeout(Math.min(Math.max(0, ms), 120_000));
  await ensureCursorOnPage(p);
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
) {
  const p = await getPage();
  const center = await resolveRefToCenter(p, ref);
  if (!center) throw new Error(`Unknown ref "${ref}". Run browser_snapshot first.`);
  const x = center.x + (opts?.offsetX ?? 0);
  const y = center.y + (opts?.offsetY ?? 0);
  await actAt(x, y, true);
  if (opts?.doubleClick) await p.mouse.dblclick(x, y, { button: opts?.button ?? "left" });
  else await p.mouse.click(x, y, { button: opts?.button ?? "left" });
}

export async function clickSelector(
  selector: string,
  opts?: { offsetX?: number; offsetY?: number; button?: "left" | "right" | "middle"; doubleClick?: boolean }
) {
  const p = await getPage();
  const loc = p.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 30_000 });
  const c = await centerOf(loc);
  if (!c) throw new Error(`Element not visible: ${selector}`);
  const x = c.x + (opts?.offsetX ?? 0);
  const y = c.y + (opts?.offsetY ?? 0);
  await actAt(x, y, true);
  if (opts?.doubleClick) await p.mouse.dblclick(x, y, { button: opts?.button ?? "left" });
  else await p.mouse.click(x, y, { button: opts?.button ?? "left" });
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
  await loc.waitFor({ state: "visible", timeout: 30_000 });
  const c = await centerOf(loc);
  if (!c) throw new Error(`Not found: role=${role} name=${name}`);
  const x = c.x + (opts?.offsetX ?? 0);
  const y = c.y + (opts?.offsetY ?? 0);
  await actAt(x, y, true);
  await p.mouse.click(x, y, { button: opts?.button ?? "left" });
}

export async function clickText(
  text: string,
  opts?: { exact?: boolean; button?: "left" | "right" | "middle" }
) {
  const p = await getPage();
  const loc = p.getByText(text, { exact: opts?.exact ?? false }).first();
  await loc.waitFor({ state: "visible", timeout: 30_000 });
  const c = await centerOf(loc);
  if (!c) throw new Error(`Text not found: ${text}`);
  await actAt(c.x, c.y, true);
  await p.mouse.click(c.x, c.y, { button: opts?.button ?? "left" });
}

export async function clickAt(
  x: number,
  y: number,
  button: "left" | "right" | "middle" = "left",
  doubleClick = false
) {
  const p = await getPage();
  await actAt(x, y, true);
  if (doubleClick) await p.mouse.dblclick(x, y, { button });
  else await p.mouse.click(x, y, { button });
}

export async function hoverRef(ref: string) {
  const p = await getPage();
  const center = await resolveRefToCenter(p, ref);
  if (!center) throw new Error(`Unknown ref "${ref}"`);
  await actAt(center.x, center.y, false);
  await p.mouse.move(center.x, center.y);
}

export async function hoverSelector(selector: string) {
  const p = await getPage();
  const loc = p.locator(selector).first();
  const c = await centerOf(loc);
  if (!c) throw new Error(`Not visible: ${selector}`);
  await actAt(c.x, c.y, false);
  await p.mouse.move(c.x, c.y);
}

export async function hoverAt(x: number, y: number) {
  const p = await getPage();
  await actAt(x, y, false);
  await p.mouse.move(x, y);
}

export async function drag(fromX: number, fromY: number, toX: number, toY: number) {
  const p = await getPage();
  await actAt(fromX, fromY, true);
  await p.mouse.move(fromX, fromY);
  await p.mouse.down();
  await animateCursorMove(p, toX, toY);
  await p.mouse.move(toX, toY);
  await p.mouse.up();
}

export async function fillSelector(selector: string, value: string) {
  const p = await getPage();
  const loc = p.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  const c = await centerOf(loc);
  if (c) await actAt(c.x, c.y, true);
  await loc.fill(value);
}

export async function fillRef(ref: string, value: string) {
  const p = await getPage();
  const center = await resolveRefToCenter(p, ref);
  if (!center) throw new Error(`Unknown ref "${ref}"`);
  const meta = getRefStore().get(ref);
  if (!meta) throw new Error(`Unknown ref "${ref}"`);
  await actAt(center.x, center.y, true);
  await p.locator(meta.selector).first().fill(value);
}

export async function typeText(text: string, submit = false) {
  const p = await getPage();
  const focused = await p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (focused) await animateCursorMove(p, focused.x, focused.y);
  else {
    const pos = await getCursorPosition(p);
    await animateCursorMove(p, pos.x, pos.y);
  }
  await p.keyboard.type(text, { delay: 40 });
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
  const c = await centerOf(loc);
  if (c) await actAt(c.x, c.y, true);
  await loc.selectOption(value);
}

export async function scroll(
  direction: "up" | "down" | "left" | "right",
  amount = 500
) {
  const p = await getPage();
  const pos = await getCursorPosition(p);
  await animateCursorMove(p, pos.x, pos.y);
  const dy = direction === "down" ? amount : direction === "up" ? -amount : 0;
  const dx = direction === "right" ? amount : direction === "left" ? -amount : 0;
  await p.mouse.wheel(dx, dy);
}

export async function scrollToRef(ref: string) {
  const p = await getPage();
  const meta = getRefStore().get(ref);
  if (!meta) throw new Error(`Unknown ref "${ref}"`);
  await p.locator(meta.selector).first().scrollIntoViewIfNeeded();
  await ensureCursorOnPage(p);
  const center = await resolveRefToCenter(p, ref);
  if (center) await animateCursorMove(p, center.x, center.y);
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
