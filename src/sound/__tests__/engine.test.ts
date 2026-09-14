import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundEngine, type EngineDeps } from '../engine';

function fakeDeps(overrides: Partial<EngineDeps> = {}) {
  const listeners: Record<string, () => void> = {};
  const audio = {
    src: '', loop: false, crossOrigin: null as string | null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((ev: string, cb: () => void) => { listeners[ev] = cb; }),
  };
  const store = new Map<string, string>();
  const deps: EngineDeps = {
    src: '/portfolio/audio/ambient.mp3',
    createAudio: () => audio as unknown as HTMLAudioElement,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    },
    connectAnalyser: null, // web audio absent in tests; engine must cope
    ...overrides,
  };
  return { deps, audio, store, listeners };
}

describe('máquina de estados do som', () => {
  it('nasce idle e não toca nada sozinho', () => {
    const { deps, audio } = fakeDeps();
    const e = createSoundEngine(deps);
    expect(e.getState()).toBe('idle');
    expect(audio.play).not.toHaveBeenCalled();
  });
  it('primeiro gesto toca (sem preferência salva)', () => {
    const { deps, audio } = fakeDeps();
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    expect(audio.play).toHaveBeenCalledOnce();
    expect(e.getState()).toBe('playing');
  });
  it('preferência pausada é respeitada no primeiro gesto', () => {
    const { deps, audio, store } = fakeDeps();
    store.set('som', 'paused');
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    expect(audio.play).not.toHaveBeenCalled();
    expect(e.getState()).toBe('paused');
  });
  it('toggle alterna e persiste', () => {
    const { deps, audio, store } = fakeDeps();
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    e.toggle();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(store.get('som')).toBe('paused');
    e.toggle();
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(store.get('som')).toBe('playing');
  });
  it('erro no áudio → unavailable; toggle não chama áudio, mas alterna a preferência', () => {
    const { deps, audio, listeners, store } = fakeDeps();
    const e = createSoundEngine(deps);
    listeners['error']?.();
    expect(e.getState()).toBe('unavailable');
    e.toggle();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.pause).not.toHaveBeenCalled();
    expect(store.get('som')).toBe('paused');
    expect(e.getState()).toBe('unavailable');
  });
  it('gesto repetido não reinicia', () => {
    const { deps, audio } = fakeDeps();
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    e.handleFirstGesture();
    expect(audio.play).toHaveBeenCalledOnce();
  });
  it('lowBand é 0 quando não está tocando', () => {
    const { deps } = fakeDeps();
    const e = createSoundEngine(deps);
    expect(e.lowBand()).toBe(0);
  });
  it('notifica assinantes', () => {
    const { deps } = fakeDeps();
    const e = createSoundEngine(deps);
    const seen: string[] = [];
    e.subscribe((s) => seen.push(s));
    e.handleFirstGesture();
    e.toggle();
    expect(seen).toEqual(['playing', 'paused']);
  });
  it('AbortError do play() interrompido não marca unavailable', async () => {
    const { deps, audio } = fakeDeps();
    audio.play.mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    await Promise.resolve();
    await Promise.resolve();
    expect(e.getState()).not.toBe('unavailable');
  });
  it('erro real no play() marca unavailable', async () => {
    const { deps, audio } = fakeDeps();
    audio.play.mockRejectedValue(new Error('boom'));
    const e = createSoundEngine(deps);
    e.handleFirstGesture();
    await Promise.resolve();
    await Promise.resolve();
    expect(e.getState()).toBe('unavailable');
  });
});

describe('soundEnabled: sons de interação sobrevivem sem mp3', () => {
  it('erro antes do gesto + handleFirstGesture sem preferência salva → soundEnabled true', () => {
    const { deps, listeners } = fakeDeps();
    const e = createSoundEngine(deps);
    listeners['error']?.();
    expect(e.getState()).toBe('unavailable');
    expect(e.soundEnabled()).toBe(false);
    e.handleFirstGesture();
    expect(e.soundEnabled()).toBe(true);
  });
  it('erro antes do gesto + preferência pausada salva → soundEnabled continua false', () => {
    const { deps, listeners, store } = fakeDeps();
    store.set('som', 'paused');
    const e = createSoundEngine(deps);
    listeners['error']?.();
    e.handleFirstGesture();
    expect(e.soundEnabled()).toBe(false);
  });
  it('toggle() durante unavailable alterna a preferência e soundEnabled()', () => {
    const { deps, audio, listeners, store } = fakeDeps();
    const e = createSoundEngine(deps);
    listeners['error']?.();
    e.handleFirstGesture();
    expect(e.soundEnabled()).toBe(true);

    e.toggle();
    expect(store.get('som')).toBe('paused');
    expect(e.soundEnabled()).toBe(false);
    expect(e.getState()).toBe('unavailable');
    expect(audio.play).not.toHaveBeenCalled();

    e.toggle();
    expect(store.get('som')).toBe('playing');
    expect(e.soundEnabled()).toBe(true);
    expect(audio.play).not.toHaveBeenCalled();
  });
});
