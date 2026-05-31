/**
 * Standalone BOT dev overlay for local website testing.
 * Load in index.html during development (Vite/Next/etc.):
 *
 *   <script src="/agent-bot-overlay.js" data-agent-bot-overlay></script>
 *
 * Or copy from node_modules/browser-control-mcp/inject/agent-bot-overlay.js
 *
 * window.AgentBotOverlay.enable() / .disable()
 */
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
    style.textContent = `
      html.__agent_bot_active__ { overflow: hidden; }
      #${VIGNETTE_ID} {
        position: fixed !important; inset: 0 !important; pointer-events: none !important;
        z-index: 2147483644 !important;
        box-shadow:
          inset 0 0 70px 28px rgba(33, 150, 243, 0.72),
          inset 0 0 140px 56px rgba(21, 101, 192, 0.38),
          inset 0 0 220px 90px rgba(13, 71, 161, 0.18) !important;
        animation: __agent_vignette_pulse__ 2.4s ease-in-out infinite;
      }
      @keyframes __agent_vignette_pulse__ {
        0%, 100% { opacity: 0.92; } 50% { opacity: 1; }
      }
      #${SHIELD_ID} {
        position: fixed !important; inset: 0 !important; z-index: 2147483643 !important;
        pointer-events: auto !important; cursor: not-allowed !important;
        background: rgba(33, 150, 243, 0.03) !important;
        touch-action: none !important; user-select: none !important;
      }
      #${BANNER_ID} {
        position: fixed !important; top: 10px !important; left: 50% !important;
        transform: translateX(-50%) !important; z-index: 2147483645 !important;
        pointer-events: none !important;
        font: 700 13px/1.2 system-ui, sans-serif !important; color: #fff !important;
        background: linear-gradient(135deg, #1565c0, #42a5f5) !important;
        padding: 8px 16px !important; border-radius: 999px !important;
        box-shadow: 0 4px 20px rgba(21, 101, 192, 0.45) !important;
      }
    `;
    (document.documentElement || document.head).appendChild(style);
  }

  function apply(opts) {
    const o = opts || {};
    const enabled = o.enabled !== false;
    const lock = o.lockInput !== false;
    const vignette = o.vignette !== false;
    removeAll();
    if (!enabled) return;
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
      (document.documentElement || document.body).appendChild(s);
    }
    const b = document.createElement("div");
    b.id = BANNER_ID;
    b.textContent = o.bannerText || "BOT 조작 중";
    (document.documentElement || document.body).appendChild(b);
  }

  const api = {
    enable: (opts) => apply({ enabled: true, lockInput: true, vignette: true, ...opts }),
    disable: () => apply({ enabled: false }),
    setOptions: apply,
  };

  window.AgentBotOverlay = api;

  const script = document.currentScript;
  if (script && script.hasAttribute("data-agent-bot-overlay")) {
    const host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      api.enable();
    }
  }
})();
