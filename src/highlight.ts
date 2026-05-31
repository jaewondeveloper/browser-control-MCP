import type { Locator, Page } from "playwright";
import { showClickTarget } from "./virtual-cursor.js";

/** Non-blocking — do not slow down clicks */
export function highlightLocator(locator: Locator): void {
  void locator.first().highlight().catch(() => {});
}

export function highlightPoint(page: Page, x: number, y: number): void {
  void showClickTarget(page, x, y);
}
