export const PLACE_IDS = [
  'rio', 'tiradentes', 'salvador', 'recife', 'joao-pessoa', 'natal', 'atins',
  'chapada-dos-veadeiros', 'buenos-aires', 'havana', 'cancun', 'washington-dc',
  'new-york', 'estonia',
] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

export interface Place { label: string; cx: number; cy: number; next?: true; labelDx?: number; labelDy?: number }

// Coordinates are verbatim from the README (see map coordinate tests) and are never adjusted.
// labelDx/labelDy nudge the *label text* only, to keep close nodes' labels from overlapping —
// derived from the default offset (cx + 2.8, cy + 1) and the label font-size (see MapSvg.astro).
export const PLACES: Record<PlaceId, Place> = {
  rio: { label: 'rio de janeiro', cx: 41.4, cy: 83.7 },
  tiradentes: { label: 'tiradentes', cx: 40.7, cy: 82, labelDy: -1 },
  salvador: { label: 'salvador', cx: 38, cy: 75.4, labelDy: 1 },
  recife: { label: 'recife', cx: 45.2, cy: 74.3, labelDy: -1 },
  'joao-pessoa': { label: 'joão pessoa', cx: 48.1, cy: 69.6, labelDy: 1.6 },
  natal: { label: 'natal', cx: 48.1, cy: 68.7 },
  atins: { label: 'atins', cx: 47.8, cy: 67.4, labelDy: -1.6 },
  'chapada-dos-veadeiros': { label: 'chapada dos veadeiros', cx: 41.8, cy: 64.4 },
  'buenos-aires': { label: 'buenos aires', cx: 29.3, cy: 94.9 },
  havana: { label: 'havana', cx: 10.1, cy: 39.9, labelDy: -0.9 },
  cancun: { label: 'cancún', cx: 6.5, cy: 41.8, labelDy: 0.9 },
  'washington-dc': { label: 'washington dc', cx: 14.4, cy: 24.9, labelDy: 1 },
  'new-york': { label: 'new york', cx: 16.8, cy: 23.1, labelDy: -0.8 },
  estonia: { label: 'estônia', cx: 95.8, cy: 5.3, next: true },
};

export const ROOT: PlaceId = 'rio';

export const EDGES =
  'M41.4 83.7 L40.7 82 M41.4 83.7 L38 75.4 M41.4 83.7 L45.2 74.3 L48.1 69.6 L48.1 68.7 L47.8 67.4 L41.8 64.4 M41.4 83.7 L29.3 94.9 M41.4 83.7 L10.1 39.9 L6.5 41.8 M10.1 39.9 L14.4 24.9 L16.8 23.1';
export const EDGE_NEXT = 'M16.8 23.1 Q60 -6 95.8 5.3';
