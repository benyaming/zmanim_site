import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const LAST_SEEN_KEY = 'zmanim:last-seen-version:v1';

test('the calendar export downloads an .ics file', async ({ page }) => {
  // Pre-mark the changelog as seen so the "What's new" popup can't cover the page.
  await page.addInitScript((key) => window.localStorage.setItem(key, '99.0'), LAST_SEEN_KEY);
  await page.goto('/');
  await expect(page.getByText('Hanetz ha-Chama')).toBeVisible();

  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: /Add to your calendar/ }).click();
  await expect(page.getByText(/\d+ events/)).toBeVisible();

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .ics' }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toMatch(/^zmanim-calendar-\d{4}-\d{2}\.ics$/);
  const text = await readFile((await download.path())!, 'utf8');
  expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(text).toContain('BEGIN:VEVENT');
  expect(text).toContain('SUMMARY:Candle lighting');
  expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
});
