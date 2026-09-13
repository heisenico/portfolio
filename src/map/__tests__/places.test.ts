import { describe, expect, it } from 'vitest';
import { EDGES, EDGE_NEXT, PLACES, PLACE_IDS, ROOT } from '../places';

describe('o mapa bate com o handoff', () => {
  it('tem os 14 lugares', () => expect(PLACE_IDS).toHaveLength(14));
  it('coordenadas verbatim do README', () => {
    expect([PLACES.rio.cx, PLACES.rio.cy]).toEqual([41.4, 83.7]);
    expect([PLACES.tiradentes.cx, PLACES.tiradentes.cy]).toEqual([40.7, 82]);
    expect([PLACES.salvador.cx, PLACES.salvador.cy]).toEqual([38, 75.4]);
    expect([PLACES.recife.cx, PLACES.recife.cy]).toEqual([45.2, 74.3]);
    expect([PLACES['joao-pessoa'].cx, PLACES['joao-pessoa'].cy]).toEqual([48.1, 69.6]);
    expect([PLACES.natal.cx, PLACES.natal.cy]).toEqual([48.1, 68.7]);
    expect([PLACES.atins.cx, PLACES.atins.cy]).toEqual([47.8, 67.4]);
    expect([PLACES['chapada-dos-veadeiros'].cx, PLACES['chapada-dos-veadeiros'].cy]).toEqual([41.8, 64.4]);
    expect([PLACES['buenos-aires'].cx, PLACES['buenos-aires'].cy]).toEqual([29.3, 94.9]);
    expect([PLACES.havana.cx, PLACES.havana.cy]).toEqual([10.1, 39.9]);
    expect([PLACES.cancun.cx, PLACES.cancun.cy]).toEqual([6.5, 41.8]);
    expect([PLACES['washington-dc'].cx, PLACES['washington-dc'].cy]).toEqual([14.4, 24.9]);
    expect([PLACES['new-york'].cx, PLACES['new-york'].cy]).toEqual([16.8, 23.1]);
    expect([PLACES.estonia.cx, PLACES.estonia.cy]).toEqual([95.8, 5.3]);
  });
  it('rio é a raiz, estônia é o próximo', () => {
    expect(ROOT).toBe('rio');
    expect(PLACES.estonia.next).toBe(true);
    expect(Object.values(PLACES).filter((p) => p.next)).toHaveLength(1);
  });
  it('as arestas são as do README', () => {
    expect(EDGES).toBe(
      'M41.4 83.7 L40.7 82 M41.4 83.7 L38 75.4 M41.4 83.7 L45.2 74.3 L48.1 69.6 L48.1 68.7 L47.8 67.4 L41.8 64.4 M41.4 83.7 L29.3 94.9 M41.4 83.7 L10.1 39.9 L6.5 41.8 M10.1 39.9 L14.4 24.9 L16.8 23.1',
    );
    expect(EDGE_NEXT).toBe('M16.8 23.1 Q60 -6 95.8 5.3');
  });
});
