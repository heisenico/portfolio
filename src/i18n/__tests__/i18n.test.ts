import { describe, expect, it } from 'vitest';
import { LOCALES, formatDayMonth, formatEntryDate, getStrings, htmlLang, localeUrl } from '../index';

describe('fallback de strings', () => {
  it('pt devolve o pt verbatim', () => {
    expect(getStrings('pt').brand).toBe('nicholas ferrer');
    expect(getStrings('pt').bio[0]).toMatch(/^eu moro no rio de janeiro\./);
  });
  it('fr cai para o inglês (não para pt)', () => {
    expect(getStrings('fr')).toEqual(getStrings('en'));
  });
  it('todas as seis locales resolvem sem lançar', () => {
    for (const l of LOCALES) expect(getStrings(l).brand).toBe('nicholas ferrer');
  });
});

describe('localeUrl', () => {
  it('pt fica sem prefixo, sob a base', () => {
    expect(localeUrl('pt', '/diario/', '/portfolio/')).toBe('/portfolio/diario/');
  });
  it('en ganha prefixo', () => {
    expect(localeUrl('en', '/diario/', '/portfolio/')).toBe('/portfolio/en/diario/');
  });
  it('raiz pt é a base', () => {
    expect(localeUrl('pt', '/', '/portfolio/')).toBe('/portfolio/');
  });
});

describe('datas', () => {
  const d = new Date('2026-09-04T12:00:00Z');
  it('curta pt', () => expect(formatDayMonth(d, 'pt')).toBe('04 set'));
  it('longa pt', () => expect(formatEntryDate(d, 'pt')).toBe('04 set 2026'));
  it('curta en', () => expect(formatDayMonth(d, 'en')).toBe('04 sep'));
});

describe('htmlLang', () => {
  it('pt-BR e zh-Hans', () => {
    expect(htmlLang('pt')).toBe('pt-BR');
    expect(htmlLang('zh')).toBe('zh-Hans');
  });
});
