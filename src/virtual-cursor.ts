/**
 * Injected on every document. Bot cursor is always visible and moves smoothly.
 */
export const VIRTUAL_CURSOR_INIT_SCRIPT = `
(function () {
  const CURSOR_ID = "__agent_virtual_cursor__";
  const STYLE_ID = "__agent_virtual_cursor_style__";
  const RIPPLE_CLASS = "__agent_click_ripple__";

  function removeExisting() {
    document.getElementById(CURSOR_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  removeExisting();

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
      margin: 0;
      padding: 0;
      opacity: 1;
      visibility: visible;
      will-change: transform;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
    }
    #\${CURSOR_ID} .pointer {
      width: 100%;
      height: 100%;
      transform-origin: 4px 4px;
      transition: transform 150ms cubic-bezier(0.34, 1.2, 0.64, 1);
    }
    #\${CURSOR_ID}.pressing .pointer {
      transform: scale(0.78);
    }
    #\${CURSOR_ID} .bot-badge {
      position: absolute;
      left: 20px;
      top: 18px;
      font: 600 10px/1 system-ui, sans-serif;
      color: #fff;
      background: #2563eb;
      padding: 2px 5px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .\${RIPPLE_CLASS} {
      position: fixed;
      width: 52px;
      height: 52px;
      margin-left: -26px;
      margin-top: -26px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483646;
      background: radial-gradient(circle, rgba(37,99,235,0.5) 0%, rgba(37,99,235,0) 72%);
      animation: __agent_ripple__ 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes __agent_ripple__ {
      0% { transform: scale(0.25); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
  \`;
  (document.documentElement || document.head || document.body).appendChild(style);

  const root = document.createElement("div");
  root.id = CURSOR_ID;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = \`
    <svg class="pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L19 12L11 13L9 21L5 3Z" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.25" stroke-linejoin="round"/>
    </svg>
    <span class="bot-badge">BOT</span>
  \`;
  (document.documentElement || document.body).appendChild(root);

  let animFrame = null;
  let currentX = Math.max(40, window.innerWidth * 0.5 - 16);
  let currentY = Math.max(40, window.innerHeight * 0.5 - 16);

  function applyPos(x, y) {
    root.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    currentX = x;
    currentY = y;
  }

  applyPos(currentX, currentY);

  function easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  function moveTo(x, y, durationMs) {
    return new Promise((resolve) => {
      if (animFrame) cancelAnimationFrame(animFrame);
      const startX = currentX;
      const startY = currentY;
      const dist = Math.hypot(x - startX, y - startY);
      const duration = Math.max(
        420,
        Math.min(1600, durationMs || 380 + dist * 0.65)
      );
      const start = performance.now();
      root.style.opacity = "1";

      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const e = easeInOutQuint(t);
        applyPos(startX + (x - startX) * e, startY + (y - startY) * e);
        if (t < 1) animFrame = requestAnimationFrame(step);
        else {
          animFrame = null;
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
    ripple.addEventListener("animationend", () => ripple.remove());
    setTimeout(() => ripple.remove(), 520);
  }

  async function showClick(x, y) {
    await moveTo(x, y, undefined);
    root.classList.add("pressing");
    playClickRipple(x + 6, y + 6);
    await new Promise((r) => setTimeout(r, 160));
    root.classList.remove("pressing");
  }

  function show() {
    root.style.opacity = "1";
    root.style.visibility = "visible";
  }

  window.__agentVirtualCursor = {
    moveTo,
    showClick,
    show,
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
  if (overrideMs !== undefined) return Math.max(420, Math.min(1600, overrideMs));
  const dist = Math.hypot(toX - fromX, toY - fromY);
  return Math.max(420, Math.min(1600, 380 + dist * 0.65));
}

export async function ensureCursorOnPage(page: import("playwright").Page): Promise<void> {
  await page.evaluate(VIRTUAL_CURSOR_INIT_SCRIPT).catch(() => {});
  await page
    .evaluate(() => window.__agentVirtualCursor?.show())
    .catch(() => {});
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

export async function animateCursorMove(
  page: import("playwright").Page,
  x: number,
  y: number,
  durationMs?: number
): Promise<void> {
  await ensureCursorOnPage(page);
  const from = await getCursorPosition(page);
  const duration = moveDurationForDistance(from.x, from.y, x, y, durationMs);
  await page.evaluate(
    ({ x, y, duration }) => window.__agentVirtualCursor?.moveTo(x, y, duration),
    { x, y, duration }
  );
}

export async function animateCursorClick(
  page: import("playwright").Page,
  x: number,
  y: number
): Promise<void> {
  await ensureCursorOnPage(page);
  await page.evaluate(
    ({ x, y }) => window.__agentVirtualCursor?.showClick(x, y),
    { x, y }
  );
}

declare global {
  interface Window {
    __agentVirtualCursor?: {
      moveTo: (x: number, y: number, durationMs?: number) => Promise<void>;
      showClick: (x: number, y: number) => Promise<void>;
      show: () => void;
      getPosition: () => { x: number; y: number };
    };
  }
}
