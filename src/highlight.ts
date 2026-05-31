import type { Locator, Page } from "playwright";
import { showClickTarget } from "./virtual-cursor.js";

/** Playwright built-in red box — always visible on top of page content */
export async function highlightLocator(locator: Locator): Promise<void> {
  try {
    await locator.first().highlight();
  } catch {
    /* ignore */
  }
}

export async function highlightPoint(page: Page, x: number, y: number): Promise<void> {
  await showClickTarget(page, x, y);
}
