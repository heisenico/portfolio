import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home pt renderiza com o h1 e o mapa', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('nicholas');
  await expect(page.locator('[data-map] [data-node]')).toHaveCount(14);
});

test('home en renderiza em inglês', async ({ page }) => {
  await page.goto('./en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('deep link de entrada funciona sob a base', async ({ page }) => {
  await page.goto('./diario/chegando-no-rio/');
  await expect(page.locator('article h2')).toContainText('chegando no rio');
});

test('filtro por lugar via query string', async ({ page }) => {
  await page.goto('./diario/?lugar=atins');
  await expect(page.locator('[data-place]:visible')).toHaveCount(1);
  await expect(page.locator('[data-chip]')).toBeVisible();
});

test('teclado alcança um nó do mapa e o botão de som', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab'); // skip link
  await expect(page.locator('.skip-link')).toBeFocused();
  const node = page.locator('[data-node="rio"]');
  await node.focus();
  await expect(node).toBeFocused();
  const sound = page.locator('#sound-toggle');
  await sound.focus();
  await expect(sound).toBeFocused();
  await expect(sound).toHaveAttribute('aria-label', /som/);
});

test('axe: home sem violações sérias', async ({ page }) => {
  await page.goto('./');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});

test('axe: diário sem violações sérias', async ({ page }) => {
  await page.goto('./diario/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});

test('filtro sobrevive à navegação suave do mapa', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-node="atins"]').click();
  await expect(page).toHaveURL(/\/diario\/\?lugar=atins/);
  await expect(page.locator('[data-place]:visible')).toHaveCount(1);
  await page.goBack();
  await page.locator('[data-node="rio"]').click();
  await expect(page).toHaveURL(/\/diario\/\?lugar=rio/);
  await expect(page.locator('[data-place]:visible')).toHaveCount(1);
  await expect(page.locator('[data-chip]')).toBeVisible();
});
