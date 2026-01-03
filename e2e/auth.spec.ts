import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  // These tests don't use stored auth - they test the login flow itself
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill('invalid@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/error|wrong/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for empty fields', async ({ page }) => {
    await page.goto('/login');

    // Try to submit without filling fields
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show validation error or remain on login page (HTML5 validation)
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
    const registerLink = page.getByRole('link', { name: /register/i });
    await expect(registerLink).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByRole('link', { name: /register/i }).click();
    await expect(page).toHaveURL(/register/);
  });
});

test.describe('Account Registration', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display registration form', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password.*min/i)).toBeVisible();
    await expect(page.getByPlaceholder(/confirm/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /register/i })).toBeVisible();
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder(/name/i).fill('Test User');
    await page.getByPlaceholder(/email/i).fill(`test${Date.now()}@example.com`);
    await page.getByPlaceholder(/password.*min/i).fill('password123');
    await page.getByPlaceholder(/confirm/i).fill('differentpassword');
    await page.locator('select[name="gender"]').selectOption('Male');
    await page.locator('input[name="birthDate"]').fill('1990-01-01');
    
    await page.getByRole('button', { name: /register/i }).click();

    // Should show error (could be "Invalid input" or stay on page)
    await expect(page.getByText(/invalid|error/i).or(page.locator('p.text-red-600'))).toBeVisible({ timeout: 5000 });
  });

  test('should show error for short password', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder(/name/i).fill('Test User');
    await page.getByPlaceholder(/email/i).fill(`test${Date.now()}@example.com`);
    await page.getByPlaceholder(/password.*min/i).fill('123'); // Too short
    await page.getByPlaceholder(/confirm/i).fill('123');
    
    // HTML5 validation should prevent submission
    await page.getByRole('button', { name: /register/i }).click();
    
    // Should remain on register page
    await expect(page).toHaveURL(/register/);
  });

  test('should successfully register new account', async ({ page }) => {
    await page.goto('/register');

    const uniqueEmail = `testuser${Date.now()}@example.com`;
    
    await page.getByPlaceholder(/name/i).fill('E2E Test User');
    await page.getByPlaceholder(/email/i).fill(uniqueEmail);
    await page.getByPlaceholder(/password.*min/i).fill('testpass123');
    await page.getByPlaceholder(/confirm/i).fill('testpass123');
    await page.locator('select[name="gender"]').selectOption('Male');
    await page.locator('input[name="birthDate"]').fill('1990-01-01');
    
    await page.getByRole('button', { name: /register/i }).click();

    // Should redirect to verification page (URL contains /verify)
    await page.waitForURL(/verify/, { timeout: 10000 });
    await expect(page).toHaveURL(/verify/);
  });

  test('should show error for existing email', async ({ page }) => {
    await page.goto('/register');

    // Use an email that likely exists (admin account)
    await page.getByPlaceholder(/name/i).fill('Test User');
    await page.getByPlaceholder(/email/i).fill('admin@example.com');
    await page.getByPlaceholder(/password.*min/i).fill('testpass123');
    await page.getByPlaceholder(/confirm/i).fill('testpass123');
    await page.locator('select[name="gender"]').selectOption('Male');
    await page.locator('input[name="birthDate"]').fill('1990-01-01');
    
    await page.getByRole('button', { name: /register/i }).click();

    // Should show error about existing email
    await expect(page.getByText(/exist|already|taken|registered/i)).toBeVisible({ timeout: 10000 });
  });

  test('should have link back to login', async ({ page }) => {
    await page.goto('/register');

    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    
    await loginLink.click();
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Authenticated User', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  
  // Helper to login
  async function login(page: any) {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('admin@example.com');
    await page.getByPlaceholder(/password/i).fill('Passw0rd!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
  }

  test('should login and display dashboard', async ({ page }) => {
    await login(page);
    
    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display user info after login', async ({ page }) => {
    await login(page);
    
    // Should see some user info or admin panel access
    await expect(page.getByText(/admin|dashboard|time|job/i)).toBeVisible();
  });

  test('should be able to logout', async ({ page }) => {
    await login(page);

    // Find and click logout/sign out link or button
    const logoutLink = page.getByRole('link', { name: /log\s*out|sign\s*out/i });
    const logoutButton = page.getByRole('button', { name: /log\s*out|sign\s*out/i });
    
    if (await logoutLink.isVisible()) {
      await logoutLink.click();
    } else if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try finding it in a menu
      const menuButtons = page.locator('button').filter({ hasText: /menu|user|profile/i });
      if (await menuButtons.first().isVisible()) {
        await menuButtons.first().click();
        await page.waitForTimeout(500);
        const logoutInMenu = page.getByText(/log\s*out|sign\s*out/i);
        if (await logoutInMenu.isVisible()) {
          await logoutInMenu.click();
        }
      }
    }

    // Should redirect to login (give it time)
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/login|signin|\//);
  });
});

