import type { AccessibilitySettings, FontScaleOption } from '../domain/types';

const A11Y_STORAGE_KEY = 'rehlat_alhadm_a11y_v1';

const VALID_SCALES: readonly FontScaleOption[] = [
  'normal',
  'large',
  'xlarge',
  'xxlarge',
];

export function loadAccessibilitySettings(): AccessibilitySettings {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fallback: AccessibilitySettings = {
    fontScale: 'normal',
    highContrast: false,
    reducedMotion: prefersReducedMotion,
    enhancedFocus: true,
    soundMuted: false,
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(A11Y_STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    const fontScale =
      parsed.fontScale && VALID_SCALES.includes(parsed.fontScale)
        ? parsed.fontScale
        : 'normal';

    return {
      fontScale,
      highContrast: Boolean(parsed.highContrast),
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean'
          ? parsed.reducedMotion
          : prefersReducedMotion,
      enhancedFocus:
        typeof parsed.enhancedFocus === 'boolean' ? parsed.enhancedFocus : true,
      soundMuted: Boolean(parsed.soundMuted),
    };
  } catch {
    return fallback;
  }
}

export function saveAccessibilitySettings(
  settings: AccessibilitySettings
): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  applyAccessibilityToDocument(settings);
}

export function applyAccessibilityToDocument(
  settings: AccessibilitySettings
): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.setAttribute('data-font-scale', settings.fontScale);
  root.setAttribute(
    'data-high-contrast',
    settings.highContrast ? 'true' : 'false'
  );
  root.setAttribute(
    'data-reduced-motion',
    settings.reducedMotion ? 'true' : 'false'
  );
  root.setAttribute(
    'data-enhanced-focus',
    settings.enhancedFocus ? 'true' : 'false'
  );
  root.setAttribute(
    'data-sound-muted',
    settings.soundMuted ? 'true' : 'false'
  );
}
