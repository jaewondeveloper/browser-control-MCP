import type { BrowserContext, Page } from "playwright";
import { setActivePage, getSession } from "./browser-manager-session.js";
import { ensureCursorOnPage } from "./virtual-cursor.js";

export type TabInfo = {
  index: number;
  url: string;
  title: string;
  active: boolean;
};

/** When true, new tabs/popups become the active page automatically */
export let autoFocusNewTabs = true;

function openPages(context: BrowserContext): Page[] {
  return context.pages().filter((p) => !p.isClosed());
}

export function getActivePage(): Page | null {
  const s = getSession();
  if (!s) return null;
  const active = s.page;
  if (!active.isClosed()) return active;
  const pages = openPages(s.context);
  if (pages.length === 0) return null;
  const last = pages[pages.length - 1]!;
  setActivePage(last);
  return last;
}

export async function focusPage(page: Page): Promise<void> {
  setActivePage(page);
  await page.bringToFront().catch(() => {});
  await ensureCursorOnPage(page);
}

export function attachTabWatcher(context: BrowserContext): void {
  context.on("page", (newPage) => {
    void (async () => {
      await newPage.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      if (autoFocusNewTabs) await focusPage(newPage);
    })();
  });
}

/**
 * After a click, adopt a popup / new tab if one opened.
 * Returns the page agents should use next.
 */
export async function adoptNewTabAfterAction(
  page: Page,
  timeoutMs = 5000
): Promise<{ page: Page; switched: boolean; message?: string }> {
  const context = page.context();
  const countBefore = openPages(context).length;

  let newPage: Page | null = null;
  try {
    newPage = await context.waitForEvent("page", { timeout: timeoutMs });
  } catch {
    /* same-tab navigation or no popup */
  }

  if (newPage && !newPage.isClosed()) {
    await newPage.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
    await focusPage(newPage);
    return {
      page: newPage,
      switched: true,
      message: `New tab opened → now active (${newPage.url()})`,
    };
  }

  const pages = openPages(context);
  if (pages.length > countBefore) {
    const latest = pages[pages.length - 1]!;
    if (latest !== page) {
      await latest.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
      await focusPage(latest);
      return {
        page: latest,
        switched: true,
        message: `Switched to new tab (${latest.url()})`,
      };
    }
  }

  return { page, switched: false };
}

export function listTabs(): TabInfo[] {
  const s = getSession();
  if (!s) return [];
  const active = getActivePage();
  return openPages(s.context).map((p, index) => ({
    index,
    url: p.url(),
    title: "",
    active: p === active,
  }));
}

export async function listTabsWithTitles(): Promise<TabInfo[]> {
  const tabs = listTabs();
  const s = getSession();
  if (!s) return tabs;
  const pages = openPages(s.context);
  for (let i = 0; i < pages.length; i++) {
    tabs[i]!.title = await pages[i]!.title().catch(() => "");
  }
  return tabs;
}

export async function switchToTab(index: number): Promise<TabInfo> {
  const s = getSession();
  if (!s) throw new Error("No browser session");
  const pages = openPages(s.context);
  const target = pages[index];
  if (!target) throw new Error(`Tab index ${index} not found (0-${pages.length - 1})`);
  await focusPage(target);
  return {
    index,
    url: target.url(),
    title: await target.title().catch(() => ""),
    active: true,
  };
}

export async function switchToTabMatching(urlPart: string): Promise<TabInfo> {
  const tabs = await listTabsWithTitles();
  const hit = tabs.find((t) => t.url.includes(urlPart));
  if (!hit) throw new Error(`No tab with URL containing: ${urlPart}`);
  return switchToTab(hit.index);
}
