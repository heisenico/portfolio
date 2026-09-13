import { en } from './en';
import { pt } from './pt';
import { LOCALES, type Locale, type UIStrings } from './types';

export { LOCALES };
export type { Locale, UIStrings };

const dictionaries: Partial<Record<Locale, UIStrings>> = { pt, en };

export function getStrings(locale: Locale): UIStrings {
  return dictionaries[locale] ?? dictionaries.en ?? pt;
}

export function isTranslated(locale: Locale): boolean {
  return locale in dictionaries;
}

export function localeUrl(locale: Locale, path: string, base: string = (import.meta as any).env?.BASE_URL ?? '/'): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  return `${cleanBase}${prefix}${path}`;
}

const MONTHS: Record<Locale, string[]> = {
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

export function formatDayMonth(date: Date, locale: Locale): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[locale][date.getUTCMonth()]}`;
}

export function formatEntryDate(date: Date, locale: Locale): string {
  return `${formatDayMonth(date, locale)} ${date.getUTCFullYear()}`;
}

export function htmlLang(locale: Locale): string {
  return { pt: 'pt-BR', en: 'en', fr: 'fr', es: 'es', zh: 'zh-Hans', ja: 'ja' }[locale];
}
