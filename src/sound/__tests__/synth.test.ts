import { describe, expect, it, vi } from 'vitest';
import { createSynth, type SynthDeps } from '../synth';

function fakeDeps(enabled: boolean) {
  const played: number[] = [];
  const deps: SynthDeps = {
    enabled: () => enabled,
    playTone: vi.fn((freq: number) => void played.push(freq)),
  };
  return { deps, played };
}

describe('synth respeita o portão do som', () => {
  it('não toca quando o som está desabilitado (antes do gesto)', () => {
    const { deps, played } = fakeDeps(false);
    createSynth(deps).tick();
    expect(played).toHaveLength(0);
  });
  it('não toca mutado (enabled false)', () => {
    const { deps, played } = fakeDeps(false);
    const s = createSynth(deps);
    s.tick(); s.tap(3); s.swell();
    expect(played).toHaveLength(0);
  });
  it('toca quando o som está habilitado', () => {
    const { deps, played } = fakeDeps(true);
    createSynth(deps).tick();
    expect(played).toHaveLength(1);
  });
  it('tap varia o tom por índice do nó (pentatônica de lá menor)', () => {
    const { deps, played } = fakeDeps(true);
    const s = createSynth(deps);
    s.tap(0); s.tap(1);
    expect(played[0]).not.toBe(played[2]);
  });
});
