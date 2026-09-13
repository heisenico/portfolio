import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';
import type { PlaceId } from '../map/places';
import { PLACE_IDS } from '../map/places';

export interface DiaryEntry {
  entry: CollectionEntry<'diario'>;
  locale: Locale;      // locale the content is written in
  slug: string;        // without locale prefix
  fromPt: boolean;     // true when shown on a non-pt list as untranslated
}

function split(e: CollectionEntry<'diario'>): { locale: Locale; slug: string } {
  const [locale, ...rest] = e.id.split('/');
  return { locale: locale as Locale, slug: rest.join('/').replace(/\.md$/, '') };
}

export async function listEntries(displayLocale: Locale): Promise<DiaryEntry[]> {
  const all = (await getCollection('diario')).map((entry) => ({ entry, ...split(entry) }));
  const inLocale = all.filter((e) => e.locale === displayLocale);
  const slugsInLocale = new Set(inLocale.map((e) => e.slug));
  const ptGapFill =
    displayLocale === 'pt' ? [] : all.filter((e) => e.locale === 'pt' && !slugsInLocale.has(e.slug));
  return [...inLocale.map((e) => ({ ...e, fromPt: false })), ...ptGapFill.map((e) => ({ ...e, fromPt: true }))]
    .sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime());
}

export async function latestEntry(locale: Locale): Promise<DiaryEntry | undefined> {
  return (await listEntries(locale))[0];
}

export async function countByPlace(): Promise<Record<PlaceId, number>> {
  const pt = (await getCollection('diario')).map((e) => ({ e, ...split(e) })).filter((x) => x.locale === 'pt');
  const counts = Object.fromEntries(PLACE_IDS.map((id) => [id, 0])) as Record<PlaceId, number>;
  for (const { e } of pt) counts[e.data.place] += 1;
  return counts;
}

export { render };
