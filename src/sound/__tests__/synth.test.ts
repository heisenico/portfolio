import { describe, expect, it, vi } from 'vitest';
import { createSynth, type SynthDeps } from '../synth';

function fakeDeps(state: 'idle' | 'playing' | 'paused' | 'unavailable') {
  const played: number[] = [];
  const deps: SynthDeps = {
    getState: () => state,
    playTone: vi.fn((freq: number) => void played.push(freq)),
  };
  return { deps, played };
}

describe('synth respeita o portão do som', () => {
  it('não toca antes do primeiro gesto (idle)', () => {
    const { deps, played } = fakeDeps('idle');
    createSynth(deps).tick();
    expect(played).toHaveLength(0);
  });
  it('não toca mutado (paused)', () => {
    const { deps, played } = fakeDeps('paused');
    const s = createSynth(deps);
    s.tick(); s.tap(3); s.swell();
    expect(played).toHaveLength(0);
  });
  it('toca quando a música toca', () => {
    const { deps, played } = fakeDeps('playing');
    createSynth(deps).tick();
    expect(played).toHaveLength(1);
  });
  it('tap varia o tom por índice do nó (pentatônica de lá menor)', () => {
    const { deps, played } = fakeDeps('playing');
    const s = createSynth(deps);
    s.tap(0); s.tap(1);
    expect(played[0]).not.toBe(played[2]);
  });
});
