import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('primary finance flows, local persistence, validation, and keyboard dialogs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const failedAssets: string[] = [];
  page.on('response', response => { if (response.status() >= 400) failedAssets.push(response.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Current Balance' })).toContainText('$4,836.00');
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Groceries');
  await expect(page.locator('tbody tr').first()).toContainText('Groceries');
  await page.getByRole('searchbox', { name: 'Search transactions' }).fill('no such name');
  await expect(page.getByText('No transactions match your search.', { exact: false })).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('All Transactions');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('Highest');
  await expect(page.locator('tbody tr').first()).toContainText('$3,358.00');

  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  await page.getByRole('button', { name: '+ Add New Budget' }).click();
  await page.getByRole('button', { name: 'Add Budget', exact: true }).click();
  await expect(page.getByText('Enter an amount greater than $0.00.')).toBeVisible();
  await page.getByLabel('Budget Category').selectOption('Groceries');
  await page.getByLabel('Maximum Spend').fill('200');
  await page.getByRole('button', { name: 'Add Budget', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Groceries budget created.');
  const groceryCard = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Groceries', exact: true }) });
  await expect(groceryCard.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '200');
  await groceryCard.getByRole('link', { name: 'See All: Latest Spending' }).click();
  await expect(page.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('Groceries');
  await page.goBack();
  await page.getByLabel('Actions for Groceries').click();
  await page.getByRole('button', { name: 'Edit Groceries' }).click();
  await page.getByLabel('Maximum Spend').fill('250');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByLabel('Actions for Groceries').click();
  await page.getByRole('button', { name: 'Delete Groceries' }).click();
  await page.getByRole('button', { name: 'Yes, Confirm Deletion' }).click();
  await expect(page.getByRole('heading', { name: 'Groceries', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Pots', exact: true }).click();
  const addButton = page.getByRole('button', { name: 'Add money to Savings', exact: true });
  await addButton.click();
  await page.getByLabel('Amount to Add').fill('5000');
  await page.getByRole('button', { name: 'Confirm Addition' }).click();
  await expect(page.getByText('You can add up to $4,836.00 from your balance.')).toBeVisible();
  await page.getByLabel('Amount to Add').fill('100.25');
  await page.getByRole('button', { name: 'Confirm Addition' }).click();
  await expect(page.getByRole('status')).toContainText('$100.25 added to Savings.');
  await page.reload();
  const savings = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Savings', exact: true }) });
  await expect(savings).toContainText('$259.25');
  await page.getByRole('button', { name: 'Withdraw money from Savings', exact: true }).click();
  await page.getByLabel('Amount to Withdraw').fill('100.25');
  await page.getByRole('button', { name: 'Confirm Withdrawal' }).click();
  await expect(savings).toContainText('$159.00');

  await page.getByRole('button', { name: '+ Add New Pot' }).click();
  await page.getByLabel('Pot Name').fill('Rainy Days');
  await page.getByLabel('Target', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Add Pot', exact: true }).click();
  await page.getByLabel('Actions for Rainy Days').click();
  await page.getByRole('button', { name: 'Edit Rainy Days' }).click();
  await page.getByLabel('Target', { exact: true }).fill('600');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByRole('button', { name: 'Add money to Rainy Days', exact: true }).click();
  await page.getByLabel('Amount to Add').fill('20');
  await page.getByRole('button', { name: 'Confirm Addition' }).click();
  await page.getByLabel('Actions for Rainy Days').click();
  await page.getByRole('button', { name: 'Delete Rainy Days' }).click();
  await page.getByRole('button', { name: 'Yes, Confirm Deletion' }).click();
  await expect(page.getByRole('heading', { name: 'Rainy Days', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current Balance' })).toContainText('$4,836.00');

  await page.getByRole('link', { name: 'Recurring Bills', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await expect(page.getByText('2 ($59.98)')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search bills' }).fill('byte');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('Highest');
  await expect(page.locator('tbody tr').first()).toContainText('$100.00');

  await page.getByRole('link', { name: 'Pots', exact: true }).click();
  await addButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Amount to Add')).toBeFocused();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(addButton).toBeFocused();
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

for (const width of [1440, 900, 768, 375, 320]) {
  test(`responsive screenshots and overflow checks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 640 ? 812 : 1024 });
    for (const path of ['/', '/transactions', '/budgets', '/pots', '/recurring-bills']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px must not overflow`).toBe(true);
      expect(await page.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: `tests/screenshots/${width}-${path === '/' ? 'overview' : path.slice(1)}.png`, fullPage: true });
    }
  });
}

for (const width of [1440, 375]) {
  for (const path of ['/', '/transactions', '/budgets', '/pots', '/recurring-bills']) {
    test(`accessibility at ${width}px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), `${path} at ${width}px`).toEqual([]);
    });
  }
  test(`budget modal accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/budgets');
    await page.getByRole('button', { name: '+ Add New Budget' }).click();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
  });
}
