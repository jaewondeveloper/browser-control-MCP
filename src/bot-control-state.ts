/** When false, cursor/overlay are not re-applied — user can interact with the page. */
let botControlActive = false;

export function isBotControlActive(): boolean {
  return botControlActive;
}

export function setBotControlActive(active: boolean): void {
  botControlActive = active;
}
