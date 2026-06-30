import { expect, test } from '@playwright/test';

test('home renders the calendar and zmanim panel', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Zmanim/);
  await expect(page.getByText('Sunrise (HaNetz)')).toBeVisible();
  await expect(page.getByText('Sun', { exact: true })).toBeVisible();
});

test('hebrew locale renders right-to-left', async ({ page }) => {
  await page.goto('/he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('city page is server-rendered with its zmanim', async ({ page }) => {
  await page.goto('/zmanim/brooklyn');
  await expect(page.getByRole('heading', { name: /Zmanim for Brooklyn/ })).toBeVisible();
  await expect(page.getByText('Sunrise (HaNetz)')).toBeVisible();
});

test('the Hebrew/Civil calendar toggle works', async ({ page }) => {
  await page.goto('/');
  // Radix ToggleGroup (single) items expose the radio role.
  const hebrewToggle = page.getByRole('radio', { name: 'Hebrew' });
  await hebrewToggle.click();
  await expect(hebrewToggle).toBeChecked();
});
