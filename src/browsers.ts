import { chromium, firefox, type Browser } from "playwright";

/** Supported browser engines for automation */
export type BrowserKind = "chromium" | "chrome" | "edge" | "firefox";

export type BrowserInfo = {
  kind: BrowserKind;
  label: string;
  description: string;
  /** Playwright install command segment, if bundled browser is required */
  installHint?: string;
};

export const BROWSER_CATALOG: BrowserInfo[] = [
  {
    kind: "chromium",
    label: "Chromium (Playwright)",
    description: "Playwright-bundled Chromium. Works without installing Chrome/Edge.",
    installHint: "npx playwright install chromium",
  },
  {
    kind: "chrome",
    label: "Google Chrome",
    description: "Uses locally installed Google Chrome (channel: chrome).",
  },
  {
    kind: "edge",
    label: "Microsoft Edge",
    description: "Uses locally installed Microsoft Edge (channel: msedge).",
  },
  {
    kind: "firefox",
    label: "Mozilla Firefox",
    description: "Playwright-managed Firefox build.",
    installHint: "npx playwright install firefox",
  },
];

const ALIASES: Record<string, BrowserKind> = {
  chromium: "chromium",
  chrome: "chrome",
  "google-chrome": "chrome",
  googlechrome: "chrome",
  edge: "edge",
  msedge: "edge",
  "microsoft-edge": "edge",
  microsoftedge: "edge",
  firefox: "firefox",
  ff: "firefox",
  mozilla: "firefox",
};

export function parseBrowserKind(input?: string | null): BrowserKind {
  const fromEnv = process.env.BROWSER_CONTROL_DEFAULT_BROWSER?.trim().toLowerCase();
  const raw = (input ?? fromEnv ?? "chromium").trim().toLowerCase().replace(/\s+/g, "");
  const kind = ALIASES[raw];
  if (!kind) {
    throw new Error(
      `Unknown browser "${input ?? fromEnv}". Use: chromium, chrome, edge, firefox (aliases: msedge, ff).`
    );
  }
  return kind;
}

export function browserKindLabel(kind: BrowserKind): string {
  return BROWSER_CATALOG.find((b) => b.kind === kind)?.label ?? kind;
}

export type LaunchBrowserOptions = {
  headless?: boolean;
  slowMo?: number;
};

async function launchChromiumFamily(
  kind: "chromium" | "chrome" | "edge",
  options: LaunchBrowserOptions
): Promise<Browser> {
  const headless = options.headless ?? false;
  const slowMo = options.slowMo ?? 0;

  if (kind === "chromium") {
    return chromium.launch({ headless, slowMo });
  }

  const channel = kind === "chrome" ? "chrome" : "msedge";
  const product = kind === "chrome" ? "Google Chrome" : "Microsoft Edge";

  try {
    return await chromium.launch({ headless, slowMo, channel });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to launch ${product} (channel: ${channel}). Install it on this machine, or use browser "chromium".\n${message}`
    );
  }
}

async function launchFirefox(options: LaunchBrowserOptions): Promise<Browser> {
  try {
    return await firefox.launch({
      headless: options.headless ?? false,
      slowMo: options.slowMo ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to launch Firefox. Run: npx playwright install firefox\n${message}`
    );
  }
}

export async function launchBrowser(
  kind: BrowserKind,
  options: LaunchBrowserOptions = {}
): Promise<Browser> {
  switch (kind) {
    case "chromium":
    case "chrome":
    case "edge":
      return launchChromiumFamily(kind, options);
    case "firefox":
      return launchFirefox(options);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unsupported browser: ${_exhaustive}`);
    }
  }
}
