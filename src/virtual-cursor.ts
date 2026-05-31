/**
 * BOT cursor overlay — always visible, smooth human-like motion.
 */
export const VIRTUAL_CURSOR_INIT_SCRIPT = `
(function () {
  const CURSOR_ID = "__agent_virtual_cursor__";
  const STYLE_ID = "__agent_virtual_cursor_style__";
  const RIPPLE_CLASS = "__agent_click_ripple__";

  document.getElementById(CURSOR_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = \`
    #\${CURSOR_ID} {
      position: fixed;
      left: 0;
      top: 0;
      width: 32px;
      height: 32px;
      pointer-events: none;
      z-index: 2147483647;
      opacity: 1;
      visibility: visible;
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
      transform: scale(0.8);
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
    <svg class="pointer" viewBox="0 0 24 24"><path d="M5 3L19 12L11 13L9 21L5 3Z" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.2"/></svg>
    <span class="bot-badge">BOT</span>
  \`;
  (document.documentElement || document.body).appendChild(root);

  let animFrame = null;
  let moving = false;
  let currentX = 48;
  let currentY = 48;

  function applyPos(x, y) {
    root.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px,0)";
    currentX = x;
    currentY = y;
  }

  applyPos(currentX, currentY);

  /** Smooth ease — soft start and end (no robotic linear mid) */
  function easeSmooth(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function calcDuration(dist, override) {
    if (override > 0) return Math.max(500, Math.min(3200, override));
    return Math.max(650, Math.min(3200, 550 + dist * 1.05));
  }

  function moveTo(x, y, durationMs) {
    return new Promise((resolve) => {
      if (animFrame) cancelAnimationFrame(animFrame);
      const startX = currentX;
      const startY = currentY;
      let targetX = x;
      let targetY = y;
      let dist = Math.hypot(targetX - startX, targetY - startY);

      const duration = calcDuration(dist, durationMs || 0);
      const start = performance.now();
      moving = true;
      root.style.opacity = "1";

      function runSegment(sx, sy, ex, ey, dur, done) {
        const segStart = performance.now();
        const segDist = Math.hypot(ex - sx, ey - sy);

        function step(now) {
          const t = Math.min(1, (now - segStart) / dur);
          const e = easeSmooth(t);
          applyPos(sx + (ex - sx) * e, sy + (ey - sy) * e);
          if (t < 1) animFrame = requestAnimationFrame(step);
          else {
            animFrame = null;
            done();
          }
        }
        animFrame = requestAnimationFrame(step);
      }

      function finish() {
        moving = false;
        resolve();
      }

      if (dist < 18 && dist > 0.5) {
        const bend = 36;
        const midX = (startX + targetX) / 2 + bend;
        const midY = (startY + targetY) / 2 - bend * 0.5;
        const half = duration * 0.55;
        runSegment(startX, startY, midX, midY, half, () => {
          runSegment(midX, midY, targetX, targetY, duration - half, finish);
        });
        return;
      }

      if (dist < 0.5) {
        applyPos(targetX, targetY);
        moving = false;
        resolve();
        return;
      }

      runSegment(startX, startY, targetX, targetY, duration, finish);
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
    await new Promise((r) => setTimeout(r, 130));
    root.classList.remove("pressing");
  }

  async function showClick(x, y) {
    await pressAt(x, y);
  }

  function show() {
    root.style.opacity = "1";
    root.style.visibility = "visible";
  }

  function isMoving() {
    return moving;
  }

  window.__agentVirtualCursor = {
    moveTo,
    pressAt,
    showClick,
    show,
    isMoving,
    getPosition: () => ({ x: currentX, y: currentY }),
  };
})();
`;

export function moveDurationForDistance(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  overrideMs?: number
): number {
  if (overrideMs !== undefined) return Math.max(500, Math.min(3200, overrideMs));
  const dist = Math.hypot(toX - fromX, toY - fromY);
  return Math.max(650, Math.min(3200, 550 + dist * 1.05));
}

function easeSmooth(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export async function ensureCursorOnPage(page: import("playwright").Page): Promise<void> {
  await page.evaluate(VIRTUAL_CURSOR_INIT_SCRIPT).catch(() => {});
  await page.evaluate(() => window.__agentVirtualCursor?.show()).catch(() => {});
}

export async function getCursorPosition(
  page: import("playwright").Page
): Promise<{ x: number; y: number }> {
  await ensureCursorOnPage(page);
  return page.evaluate(() => {
    const c = window.__agentVirtualCursor?.getPosition();
    return c ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  });
}

/** Move BOT cursor + sync Playwright mouse along the same smooth path */
export async function botMoveTo(
  page: import("playwright").Page,
  x: number,
  y: number,
  durationMs?: number
): Promise<void> {
  await ensureCursorOnPage(page);
  const from = await getCursorPosition(page);
  const duration = moveDurationForDistance(from.x, from.y, x, y, durationMs);
  const steps = Math.max(20, Math.min(50, Math.round(duration / 35)));

  const movePromise = page.evaluate(
    async ({ x, y, duration }) => {
      await window.__agentVirtualCursor?.moveTo(x, y, duration);
    },
    { x, y, duration }
  );

  for (let i = 1; i <= steps; i++) {
    const t = easeSmooth(i / steps);
    const mx = from.x + (x - from.x) * t;
    const my = from.y + (y - from.y) * t;
    await page.mouse.move(mx, my);
    await page.waitForTimeout(Math.max(16, Math.floor(duration / steps)));
  }

  await movePromise;
  await page.mouse.move(x, y);
}

export async function botPressAt(page: import("playwright").Page, x: number, y: number): Promise<void> {
  await ensureCursorOnPage(page);
  const pos = await getCursorPosition(page);
  if (Math.hypot(pos.x - x, pos.y - y) > 14) await botMoveTo(page, x, y);
  await page.evaluate(async ({ x, y }) => {
    await window.__agentVirtualCursor?.pressAt(x, y);
  }, { x, y });
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
      isMoving: () => boolean;
      getPosition: () => { x: number; y: number };
    };
  }
}
