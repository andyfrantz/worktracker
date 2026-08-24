import { test, expect } from '@playwright/test';

test('loads the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WorkTrack' })).toBeVisible();
  await expect(page.getByText('Local-first workday companion')).toBeVisible();
});
