import type { Locator, Page } from "playwright";
import { botMoveTo, botPressAt, ensureCursorOnPage } from "./virtual-cursor.js";
import { adoptNewTabAfterAction } from "./tabs.js";

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

export type BotActResult = { tabSwitched: boolean; tabMessage?: string };

export async function botActAt(
  page: Page,
  x: number,
  y: number,
  opts?: { click?: boolean; button?: "left" | "right" | "middle"; doubleClick?: boolean }
): Promise<BotActResult> {
  await ensureCursorOnPage(page);
  await botMoveTo(page, x, y);
  if (!opts?.click) return { tabSwitched: false };

  const context = page.context();
  const newTabPromise = context.waitForEvent("page", { timeout: 5000 }).catch(() => null);

  await botPressAt(page, x, y);
  if (opts.doubleClick) await page.mouse.dblclick(x, y, { button: opts.button ?? "left" });
  else await page.mouse.click(x, y, { button: opts.button ?? "left" });

  const early = await newTabPromise;
  if (early && !early.isClosed()) {
    const adopted = await adoptNewTabAfterAction(page, 1500);
    return {
      tabSwitched: true,
      tabMessage: adopted.message ?? `New tab active: ${early.url()}`,
    };
  }

  const adopted = await adoptNewTabAfterAction(page, 3500);
  return { tabSwitched: adopted.switched, tabMessage: adopted.message };
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
  const result = await botActAt(page, c.x, c.y, opts);
  if (result.tabMessage) {
    // eslint-disable-next-line no-console
    console.error(`[browser-control] ${result.tabMessage}`);
  }
  return c;
}

/** Page loaded — keep cursor where it was; only ensure overlay exists */
export async function botEnterPage(page: Page): Promise<void> {
  await ensureCursorOnPage(page);
}
