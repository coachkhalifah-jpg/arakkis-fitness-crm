/** Web Audio tones for take-home workout Preferences (mute-gated by caller). */

export type WorkoutTone = "begin" | "warn" | "end";

type ToneSpec = {
  frequency: number;
  durationMs: number;
  gain: number;
};

const TONES: Record<WorkoutTone, ToneSpec> = {
  begin: { frequency: 660, durationMs: 280, gain: 0.12 },
  warn: { frequency: 880, durationMs: 90, gain: 0.1 },
  end: { frequency: 520, durationMs: 320, gain: 0.12 },
};

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext) sharedContext = new AudioCtx();
  return sharedContext;
}

export function playWorkoutTone(tone: WorkoutTone): void {
  const ctx = getContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);

  const spec = TONES[tone];
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(spec.frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(spec.gain, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + spec.durationMs / 1000 + 0.02);
}
