import { createSoundEngine, type SoundEngine } from './engine';

export function wireSound(base: string): SoundEngine {
  const engine = createSoundEngine({
    src: `${base.replace(/\/$/, '')}/audio/ambient.mp3`,
    createAudio: () => new Audio(),
    storage: safeStorage(),
    connectAnalyser: (audio) => {
      const ctx = new AudioContext();
      const srcNode = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      srcNode.connect(gain).connect(analyser).connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 1.5);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      return {
        lowBand() {
          analyser.getByteFrequencyData(bins);
          let sum = 0;
          for (let i = 0; i < 8; i++) sum += bins[i]!;
          return sum / (8 * 255);
        },
      };
    },
  });

  const gesture = () => engine.handleFirstGesture();
  addEventListener('pointerdown', gesture, { once: true });
  addEventListener('keydown', gesture, { once: true });

  const syncButton = () => {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const s = engine.getState();
    const playing = s === 'playing';
    btn.dataset.state = playing ? 'playing' : 'paused';
    btn.setAttribute('aria-label', btn.dataset[playing ? 'labelPlaying' : 'labelPaused'] ?? '');
    if (s === 'unavailable') btn.setAttribute('aria-disabled', 'true');
  };
  engine.subscribe(syncButton);
  document.addEventListener('astro:page-load', syncButton); // fresh button after each swap
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#sound-toggle')) engine.toggle();
  });
  syncButton();
  return engine;
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  }
}
