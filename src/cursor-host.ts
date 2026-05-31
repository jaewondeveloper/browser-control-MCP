import type { BrowserContext, Page } from "playwright";
import { BOT_OVERLAY_INIT_SCRIPT, ensureBotOverlay } from "./bot-overlay.js";
import { isBotControlActive } from "./bot-control-state.js";
import {
  CURSOR_PURGE_SCRIPT,
  spawnCursorImmediately,
  VIRTUAL_CURSOR_INIT_SCRIPT,
} from "./virtual-cursor.js";

export function attachVirtualCursorToContext(context: BrowserContext): void {
  context.addInitScript(CURSOR_PURGE_SCRIPT);
  context.addInitScript(VIRTUAL_CURSOR_INIT_SCRIPT);
  context.addInitScript(BOT_OVERLAY_INIT_SCRIPT);

  const wire = (page: Page): void => {
    if (!isBotControlActive()) return;
    void spawnCursorImmediately(page);
    void ensureBotOverlay(page);
    page.on("domcontentloaded", () => {
      if (!isBotControlActive()) return;
      void spawnCursorImmediately(page);
      void ensureBotOverlay(page);
    });
  };

  context.on("page", wire);
  for (const page of context.pages()) wire(page);
}
