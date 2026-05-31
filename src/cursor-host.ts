import type { BrowserContext, Page } from "playwright";
import { VIRTUAL_CURSOR_INIT_SCRIPT, ensureCursorOnPage } from "./virtual-cursor.js";

export function attachVirtualCursorToContext(context: BrowserContext): void {
  context.addInitScript(VIRTUAL_CURSOR_INIT_SCRIPT);

  const wire = (page: Page): void => {
    void ensureCursorOnPage(page);
    page.on("domcontentloaded", () => void ensureCursorOnPage(page));
    page.on("load", () => void ensureCursorOnPage(page));
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) void ensureCursorOnPage(page);
    });
  };

  context.on("page", wire);
  for (const page of context.pages()) wire(page);
}
