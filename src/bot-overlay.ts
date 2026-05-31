import type { Page } from "playwright";
import { getDevMode } from "./dev-mode.js";

/** Input lock + blue edge vignette — injected on every page in dev mode */
export const BOT_OVERLAY_INIT_SCRIPT = `
(function () {
  const SHIELD_ID = "__agent_bot_shield__";
  const VIGNETTE_ID = "__agent_bot_vignette__";
  const BANNER_ID = "__agent_bot_banner__";
  const STYLE_ID = "__agent_bot_overlay_style__";

  function removeAll() {
    document.getElementById(SHIELD_ID)?.remove();
    document.getElementById(VIGNETTE_ID)?.remove();
    document.getElementById(BANNER_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.classList.remove("__agent_bot_active__");
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = \`
      html.__agent_bot_active__ {
        overflow: hidden;
      }
      #\${VIGNETTE_ID} {
        position: fixed !important;
        inset: 0 !important;
        pointer-events: none !important;
        z-index: 2147483644 !important;
        box-shadow:
          inset 0 0 70px 28px rgba(33, 150, 243, 0.72),
          inset 0 0 140px 56px rgba(21, 101, 192, 0.38),
          inset 0 0 220px 90px rgba(13, 71, 161, 0.18) !important;
        animation: __agent_vignette_pulse__ 2.4s ease-in-out infinite;
      }
      @keyframes __agent_vignette_pulse__ {
        0%, 100% { opacity: 0.92; }
        50% { opacity: 1; }
      }
      #\${SHIELD_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483643 !important;
        pointer-events: auto !important;
        cursor: not-allowed !important;
        background: rgba(33, 150, 243, 0.03) !important;
        touch-action: none !important;
        user-select: none !important;
      }
      #\${BANNER_ID} {
        position: fixed !important;
        top: 10px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 2147483645 !important;
        pointer-events: none !important;
        font: 700 13px/1.2 system-ui, -apple-system, sans-serif !important;
        color: #fff !important;
        background: linear-gradient(135deg, #1565c0, #42a5f5) !important;
        padding: 8px 16px !important;
        border-radius: 999px !important;
        box-shadow: 0 4px 20px rgba(21, 101, 192, 0.45) !important;
        letter-spacing: 0.02em !important;
      }
    \`;
    (document.documentElement || document.head).appendChild(style);
  }

  function apply(opts) {
    const o = opts || {};
    const enabled = o.enabled !== false;
    const lock = o.lockInput !== false;
    const vignette = o.vignette !== false;

    removeAll();
    if (!enabled) {
      window.__agentBotOverlay = { enable: apply, disable: () => apply({ enabled: false }), setOptions: apply };
      return;
    }

    ensureStyle();
    document.documentElement.classList.add("__agent_bot_active__");

    if (vignette) {
      const v = document.createElement("div");
      v.id = VIGNETTE_ID;
      v.setAttribute("aria-hidden", "true");
      (document.documentElement || document.body).appendChild(v);
    }

    if (lock) {
      const s = document.createElement("div");
      s.id = SHIELD_ID;
      s.setAttribute("aria-hidden", "true");
      s.title = "BOT is controlling this window";
      (document.documentElement || document.body).appendChild(s);
    }

    const b = document.createElement("div");
    b.id = BANNER_ID;
    b.textContent = o.bannerText || "BOT 조작 중";
    (document.documentElement || document.body).appendChild(b);

    window.__agentBotOverlay = {
      enable: apply,
      disable: () => apply({ enabled: false }),
      setOptions: apply,
    };
  }

  if (!window.__agentBotOverlay) {
    apply({ enabled: true, lockInput: true, vignette: true });
  }
})();
`;

export async function ensureBotOverlay(page: Page): Promise<void> {
  const cfg = getDevMode();
  if (!cfg.enabled) {
    await page
      .evaluate(() => window.__agentBotOverlay?.disable?.())
      .catch(() => {});
    return;
  }

  try {
    await page.evaluate(BOT_OVERLAY_INIT_SCRIPT);
    await page.evaluate(
      ({ lockInput, vignette }) => {
        window.__agentBotOverlay?.setOptions?.({
          enabled: true,
          lockInput,
          vignette,
          bannerText: "BOT 조작 중",
        });
      },
      { lockInput: cfg.lockInput, vignette: cfg.vignette }
    );
  } catch {
    /* page not ready */
  }
}

export async function applyBotOverlayToAllPages(pages: Page[]): Promise<void> {
  await Promise.all(pages.map((p) => ensureBotOverlay(p)));
}

declare global {
  interface Window {
    __agentBotOverlay?: {
      enable: (opts?: {
        enabled?: boolean;
        lockInput?: boolean;
        vignette?: boolean;
        bannerText?: string;
      }) => void;
      disable: () => void;
      setOptions: (opts?: {
        enabled?: boolean;
        lockInput?: boolean;
        vignette?: boolean;
        bannerText?: string;
      }) => void;
    };
  }
}
