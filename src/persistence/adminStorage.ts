import type { AppEnvironmentConfig } from '../config/env';

const ADMIN_CONFIG_KEY = 'rehlat_alhadm_admin_cfg_v1';
const ADMIN_SESSION_KEY = 'rehlat_alhadm_admin_unlocked_v1';

interface StoredAdminConfig {
  readonly developerAttributionOverride?: string;
  readonly localPasscodeHash?: string;
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

function readAdminConfig(): StoredAdminConfig {
  if (typeof window === 'undefined') {
    return {};
  }
  const raw = window.localStorage.getItem(ADMIN_CONFIG_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredAdminConfig;
  } catch {
    return {};
  }
}

function writeAdminConfig(cfg: StoredAdminConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(cfg));
}

/**
 * Returns the configured developer attribution or null if unconfigured.
 * Strictly obeys: "Do not invent the programmer’s name. Keep developer attribution configurable."
 */
export function getDeveloperAttribution(
  env: AppEnvironmentConfig
): string | null {
  const stored = readAdminConfig().developerAttributionOverride;
  if (typeof stored === 'string') {
    const trimmed = stored.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return env.defaultDeveloperAttribution;
}

export function saveDeveloperAttributionOverride(value: string): void {
  const current = readAdminConfig();
  writeAdminConfig({
    ...current,
    developerAttributionOverride: value.trim(),
  });
}

export function isAdminPasscodeInitialized(env: AppEnvironmentConfig): boolean {
  if (env.configuredAdminPasscode) {
    return true;
  }
  const current = readAdminConfig();
  return Boolean(current.localPasscodeHash);
}

export function initializeLocalAdminPasscode(newPasscode: string): boolean {
  const trimmed = newPasscode.trim();
  if (trimmed.length < 4) {
    return false;
  }
  const current = readAdminConfig();
  writeAdminConfig({
    ...current,
    localPasscodeHash: simpleHash(trimmed),
  });
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
  }
  return true;
}

export function verifyAdminPasscode(
  input: string,
  env: AppEnvironmentConfig
): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (env.configuredAdminPasscode) {
    const ok = trimmed === env.configuredAdminPasscode;
    if (ok && typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    }
    return ok;
  }

  const current = readAdminConfig();
  if (!current.localPasscodeHash) {
    return false;
  }
  const ok = simpleHash(trimmed) === current.localPasscodeHash;
  if (ok && typeof window !== 'undefined') {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
  }
  return ok;
}

export function isAdminSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

export function lockAdminSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
