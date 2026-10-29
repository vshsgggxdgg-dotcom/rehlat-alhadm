import { asContentVersionId, type ContentVersionId } from '../domain/ids';
import type { AppOperatingMode } from '../domain/types';

export interface AppEnvironmentConfig {
  readonly mode: AppOperatingMode;
  readonly contentVersionId: ContentVersionId;
  readonly supabaseUrl: string | null;
  readonly supabasePublishableKey: string | null;
  readonly supabaseAnonKey: string | null;
  readonly supabaseCaptchaSiteKey: string | null;
  readonly isSupabaseConfigured: boolean;
  readonly missingProductionConfigItems: readonly string[];
  readonly apiBaseUrl: string | null;
  readonly enableDiagnostics: boolean;
  readonly storageNamespace: string;
  readonly isProductionBackendConfigured: boolean;
  readonly defaultDeveloperAttribution: string | null;
  readonly configuredAdminPasscode: string | null;
}

const MODE_OVERRIDE_SESSION_KEY = 'rehlat_alhadm_runtime_mode_override';

function parseOperatingMode(raw: string | undefined): AppOperatingMode {
  if (typeof window !== 'undefined') {
    const override = window.sessionStorage.getItem(MODE_OVERRIDE_SESSION_KEY);
    if (override === 'demo' || override === 'production') {
      return override;
    }
  }
  const normalized = (raw ?? 'demo').trim().toLowerCase();
  return normalized === 'production' ? 'production' : 'demo';
}

export function setRuntimeModeOverride(mode: AppOperatingMode): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(MODE_OVERRIDE_SESSION_KEY, mode);
  }
}

export function loadEnvironmentConfig(): AppEnvironmentConfig {
  const mode = parseOperatingMode(import.meta.env.VITE_APP_MODE);
  const rawContentVersion =
    import.meta.env.VITE_CONTENT_VERSION || 'content-ar-g6-digestion-v1.4.0';

  const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const rawPublishableKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  ).trim();
  const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const rawCaptchaSiteKey = (
    import.meta.env.VITE_SUPABASE_CAPTCHA_SITE_KEY ?? ''
  ).trim();

  const supabaseUrl = rawSupabaseUrl.length > 0 ? rawSupabaseUrl : null;
  const effectivePublicKey =
    rawPublishableKey.length > 0
      ? rawPublishableKey
      : rawAnonKey.length > 0
      ? rawAnonKey
      : null;

  const supabaseCaptchaSiteKey =
    rawCaptchaSiteKey.length > 0 ? rawCaptchaSiteKey : null;

  const isSupabaseConfigured =
    supabaseUrl !== null && effectivePublicKey !== null;

  const missingProductionConfigItems: string[] = [];
  if (!supabaseUrl) {
    missingProductionConfigItems.push('VITE_SUPABASE_URL');
  }
  if (!effectivePublicKey) {
    missingProductionConfigItems.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY (أو VITE_SUPABASE_ANON_KEY)'
    );
  }

  const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const apiBaseUrl = rawApiBaseUrl.length > 0 ? rawApiBaseUrl : null;

  const enableDiagnostics =
    (import.meta.env.VITE_ENABLE_DIAGNOSTICS ?? 'true').toLowerCase() !== 'false';

  const rawAttribution = (import.meta.env.VITE_DEVELOPER_ATTRIBUTION ?? '').trim();
  const defaultDeveloperAttribution =
    rawAttribution.length > 0 ? rawAttribution : null;

  const rawAdminPasscode = (import.meta.env.VITE_ADMIN_PASSCODE ?? '').trim();
  const configuredAdminPasscode =
    rawAdminPasscode.length > 0 ? rawAdminPasscode : null;

  // Strict namespace isolation between Local Demo Mode and Production Mode
  const storageNamespace =
    mode === 'production' ? 'rehlat_alhadm_prod_v1' : 'rehlat_alhadm_demo_v1';

  return {
    mode,
    contentVersionId: asContentVersionId(rawContentVersion),
    supabaseUrl,
    supabasePublishableKey: effectivePublicKey,
    supabaseAnonKey: effectivePublicKey,
    supabaseCaptchaSiteKey,
    isSupabaseConfigured,
    missingProductionConfigItems,
    apiBaseUrl,
    enableDiagnostics,
    storageNamespace,
    isProductionBackendConfigured: isSupabaseConfigured || apiBaseUrl !== null,
    defaultDeveloperAttribution,
    configuredAdminPasscode,
  };
}
