import type { FieldHandle } from './field';

interface Hooks { tick(): void; tap(index: number): void }

export function bindMapDepth(field: FieldHandle | null, synth: Hooks): void {
  const svg = document.querySelector<SVGSVGElement>('[data-map]');
  const card = document.querySelector<HTMLElement>('[data-tilt]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (svg) {
    svg.querySelectorAll<SVGAElement>('[data-node]').forEach((node, index) => {
      const dot = node.querySelector('.dot')!;
      const show = () => {
        synth.tick();
        if (field && !reduced) {
          const r = dot.getBoundingClientRect();
          field.setGlow((r.x + r.width / 2) / innerWidth, (r.y + r.height / 2) / innerHeight, 0.5);
        }
      };
      const hide = () => field?.setGlow(0, 0, 0);
      node.addEventListener('pointerenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('pointerleave', hide);
      node.addEventListener('blur', hide);
      node.addEventListener('click', () => synth.tap(index));
    });
  }

  if (card && !reduced) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.x) / r.width - 0.5;
      const y = (e.clientY - r.y) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 3}deg) rotateX(${-y * 3}deg)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  }
}
