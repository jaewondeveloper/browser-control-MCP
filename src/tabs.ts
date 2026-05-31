import type { BrowserContext, Page } from "playwright";
import { setActivePage, getSession } from "./browser-manager-session.js";
import { ensureBotOverlay } from "./bot-overlay.js";
import { spawnCursorImmediately } from "./virtual-cursor.js";

export type TabInfo = {
  index: number;
  url: string;
  title: string;
  active: boolean;
};

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
  await spawnCursorImmediately(page);
  await ensureBotOverlay(page);
}

export function attachTabWatcher(context: BrowserContext): void {
  const onNewPage = (newPage: Page): void => {
    if (autoFocusNewTabs) setActivePage(newPage);
    void newPage.bringToFront().catch(() => {});
    void spawnCursorImmediately(newPage);
    void ensureBotOverlay(newPage);
    newPage.on("domcontentloaded", () => {
      void spawnCursorImmediately(newPage);
      void ensureBotOverlay(newPage);
    });
  };

  context.on("page", onNewPage);
  for (const page of context.pages()) onNewPage(page);
}

export async function adoptNewTabAfterAction(
  page: Page,
  timeoutMs = 900
): Promise<{ page: Page; switched: boolean; message?: string }> {
  const context = page.context();
  const countBefore = openPages(context).length;

  let newPage: Page | null = null;
  try {
    newPage = await context.waitForEvent("page", { timeout: timeoutMs });
  } catch {
    /* same-tab navigation */
  }

  if (newPage && !newPage.isClosed()) {
    setActivePage(newPage);
    await newPage.bringToFront().catch(() => {});
    await spawnCursorImmediately(newPage);
    void newPage.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    return {
      page: newPage,
      switched: true,
      message: `New tab → cursor on (${newPage.url()})`,
    };
  }

  const pages = openPages(context);
  if (pages.length > countBefore) {
    const latest = pages[pages.length - 1]!;
    if (latest !== page) {
      setActivePage(latest);
      await latest.bringToFront().catch(() => {});
      await spawnCursorImmediately(latest);
      return {
        page: latest,
        switched: true,
        message: `Switched tab (${latest.url()})`,
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
  await Promise.all(
    pages.map(async (p, i) => {
      tabs[i]!.title = await p.title().catch(() => "");
    })
  );
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
