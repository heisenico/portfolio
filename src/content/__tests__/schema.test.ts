import { describe, expect, it } from 'vitest';
import { entrySchema } from '../schema';

const valid = { title: 'chegando no rio', date: '2026-09-04', place: 'rio' };

describe('schema do diário', () => {
  it('aceita entrada mínima válida', () => {
    expect(entrySchema.safeParse(valid).success).toBe(true);
  });
  it('rejeita lugar fora do mapa', () => {
    expect(entrySchema.safeParse({ ...valid, place: 'paris' }).success).toBe(false);
  });
  it('rejeita foto sem alt', () => {
    const r = entrySchema.safeParse({ ...valid, media: { type: 'photo' } });
    expect(r.success).toBe(false);
  });
  it('aceita foto placeholder (sem src) com alt', () => {
    const r = entrySchema.safeParse({ ...valid, media: { type: 'photo', alt: 'praia do leme ao amanhecer' } });
    expect(r.success).toBe(true);
  });
  it('rejeita galeria vazia e galeria com item sem alt', () => {
    expect(entrySchema.safeParse({ ...valid, media: { type: 'gallery', items: [] } }).success).toBe(false);
    expect(entrySchema.safeParse({ ...valid, media: { type: 'gallery', items: [{ src: 'x.jpg' }] } }).success).toBe(false);
  });
  it('aceita vídeo com url e alt', () => {
    const r = entrySchema.safeParse({
      ...valid,
      media: { type: 'video', url: 'https://www.youtube.com/watch?v=abc', alt: 'vlog de atins' },
    });
    expect(r.success).toBe(true);
  });
  it('coage a data para Date', () => {
    const r = entrySchema.parse(valid);
    expect(r.date).toBeInstanceOf(Date);
  });
});
