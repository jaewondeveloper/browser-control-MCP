import type { BrowserContext, Page } from "playwright";
import { spawnCursorImmediately, VIRTUAL_CURSOR_INIT_SCRIPT } from "./virtual-cursor.js";

export function attachVirtualCursorToContext(context: BrowserContext): void {
  context.addInitScript(VIRTUAL_CURSOR_INIT_SCRIPT);

  const wire = (page: Page): void => {
    void spawnCursorImmediately(page);
    page.on("domcontentloaded", () => void spawnCursorImmediately(page));
  };

  context.on("page", wire);
  for (const page of context.pages()) wire(page);
}
