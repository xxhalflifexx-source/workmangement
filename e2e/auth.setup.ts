import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication setup - runs once before all tests
 * Saves authentication state for reuse across tests
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be visible
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  // Fill in credentials (use test account)
  // In production, these should come from environment variables
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/password/i).fill(testPassword);

  // Submit the form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for successful navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 15000 });

  // Verify we're logged in
  await expect(page.getByText(/dashboard/i)).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

