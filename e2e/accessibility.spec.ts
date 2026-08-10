import { expect, test } from '@playwright/test';
import { expectNoSeriousAccessibilityViolations, tabTo } from './accessibility.js';
import { E2E_ADMIN, E2E_CUSTOMER } from './test-credentials.js';

test('public homepage supports WCAG A/AA and keyboard skip navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'c2_analytics_consent',
      JSON.stringify({ analytics: false, timestamp: Date.now() }),
    );
  });
  await page.goto('/');
  await expectNoSeriousAccessibilityViolations(page);

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await tabTo(page, skipLink, 10);
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('customer login and dashboard support keyboard-only access and WCAG A/AA', async ({ page }) => {
  await page.goto('/login');
  await expectNoSeriousAccessibilityViolations(page);

  const form = page.locator('form');
  const email = form.getByLabel('Email address');
  const password = form.getByLabel('Password', { exact: true });
  const submit = form.getByRole('button', { name: 'Log In' });

  await tabTo(page, email);
  await page.keyboard.type(E2E_CUSTOMER.email);
  await tabTo(page, password);
  await page.keyboard.type(E2E_CUSTOMER.password);
  await tabTo(page, submit);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expectNoSeriousAccessibilityViolations(page);
});

test('administrator login and dashboard support keyboard-only access and WCAG A/AA', async ({ page }) => {
  await page.goto('/admin/login');
  await expectNoSeriousAccessibilityViolations(page);

  const form = page.locator('form');
  const email = form.getByLabel('Email Address');
  const password = form.locator('#admin-password');
  const submit = form.getByRole('button', { name: 'Access Admin Panel' });

  await tabTo(page, email);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(E2E_ADMIN.email);
  await tabTo(page, password);
  await page.keyboard.type(E2E_ADMIN.password);
  await tabTo(page, submit);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expectNoSeriousAccessibilityViolations(page);
});

test('customer and administrator recovery forms meet serious WCAG A/AA checks', async ({ page }) => {
  await page.goto('/forgot-password');
  await expectNoSeriousAccessibilityViolations(page);
  await page.goto('/admin/forgot-password');
  await expectNoSeriousAccessibilityViolations(page);
});
