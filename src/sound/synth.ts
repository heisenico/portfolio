export interface SynthDeps {
  /** True when interaction sounds should play — independent of whether the ambient track loaded. */
  enabled: () => boolean;
  /** (freq, durationSec, gainPeak) — injected; real impl uses WebAudio */
  playTone: (freq: number, duration: number, gain: number) => void;
}

/* pentatônica de lá menor: A3 C4 D4 E4 G4 A4 ... */
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

export function createSynth(deps: SynthDeps) {
  const gated = (fn: () => void) => () => {
    if (deps.enabled()) fn();
  };
  return {
    tick: gated(() => deps.playTone(SCALE[5]!, 0.06, 0.03)),
    tap(index: number) {
      if (!deps.enabled()) return;
      deps.playTone(SCALE[index % SCALE.length]!, 0.18, 0.06);
      deps.playTone(SCALE[index % SCALE.length]! * 2, 0.12, 0.02);
    },
    swell: gated(() => deps.playTone(SCALE[0]!, 0.6, 0.04)),
  };
}

/** Real WebAudio playTone for the browser wiring. */
export function makePlayTone(ctx: AudioContext) {
  return (freq: number, duration: number, gain: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(filter).connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  };
}
