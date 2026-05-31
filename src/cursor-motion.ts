import type { Locator, Page } from "playwright";
import { botMoveTo, botPressAt, ensureCursorOnPage, getCursorPosition } from "./virtual-cursor.js";

export { botMoveTo };

/** Viewport center — default gaze point between actions */
export async function viewportCenter(page: Page): Promise<{ x: number; y: number }> {
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  return { x: vp.width / 2, y: vp.height / 2 };
}

export async function centerOfLocator(locator: Locator): Promise<{ x: number; y: number } | null> {
  const box = await locator.first().boundingBox();
  if (!box) return null;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Every bot action: glide cursor to target, then optional click animation + Playwright click */
export async function botActAt(
  page: Page,
  x: number,
  y: number,
  opts?: { click?: boolean; button?: "left" | "right" | "middle"; doubleClick?: boolean }
): Promise<void> {
  await ensureCursorOnPage(page);
  await botMoveTo(page, x, y);
  if (opts?.click) {
    await botPressAt(page, x, y);
    if (opts.doubleClick) await page.mouse.dblclick(x, y, { button: opts.button ?? "left" });
    else await page.mouse.click(x, y, { button: opts.button ?? "left" });
  }
}

export async function botActOnLocator(
  page: Page,
  locator: Locator,
  opts?: { click?: boolean; button?: "left" | "right" | "middle"; doubleClick?: boolean }
): Promise<{ x: number; y: number }> {
  await locator.first().waitFor({ state: "visible", timeout: 30_000 });
  await locator.first().scrollIntoViewIfNeeded().catch(() => {});
  const c = await centerOfLocator(locator);
  if (!c) throw new Error("Element not visible for cursor target");
  await botActAt(page, c.x, c.y, opts);
  return c;
}

/** After navigation — enter from top-left then sweep to content area */
export async function botEnterPage(page: Page): Promise<void> {
  await ensureCursorOnPage(page);
  await page.evaluate(() => {
    const c = window.__agentVirtualCursor;
    if (!c) return;
    return c.moveTo(32, 32, 400);
  }).catch(() => {});
  const center = await viewportCenter(page);
  await botMoveTo(page, center.x * 0.55, center.y * 0.45);
}

export async function botIdleGaze(page: Page): Promise<void> {
  const c = await viewportCenter(page);
  const pos = await getCursorPosition(page);
  await botMoveTo(page, c.x + (pos.x > c.x ? -80 : 80), c.y);
}
