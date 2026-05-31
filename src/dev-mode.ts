export type DevModeConfig = {
  enabled: boolean;
  lockInput: boolean;
  vignette: boolean;
  fast: boolean;
};

function envFlag(name: string, defaultOn: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultOn;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

const state: DevModeConfig = {
  enabled: envFlag("BROWSER_CONTROL_DEV_MODE", true),
  lockInput: envFlag("BROWSER_CONTROL_LOCK_INPUT", true),
  vignette: envFlag("BROWSER_CONTROL_VIGNETTE", true),
  fast: envFlag("BROWSER_CONTROL_FAST", true),
};

export function getDevMode(): Readonly<DevModeConfig> {
  return state;
}

export function setDevMode(partial: Partial<DevModeConfig>): DevModeConfig {
  Object.assign(state, partial);
  return { ...state };
}

export function resetDevModeFromEnv(): DevModeConfig {
  state.enabled = envFlag("BROWSER_CONTROL_DEV_MODE", true);
  state.lockInput = envFlag("BROWSER_CONTROL_LOCK_INPUT", true);
  state.vignette = envFlag("BROWSER_CONTROL_VIGNETTE", true);
  state.fast = envFlag("BROWSER_CONTROL_FAST", true);
  return { ...state };
}

export function disableDevModeOverlays(): DevModeConfig {
  return setDevMode({ enabled: false, lockInput: false, vignette: false });
}

export function isFastMotion(): boolean {
  return state.enabled && state.fast;
}

export function moveDurationScale(): number {
  return isFastMotion() ? 0.45 : 1;
}

export function typingDelayMs(requested?: number): number {
  const base = requested ?? (isFastMotion() ? 14 : 28);
  return isFastMotion() ? Math.max(10, base) : Math.max(20, base);
}
