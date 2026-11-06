// End-to-end smoke test of the main desktop workflow: Import -> Data ->
// Working Set (inline edit + bulk edit) -> Export. Uses a tiny synthetic
// EUREKA-format fixture committed alongside this test (no real lab data).

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '..', 'fixtures', 'synthetic', 'eureka_e2e.csv');

async function cellByHeader(page, headerText, rowIndex = 0) {
  const header = page.locator('.hb-panel.is-active th', { hasText: headerText }).first();
  const index = await header.evaluate((el) => Array.from(el.parentElement.children).indexOf(el));
  const row = page.locator('.hb-panel.is-active tbody tr').nth(rowIndex);
  return row.locator('td').nth(index);
}

async function cellInputByHeader(page, headerText, rowIndex = 0) {
  return (await cellByHeader(page, headerText, rowIndex)).locator('input');
}

test('full workflow: import -> data -> working set edits -> export download', async ({ page }) => {
  await page.goto('/');

  // --- Import ---
  await expect(page.getByRole('tab', { name: /Import/ })).toHaveAttribute('aria-selected', 'true');
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.locator('.hb-import-card')).toBeVisible();
  await expect(page.locator('.hb-import-card')).toContainText('EUREKA');

  await page.getByText('Převést na mS/m (÷10)').click();
  await page.getByText('Korigovat záporné hodnoty na 0 m').click();

  const loadBtn = page.getByRole('button', { name: 'Načíst data' });
  await expect(loadBtn).toBeEnabled();
  await loadBtn.click();

  // --- Data tab (auto-switched) ---
  await expect(page.getByRole('tab', { name: /Data/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.hb-panel.is-active tbody tr')).toHaveCount(2);

  await page.locator('.hb-panel.is-active thead input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Přidat vybrané do pracovní sady' }).click();

  // --- Working set tab ---
  await page.getByRole('tab', { name: /Pracovní sada/ }).click();
  await expect(page.locator('.hb-panel.is-active tbody tr')).toHaveCount(2);

  // Mode A: sample number (VZOREK) is always directly editable.
  const vzorek0 = await cellInputByHeader(page, 'Vzorek', 0);
  await vzorek0.fill('E2E-001');
  await vzorek0.blur();
  const vzorek1 = await cellInputByHeader(page, 'Vzorek', 1);
  await vzorek1.fill('E2E-002');
  await vzorek1.blur();
  await expect(await cellInputByHeader(page, 'Vzorek', 0)).toHaveValue('E2E-001');

  // Mode A: supplementary transparency is directly editable without any mode toggle.
  const transparency0 = await cellInputByHeader(page, 'Průhlednost', 0);
  await transparency0.fill('1.5');
  await transparency0.blur();
  await expect(await cellInputByHeader(page, 'Průhlednost', 0)).toHaveValue('1.5');

  // Mode C: bulk edit a normally-locked measured value (pH).
  await page.locator('.hb-panel.is-active tbody tr').nth(0).locator('td').first().locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Hromadná editace' }).click();
  await expect(page.locator('.hb-banner--editing')).toBeVisible();

  const ph0 = await cellInputByHeader(page, 'pH (pH)', 0);
  await ph0.fill('6.99');
  await ph0.blur();

  await page.getByRole('button', { name: 'Uložit / Zahodit / Pokračovat' }).click();
  await page.getByRole('button', { name: 'Uložit změny' }).click();
  await expect(page.locator('.hb-banner--editing')).toHaveCount(0);
  // Outside an active bulk session the measured value is read-only again — plain text, not an input.
  await expect(await cellByHeader(page, 'pH (pH)', 0)).toHaveText('6.99');

  // --- Export tab ---
  await page.getByRole('tab', { name: /Export/ }).click();
  await expect(page.getByText(/profil LabSystem ČB/)).toBeVisible();
  await page.locator('.hb-ack-box input[type="checkbox"]').check();

  const downloadBtn = page.getByRole('button', { name: /Stáhnout XLSX/ });
  await expect(downloadBtn).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), downloadBtn.click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});

test('AT-25: switching tabs during an active bulk edit prompts save/discard/continue', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByText('Ponechat původní jednotku (µS/cm)').click();
  await page.getByText('Ponechat původní hodnoty').first().click();
  await page.getByRole('button', { name: 'Načíst data' }).click();

  await page.locator('.hb-panel.is-active thead input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Přidat vybrané do pracovní sady' }).click();

  await page.getByRole('tab', { name: /Pracovní sada/ }).click();
  await page.locator('.hb-panel.is-active tbody tr').nth(0).locator('td').first().locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Hromadná editace' }).click();
  await expect(page.locator('.hb-banner--editing')).toBeVisible();

  await page.getByRole('tab', { name: /Export/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Pokračovat v editaci' }).click();

  // Navigation was blocked — we're still on the Working Set tab with the banner intact.
  await expect(page.getByRole('tab', { name: /Pracovní sada/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.hb-banner--editing')).toBeVisible();
});
