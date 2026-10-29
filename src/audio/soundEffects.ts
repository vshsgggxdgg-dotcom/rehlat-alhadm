/**
 * Short, unobtrusive Web Audio API sound effects for «رحلة الهضم».
 *
 * Rules:
 * - Effects only for: 'confirmation', 'success', 'retry', 'badge'.
 * - Strictly NO background music and NO answer timer ticks.
 * - Respects persistent mute state (`soundMuted` in AccessibilitySettings).
 * - Respects browser audio activation policy (only initializes/resumes inside user gesture handlers).
 * - Prevents overlapping audio by stopping any active scheduled oscillators before starting a new effect.
 */

export type SoundEffectKind = 'confirmation' | 'success' | 'retry' | 'badge';

interface ToneStep {
  readonly frequencyHz: number;
  readonly startOffsetSec: number;
  readonly durationSec: number;
  readonly type: OscillatorType;
  readonly peakGain: number;
}

const SOUND_PATTERNS: Record<SoundEffectKind, readonly ToneStep[]> = {
  // Subtle, crisp confirmation tap (90ms)
  confirmation: [
    {
      frequencyHz: 440,
      startOffsetSec: 0,
      durationSec: 0.075,
      type: 'sine',
      peakGain: 0.08,
    },
  ],
  // Warm, restrained ascending two-note chime for correct answers (~260ms)
  success: [
    {
      frequencyHz: 523.25, // C5
      startOffsetSec: 0,
      durationSec: 0.11,
      type: 'sine',
      peakGain: 0.11,
    },
    {
      frequencyHz: 659.25, // E5
      startOffsetSec: 0.1,
      durationSec: 0.16,
      type: 'sine',
      peakGain: 0.12,
    },
  ],
  // Gentle, soft low double-note prompt for retry / second-attempt hint (~240ms)
  retry: [
    {
      frequencyHz: 349.23, // F4
      startOffsetSec: 0,
      durationSec: 0.1,
      type: 'triangle',
      peakGain: 0.09,
    },
    {
      frequencyHz: 311.13, // D#4
      startOffsetSec: 0.1,
      durationSec: 0.14,
      type: 'triangle',
      peakGain: 0.08,
    },
  ],
  // Celebratory yet restrained three-note arpeggio for level completion & badge award (~420ms)
  badge: [
    {
      frequencyHz: 523.25, // C5
      startOffsetSec: 0,
      durationSec: 0.11,
      type: 'triangle',
      peakGain: 0.11,
    },
    {
      frequencyHz: 659.25, // E5
      startOffsetSec: 0.1,
      durationSec: 0.12,
      type: 'triangle',
      peakGain: 0.12,
    },
    {
      frequencyHz: 783.99, // G5
      startOffsetSec: 0.21,
      durationSec: 0.21,
      type: 'sine',
      peakGain: 0.13,
    },
  ],
};

class SoundEffectController {
  private ctx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeGains: GainNode[] = [];

  private isMuted(): boolean {
    if (typeof document !== 'undefined') {
      if (document.documentElement.getAttribute('data-sound-muted') === 'true') {
        return true;
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('rehlat_alhadm_a11y_v1');
        if (raw) {
          const parsed = JSON.parse(raw) as { soundMuted?: boolean };
          if (parsed.soundMuted) return true;
        }
      } catch {
        // Ignore storage read errors
      }
    }
    return false;
  }

  private getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtx) return null;

    try {
      this.ctx = new AudioCtx();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Stops any currently playing sound effect immediately so effects never overlap.
   */
  public stopCurrentEffect(): void {
    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Already stopped
      }
    }
    for (const gain of this.activeGains) {
      try {
        gain.disconnect();
      } catch {
        // Already disconnected
      }
    }
    this.activeOscillators = [];
    this.activeGains = [];
  }

  public play(kind: SoundEffectKind): void {
    if (this.isMuted()) {
      this.stopCurrentEffect();
      return;
    }

    const context = this.getOrCreateContext();
    if (!context) return;

    // Prevent any overlapping audio
    this.stopCurrentEffect();

    const triggerTones = () => {
      if (this.isMuted()) return;
      const now = context.currentTime;
      const steps = SOUND_PATTERNS[kind];

      for (const step of steps) {
        try {
          const osc = context.createOscillator();
          const gain = context.createGain();

          osc.type = step.type;
          osc.frequency.setValueAtTime(
            step.frequencyHz,
            now + step.startOffsetSec
          );

          const startAt = now + step.startOffsetSec;
          const endAt = startAt + step.durationSec;

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.linearRampToValueAtTime(step.peakGain, startAt + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

          osc.connect(gain);
          gain.connect(context.destination);

          osc.start(startAt);
          osc.stop(endAt + 0.01);

          this.activeOscillators.push(osc);
          this.activeGains.push(gain);

          osc.onended = () => {
            this.activeOscillators = this.activeOscillators.filter(
              (item) => item !== osc
            );
            this.activeGains = this.activeGains.filter((item) => item !== gain);
          };
        } catch {
          // Ignore individual node errors if context is suspended by browser policy
        }
      }
    };

    if (context.state === 'suspended') {
      context
        .resume()
        .then(() => {
          triggerTones();
        })
        .catch(() => {
          // Browser blocked audio before user gesture; fail silently
        });
    } else {
      triggerTones();
    }
  }
}

export const soundEffects = new SoundEffectController();
