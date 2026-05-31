/** Last BOT cursor position (survives page navigation / script re-init) */
let lastX = 0;
let lastY = 0;

export function recordCursorPosition(x: number, y: number): void {
  lastX = x;
  lastY = y;
}

export function getRecordedCursorPosition(): { x: number; y: number } {
  return { x: lastX, y: lastY };
}

export function hasRecordedPosition(): boolean {
  return lastX > 0 && lastY > 0;
}
