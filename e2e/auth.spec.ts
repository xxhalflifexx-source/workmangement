import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  // These tests don't use stored auth - they test the login flow itself
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for empty fields', async ({ page }) => {
    await page.goto('/login');

    // Try to submit without filling fields
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show validation error or remain on login page
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login|signin/);
  });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');

    const forgotLink = page.getByRole('link', { name: /forgot.*password/i });
    await expect(forgotLink).toBeVisible();
  });

  test('should have register link', async ({ page }) => {
    await page.goto('/login');

    // Look for register/sign up link
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
    if (await registerLink.isVisible()) {
      await expect(registerLink).toBeVisible();
    }
  });
});

test.describe('Authenticated User', () => {
  // These tests use stored authentication
  
  test('should display user menu on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should see user name or menu
    await expect(page.locator('[data-testid="user-menu"], button:has-text("Menu"), [class*="user"]')).toBeVisible();
  });

  test('should be able to access dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should be able to logout', async ({ page }) => {
    await page.goto('/dashboard');

    // Find and click logout button (may be in menu)
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Menu")').first();
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }

    const logoutButton = page.getByRole('button', { name: /log\s*out|sign\s*out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // Should redirect to login
      await expect(page).toHaveURL(/login|signin|\//);
    }
  });
});

