import { ensureBotOverlay } from "./bot-overlay.js";
import { isFastMotion, moveDurationScale } from "./dev-mode.js";

/**
 * BOT cursor overlay — blue pointer + BOT badge (classic design).
 */
export const VIRTUAL_CURSOR_INIT_SCRIPT = `
(function () {
  const CURSOR_ID = "__agent_virtual_cursor__";
  const STYLE_ID = "__agent_virtual_cursor_style__";
  const RIPPLE_CLASS = "__agent_click_ripple__";
  const POS_KEY = "__agent_cursor_pos__";

  function loadPos() {
    try {
      const raw = sessionStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.x === "number" && typeof p.y === "number") return p;
      }
    } catch (e) {}
    return null;
  }

  function savePos(x, y) {
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify({ x: x, y: y }));
    } catch (e) {}
  }

  const existingEl = document.getElementById(CURSOR_ID);
  if (window.__agentVirtualCursor && existingEl) {
    window.__agentVirtualCursor.show();
    return;
  }
  if (window.__agentVirtualCursor && !existingEl) {
    delete window.__agentVirtualCursor;
  }

  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(CURSOR_ID)?.remove();
  document.getElementById("__agent_click_target__")?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = \`
    #\${CURSOR_ID} {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 32px !important;
      height: 32px !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: block !important;
      will-change: transform;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.35));
    }
    #\${CURSOR_ID} .pointer {
      width: 100%;
      height: 100%;
      transform-origin: 4px 4px;
      transition: transform 140ms cubic-bezier(0.33, 1, 0.68, 1);
    }
    #\${CURSOR_ID}.pressing .pointer {
      transform: scale(0.8) !important;
    }
    #\${CURSOR_ID} .bot-badge {
      position: absolute;
      left: 20px;
      top: 18px;
      font: 600 10px/1 system-ui, sans-serif;
      color: #fff;
      background: #2563eb;
      padding: 2px 6px;
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .\${RIPPLE_CLASS} {
      position: fixed;
      width: 50px;
      height: 50px;
      margin: -25px 0 0 -25px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483646;
      background: radial-gradient(circle, rgba(37,99,235,0.45) 0%, transparent 70%);
      animation: __agent_ripple__ 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes __agent_ripple__ {
      from { transform: scale(0.2); opacity: 1; }
      to { transform: scale(1.35); opacity: 0; }
    }
  \`;
  (document.documentElement || document.body).appendChild(style);

  const root = document.createElement("div");
  root.id = CURSOR_ID;
  root.innerHTML = \`
    <svg class="pointer" viewBox="0 0 24 24">
      <path d="M5 3L19 12L11 13L9 21L5 3Z" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.2"/>
    </svg>
    <span class="bot-badge">BOT</span>
  \`;
  (document.documentElement || document.body).appendChild(root);

  let animFrame = null;
  let moving = false;
  const saved = loadPos();
  let currentX = saved ? saved.x : 200;
  let currentY = saved ? saved.y : 200;

  function applyPos(x, y) {
    root.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px,0)";
    currentX = x;
    currentY = y;
    savePos(x, y);
  }

  function setInstant(x, y) {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
    moving = false;
    applyPos(x, y);
  }

  function showTarget() {}
  function hideTarget() {}

  applyPos(currentX, currentY);

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function calcDuration(dist, override) {
    const FAST = !!window.__agentFastMotion;
    if (override > 0) {
      const cap = FAST ? 220 : 420;
      const floor = FAST ? 40 : 80;
      return Math.max(floor, Math.min(cap, override));
    }
    if (FAST) return Math.max(50, Math.min(200, 28 + dist * 0.1));
    return Math.max(120, Math.min(420, 60 + dist * 0.18));
  }

  function moveTo(x, y, durationMs) {
    return new Promise((resolve) => {
      if (animFrame) cancelAnimationFrame(animFrame);
      const startX = currentX;
      const startY = currentY;
      const duration = calcDuration(Math.hypot(x - startX, y - startY), durationMs || 0);
      const start = performance.now();
      moving = true;
      root.style.opacity = "1";

      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const e = easeOut(t);
        applyPos(startX + (x - startX) * e, startY + (y - startY) * e);
        if (t < 1) animFrame = requestAnimationFrame(step);
        else {
          animFrame = null;
          moving = false;
          resolve();
        }
      }
      animFrame = requestAnimationFrame(step);
    });
  }

  function playClickRipple(x, y) {
    const ripple = document.createElement("div");
    ripple.className = RIPPLE_CLASS;
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    (document.documentElement || document.body).appendChild(ripple);
    setTimeout(() => ripple.remove(), 450);
  }

  async function pressAt(x, y) {
    const dist = Math.hypot(x - currentX, y - currentY);
    if (dist > 14) await moveTo(x, y);
    root.classList.add("pressing");
    playClickRipple(x + 5, y + 5);
    const pressMs = window.__agentFastMotion ? 90 : 130;
    await new Promise((r) => setTimeout(r, pressMs));
    root.classList.remove("pressing");
  }

  function show() {
    root.style.setProperty("opacity", "1", "important");
    root.style.setProperty("visibility", "visible", "important");
    root.style.setProperty("display", "block", "important");
  }

  window.__agentVirtualCursor = {
    moveTo,
    pressAt,
    showClick: pressAt,
    show,
    showTarget,
    hideTarget,
    setInstant,
    isMoving: () => moving,
    getPosition: () => ({ x: currentX, y: currentY }),
  };

  if (!window.__agentCursorGuardActive) {
    window.__agentCursorGuardActive = true;
    setInterval(function () {
      if (!document.getElementById(CURSOR_ID)) return;
      show();
    }, 250);
  }
})();
`;

export const CURSOR_SHOW_SCRIPT = `
(() => {
  window.__agentVirtualCursor?.show();
  var el = document.getElementById("__agent_virtual_cursor__");
  if (el) {
    el.style.setProperty("display", "block", "important");
    el.style.setProperty("opacity", "1", "important");
    el.style.setProperty("z-index", "2147483647", "important");
  }
})();
`;

export const CURSOR_GUARD_BOOT = `
(() => {
  if (!document.getElementById("__agent_virtual_cursor__")) return "need-install";
  window.__agentVirtualCursor?.show();
  return "ok";
})();
`;

export function moveDurationForDistance(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  overrideMs?: number
): number {
  const scale = moveDurationScale();
  if (overrideMs !== undefined) {
    const ms = overrideMs * scale;
    return Math.max(isFastMotion() ? 40 : 80, Math.min(isFastMotion() ? 220 : 420, ms));
  }
  const dist = Math.hypot(toX - fromX, toY - fromY);
  if (dist < 40) return isFastMotion() ? 45 : 80;
  const base = 60 + dist * 0.18;
  return Math.max(isFastMotion() ? 50 : 120, Math.min(isFastMotion() ? 200 : 420, base * scale));
}

/** Show BOT cursor immediately — new tab/window, no wait for full load */
export async function spawnCursorImmediately(page: import("playwright").Page): Promise<void> {
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  const { getRecordedCursorPosition, hasRecordedPosition } = await import("./cursor-state.js");
  const pos = hasRecordedPosition()
    ? getRecordedCursorPosition()
    : { x: vp.width * 0.42, y: vp.height * 0.38 };

  try {
    await page.evaluate((fast) => {
      window.__agentFastMotion = fast;
    }, isFastMotion());
    await page.evaluate(VIRTUAL_CURSOR_INIT_SCRIPT);
    await page.evaluate(
      ({ x, y }) => {
        window.__agentVirtualCursor?.setInstant(x, y);
        window.__agentVirtualCursor?.show();
      },
      pos
    );
    await ensureBotOverlay(page);
  } catch {
    /* page not ready yet — domcontentloaded handler will retry */
  }
}

export async function ensureCursorOnPage(page: import("playwright").Page): Promise<void> {
  const { getRecordedCursorPosition, hasRecordedPosition } = await import("./cursor-state.js");

  const boot = await page.evaluate(CURSOR_GUARD_BOOT).catch(() => "need-install");

  if (boot !== "ok") {
    await page.evaluate(VIRTUAL_CURSOR_INIT_SCRIPT).catch(() => {});
    if (hasRecordedPosition()) {
      const pos = getRecordedCursorPosition();
      await page
        .evaluate(({ x, y }) => window.__agentVirtualCursor?.setInstant(x, y), pos)
        .catch(() => {});
    }
  }

  await page.evaluate(CURSOR_SHOW_SCRIPT).catch(() => {});
}

export async function showClickTarget(
  page: import("playwright").Page,
  _x: number,
  _y: number
): Promise<void> {
  await ensureCursorOnPage(page);
}

export async function getCursorPosition(
  page: import("playwright").Page
): Promise<{ x: number; y: number }> {
  await ensureCursorOnPage(page);
  return page.evaluate(() => {
    const c = window.__agentVirtualCursor?.getPosition();
    return c ?? { x: 200, y: 200 };
  });
}

/** Fast move: short glide + instant Playwright mouse at end */
export async function botMoveTo(
  page: import("playwright").Page,
  x: number,
  y: number,
  durationMs?: number
): Promise<void> {
  await spawnCursorImmediately(page);
  const from = await getCursorPosition(page);
  const duration = moveDurationForDistance(from.x, from.y, x, y, durationMs);

  await page.evaluate(
    async ({ x, y, duration }) => {
      await window.__agentVirtualCursor?.moveTo(x, y, duration);
    },
    { x, y, duration }
  );

  await page.mouse.move(x, y);
  const { recordCursorPosition } = await import("./cursor-state.js");
  recordCursorPosition(x, y);
}

export async function botPressAt(page: import("playwright").Page, x: number, y: number): Promise<void> {
  await ensureCursorOnPage(page);
  await page.evaluate(async ({ x, y }) => {
    await window.__agentVirtualCursor?.pressAt(x, y);
  }, { x, y });
  await page.mouse.move(x, y);
}

export async function animateCursorMove(
  page: import("playwright").Page,
  x: number,
  y: number,
  durationMs?: number
): Promise<void> {
  await botMoveTo(page, x, y, durationMs);
}

export async function animateCursorClick(
  page: import("playwright").Page,
  x: number,
  y: number
): Promise<void> {
  await botPressAt(page, x, y);
}

declare global {
  interface Window {
    __agentVirtualCursor?: {
      moveTo: (x: number, y: number, durationMs?: number) => Promise<void>;
      pressAt: (x: number, y: number) => Promise<void>;
      showClick: (x: number, y: number) => Promise<void>;
      show: () => void;
      showTarget: (x: number, y: number) => void;
      hideTarget: () => void;
      setInstant: (x: number, y: number) => void;
      isMoving: () => boolean;
      getPosition: () => { x: number; y: number };
    };
    __agentCursorGuardActive?: boolean;
    __agentFastMotion?: boolean;
  }
}
