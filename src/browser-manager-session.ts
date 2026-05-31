import type { Browser, BrowserContext, Page } from "playwright";
import {
  browserKindLabel,
  launchBrowser,
  parseBrowserKind,
  type BrowserKind,
} from "./browsers.js";
import { CURSOR_BUILD_ID } from "./cursor-build.js";
import { attachVirtualCursorToContext } from "./cursor-host.js";
import { attachTabWatcher } from "./tabs.js";
import { refreshCursorOnContext, spawnCursorImmediately } from "./virtual-cursor.js";

export type BrowserSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  kind: BrowserKind;
  cursorBuildId: string;
};

let session: BrowserSession | null = null;
let preferredBrowser: BrowserKind = parseBrowserKind(null);

export type LaunchOptions = {
  headless?: boolean;
  slowMo?: number;
  browser?: BrowserKind | string;
};

function needsRelaunch(requested: BrowserKind): boolean {
  if (!session) return true;
  if (!session.browser.isConnected()) {
    session = null;
    return true;
  }
  if (session.kind !== requested) return true;
  if (session.cursorBuildId !== CURSOR_BUILD_ID) return true;
  const pages = session.context.pages().filter((p) => !p.isClosed());
  if (pages.length === 0) return true;
  return false;
}

async function createContext(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  attachVirtualCursorToContext(context);
  attachTabWatcher(context);
  const page = await context.newPage();
  await spawnCursorImmediately(page);
  return { context, page };
}

export async function ensureSession(options: LaunchOptions = {}): Promise<BrowserSession> {
  const kind =
    options.browser !== undefined
      ? parseBrowserKind(
          typeof options.browser === "string" ? options.browser : options.browser
        )
      : preferredBrowser;
  preferredBrowser = kind;

  if (!needsRelaunch(kind)) {
    if (session!.page.isClosed()) {
      const open = session!.context.pages().filter((p) => !p.isClosed());
      if (open.length) session!.page = open[open.length - 1]!;
    }
    void refreshCursorOnContext(session!.context);
    return session!;
  }

  if (session) {
    await session.browser.close().catch(() => {});
    session = null;
  }

  const browser = await launchBrowser(kind, {
    headless: options.headless ?? false,
    slowMo: options.slowMo ?? 0,
  });

  const { context, page } = await createContext(browser);
  session = { browser, context, page, kind, cursorBuildId: CURSOR_BUILD_ID };
  return session;
}

export async function launchSession(options: LaunchOptions = {}) {
  const s = await ensureSession({ ...options, headless: options.headless ?? false });
  return { kind: s.kind, label: browserKindLabel(s.kind) };
}

export function getSessionInfo() {
  if (!session) return { active: false as const };
  const page = session.page;
  const tabCount = session.context.pages().filter((p) => !p.isClosed()).length;
  return {
    active: true as const,
    kind: session.kind,
    label: browserKindLabel(session.kind),
    url: page && !page.isClosed() ? page.url() : undefined,
    tabCount,
  };
}

export async function closeSession(): Promise<void> {
  if (session) {
    await session.browser.close();
    session = null;
  }
}

export function getSession(): BrowserSession | null {
  return session;
}

export function setActivePage(page: Page): void {
  if (session) session.page = page;
}

export function getPreferredBrowser(): BrowserKind {
  return preferredBrowser;
}
