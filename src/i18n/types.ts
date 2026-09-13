export const LOCALES = ['pt', 'en', 'fr', 'es', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export interface UIStrings {
  brand: string;
  skipLink: string;
  navHome: string;
  navDiario: string;
  soundPlaying: string;   // aria-label
  soundPaused: string;    // aria-label
  h1Lines: [string, string];
  bio: [string, string, string];
  mapKicker: string;
  mapCountLine: (places: number) => string;
  mapCaptionMobile: string;
  mapCaptionDesktopA: string;
  mapCaptionDesktopB: string;
  nodeAriaLabel: (place: string, count: number) => string;
  conviteKicker: string;
  conviteIntro: string;
  links: { label: string; href: string; note: string }[];
  diarioCta: string;
  diarioLast: (dayMonth: string) => string;
  footerExperiment: string;   // contains {github} marker replaced with the link
  footerSound: string;
  diarioKicker: string;
  diarioH1: string;
  diarioIntro: string;        // contains {youtube} marker
  inPortuguese: string;       // "em português" tag
  filterShowing: (place: string) => string;
  filterClear: string;
  seeOnMap: string;
  notTranslated: string;      // note atop fallback-rendered pages
}
