import type { BrowserContext, Page } from "playwright";
import { BOT_OVERLAY_INIT_SCRIPT, ensureBotOverlay } from "./bot-overlay.js";
import { spawnCursorImmediately, VIRTUAL_CURSOR_INIT_SCRIPT } from "./virtual-cursor.js";

export function attachVirtualCursorToContext(context: BrowserContext): void {
  context.addInitScript(VIRTUAL_CURSOR_INIT_SCRIPT);
  context.addInitScript(BOT_OVERLAY_INIT_SCRIPT);

  const wire = (page: Page): void => {
    void spawnCursorImmediately(page);
    void ensureBotOverlay(page);
    page.on("domcontentloaded", () => {
      void spawnCursorImmediately(page);
      void ensureBotOverlay(page);
    });
  };

  context.on("page", wire);
  for (const page of context.pages()) wire(page);
}
