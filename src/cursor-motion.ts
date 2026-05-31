import type { Locator, Page } from "playwright";
import { botMoveTo, botPressAt, ensureCursorOnPage } from "./virtual-cursor.js";

export { botMoveTo };

export async function viewportCenter(page: Page): Promise<{ x: number; y: number }> {
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  return { x: vp.width / 2, y: vp.height / 2 };
}

export async function centerOfLocator(locator: Locator): Promise<{ x: number; y: number } | null> {
  const box = await locator.first().boundingBox();
  if (!box) return null;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

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

/** Page loaded — keep cursor where it was; only ensure overlay exists */
export async function botEnterPage(page: Page): Promise<void> {
  await ensureCursorOnPage(page);
}
