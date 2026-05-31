import type { BrowserContext, Page } from "playwright";
import { CURSOR_SHOW_SCRIPT, VIRTUAL_CURSOR_INIT_SCRIPT } from "./virtual-cursor.js";

/** Lightweight: show cursor if present — never reset position */
async function onPageReady(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      if (window.__agentVirtualCursor) {
        window.__agentVirtualCursor.show();
        return;
      }
    })
    .catch(() => {});
}

export function attachVirtualCursorToContext(context: BrowserContext): void {
  context.addInitScript(VIRTUAL_CURSOR_INIT_SCRIPT);

  const wire = (page: Page): void => {
    void onPageReady(page);
    page.on("domcontentloaded", () => void onPageReady(page));
  };

  context.on("page", wire);
  for (const page of context.pages()) wire(page);
}
