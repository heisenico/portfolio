export type SoundState = 'idle' | 'playing' | 'paused' | 'unavailable';

export interface EngineDeps {
  src: string;
  createAudio: () => HTMLAudioElement;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Wraps the audio element in a WebAudio graph (gain fade + analyser). null = plain playback. */
  connectAnalyser: ((audio: HTMLAudioElement) => { lowBand: () => number }) | null;
}

export interface SoundEngine {
  handleFirstGesture(): void;
  toggle(): void;
  getState(): SoundState;
  subscribe(cb: (s: SoundState) => void): () => void;
  lowBand(): number;
}

const KEY = 'som';

export function createSoundEngine(deps: EngineDeps): SoundEngine {
  let state: SoundState = 'idle';
  let gestured = false;
  let analyser: { lowBand: () => number } | null = null;
  const subs = new Set<(s: SoundState) => void>();

  const audio = deps.createAudio();
  audio.src = deps.src;
  audio.loop = true;
  audio.addEventListener('error', () => set('unavailable'));

  function set(s: SoundState) {
    state = s;
    subs.forEach((cb) => cb(s));
  }

  function play() {
    analyser ??= deps.connectAnalyser?.(audio) ?? null;
    void audio.play().catch((err: unknown) => {
      if (!(err instanceof Error && err.name === 'AbortError')) set('unavailable');
    });
    if (state !== 'unavailable') {
      deps.storage.setItem(KEY, 'playing');
      set('playing');
    }
  }

  return {
    handleFirstGesture() {
      if (gestured || state === 'unavailable') return;
      gestured = true;
      if (deps.storage.getItem(KEY) === 'paused') set('paused');
      else play();
    },
    toggle() {
      if (state === 'unavailable') return;
      gestured = true;
      if (state === 'playing') {
        audio.pause();
        deps.storage.setItem(KEY, 'paused');
        set('paused');
      } else {
        play();
      }
    },
    getState: () => state,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    lowBand: () => (state === 'playing' ? analyser?.lowBand() ?? 0 : 0),
  };
}
