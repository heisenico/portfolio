import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './wcag';

const tokens = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const m = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} não encontrado`);
  return m[1]!;
};

describe('contraste no papel', () => {
  it('texto azul de corpo (--lb-700) tem 4.5:1 sobre o fundo', () => {
    expect(contrastRatio(token('--lb-700'), token('--color-bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('texto principal tem 4.5:1 sobre o fundo', () => {
    expect(contrastRatio(token('--color-text'), token('--color-bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('tons claros do ramp NÃO passam para texto de corpo (--lb-400)', () => {
    expect(contrastRatio(token('--lb-400'), token('--color-bg'))).toBeLessThan(4.5);
  });
});
