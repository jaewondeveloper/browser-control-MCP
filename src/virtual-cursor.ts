/**
 * BOT cursor + click target ring — high visibility on YouTube/SPA sites.
 */
export const VIRTUAL_CURSOR_INIT_SCRIPT = `
(function () {
  const CURSOR_ID = "__agent_virtual_cursor__";
  const STYLE_ID = "__agent_virtual_cursor_style__";
  const TARGET_ID = "__agent_click_target__";
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
  document.getElementById(TARGET_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = \`
    #\${CURSOR_ID} {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 44px !important;
      height: 44px !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: block !important;
      filter: drop-shadow(0 0 6px #000) drop-shadow(0 0 12px #ffeb3b);
    }
    #\${CURSOR_ID} .pointer {
      width: 100%;
      height: 100%;
      transform-origin: 6px 6px;
      animation: __agent_cursor_pulse__ 1.2s ease-in-out infinite;
    }
    @keyframes __agent_cursor_pulse__ {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    #\${CURSOR_ID}.pressing .pointer {
      transform: scale(0.75) !important;
      animation: none;
    }
    #\${CURSOR_ID} .bot-badge {
      position: absolute;
      left: 26px;
      top: 22px;
      font: 800 11px/1 system-ui, sans-serif;
      color: #000;
      background: #ffeb3b;
      padding: 3px 6px;
      border-radius: 4px;
      border: 2px solid #000;
    }
    #\${TARGET_ID} {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 72px !important;
      height: 72px !important;
      margin: -36px 0 0 -36px;
      border: 4px dashed #ff5722 !important;
      border-radius: 50% !important;
      box-shadow: 0 0 0 6px rgba(255,87,34,0.35), inset 0 0 20px rgba(255,235,59,0.4) !important;
      pointer-events: none !important;
      z-index: 2147483646 !important;
      display: none;
      opacity: 1 !important;
      animation: __agent_target_pulse__ 0.7s ease-in-out infinite;
    }
    #\${TARGET_ID}.visible { display: block !important; }
    @keyframes __agent_target_pulse__ {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.12); }
    }
    .\${RIPPLE_CLASS} {
      position: fixed;
      width: 56px;
      height: 56px;
      margin: -28px 0 0 -28px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483645;
      background: radial-gradient(circle, rgba(255,235,59,0.9) 0%, transparent 70%);
      animation: __agent_ripple__ 350ms ease-out forwards;
    }
    @keyframes __agent_ripple__ {
      from { transform: scale(0.2); opacity: 1; }
      to { transform: scale(1.4); opacity: 0; }
    }
  \`;
  (document.documentElement || document.body).appendChild(style);

  const root = document.createElement("div");
  root.id = CURSOR_ID;
  root.innerHTML = \`
    <svg class="pointer" viewBox="0 0 24 24">
      <path d="M5 3L19 12L11 13L9 21L5 3Z" fill="#ff1744" stroke="#fff" stroke-width="2"/>
    </svg>
    <span class="bot-badge">BOT</span>
  \`;
  (document.documentElement || document.body).appendChild(root);

  const targetRing = document.createElement("div");
  targetRing.id = TARGET_ID;
  (document.documentElement || document.body).appendChild(targetRing);

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

  function showTarget(x, y) {
    targetRing.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px,0)";
    targetRing.classList.add("visible");
  }

  function hideTarget() {
    targetRing.classList.remove("visible");
  }

  applyPos(currentX, currentY);

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function calcDuration(dist, override) {
    if (override > 0) return Math.max(200, Math.min(900, override));
    return Math.max(280, Math.min(900, 180 + dist * 0.42));
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
    setTimeout(() => ripple.remove(), 400);
  }

  async function pressAt(x, y) {
    showTarget(x, y);
    const dist = Math.hypot(x - currentX, y - currentY);
    if (dist > 10) await moveTo(x, y);
    root.classList.add("pressing");
    playClickRipple(x + 4, y + 4);
    await new Promise((r) => setTimeout(r, 100));
    root.classList.remove("pressing");
    setTimeout(hideTarget, 500);
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
  if (overrideMs !== undefined) return Math.max(200, Math.min(900, overrideMs));
  const dist = Math.hypot(toX - fromX, toY - fromY);
  return Math.max(280, Math.min(900, 180 + dist * 0.42));
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
  x: number,
  y: number
): Promise<void> {
  await ensureCursorOnPage(page);
  await page.evaluate(
    ({ x, y }) => window.__agentVirtualCursor?.showTarget(x, y),
    { x, y }
  );
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

/** Fast move: virtual cursor animates; real mouse jumps once at end */
export async function botMoveTo(
  page: import("playwright").Page,
  x: number,
  y: number,
  durationMs?: number
): Promise<void> {
  await ensureCursorOnPage(page);
  const from = await getCursorPosition(page);
  const duration = moveDurationForDistance(from.x, from.y, x, y, durationMs);

  await page.evaluate(
    async ({ x, y, duration }) => {
      window.__agentVirtualCursor?.showTarget(x, y);
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
  }
}
