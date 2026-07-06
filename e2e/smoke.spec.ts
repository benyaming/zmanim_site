import { expect, test, type Page } from '@playwright/test';

import { RELEASES } from '../src/lib/releases';

const LAST_SEEN_KEY = 'zmanim:last-seen-version:v1';

/** Pre-mark the changelog as seen so the one-time "What's new" popup can't cover the page. */
async function markChangelogSeen(page: Page) {
  await page.addInitScript((key) => window.localStorage.setItem(key, '99.0'), LAST_SEEN_KEY);
}

test('home renders the calendar and zmanim panel', async ({ page }) => {
  await markChangelogSeen(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Zmanim/);
  await expect(page.getByText('Hanetz ha-Chama')).toBeVisible();
  // .first(): once the swipe pager's side months mount (on browser idle), each
  // of the three panels has its own weekday header row.
  await expect(page.getByText('Sun', { exact: true }).first()).toBeVisible();
});

test('hebrew locale renders right-to-left', async ({ page }) => {
  await markChangelogSeen(page);
  await page.goto('/he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('city page is server-rendered with its zmanim', async ({ page }) => {
  await markChangelogSeen(page);
  await page.goto('/zmanim/brooklyn');
  await expect(page.getByRole('heading', { name: /Zmanim for Brooklyn/ })).toBeVisible();
  await expect(page.getByText('Hanetz ha-Chama')).toBeVisible();
});

test('the Hebrew/Civil calendar toggle works', async ({ page }) => {
  await markChangelogSeen(page);
  await page.goto('/');
  // Radix ToggleGroup (single) items expose the radio role.
  const hebrewToggle = page.getByRole('radio', { name: 'Hebrew' });
  await hebrewToggle.click();
  await expect(hebrewToggle).toBeChecked();
});

test.describe('"What\'s new" popup', () => {
  test('first visit shows the full changelog, and only once', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: "What's new" });
    await expect(dialog).toBeVisible();
    // No last-seen version → the whole history, down to the first release.
    await expect(dialog.getByText('v1.0', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Got it' }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByText('Hanetz ha-Chama')).toBeVisible();
    await expect(page.getByRole('dialog', { name: "What's new" })).toBeHidden();
  });

  test('after an update, only unseen releases are listed', async ({ page }) => {
    const [latest, previous] = RELEASES;
    await page.addInitScript(
      ([key, version]) => window.localStorage.setItem(key, version),
      [LAST_SEEN_KEY, previous.version] as const,
    );
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: "What's new" });
    await expect(dialog.getByText(`v${latest.version}`, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`v${previous.version}`, { exact: true })).toBeHidden();
  });
});
