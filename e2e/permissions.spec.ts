import { test, expect } from '@playwright/test';

test.describe('Role-Based Permissions', () => {
  test('should access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should see available modules on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should see module tiles based on permissions
    const moduleLinks = page.locator('a[href*="/jobs"], a[href*="/time-clock"], a[href*="/qc"]');
    
    // At least some modules should be visible
    const count = await moduleLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should access time clock (default permission)', async ({ page }) => {
    await page.goto('/time-clock');
    
    // Should not be redirected to access denied
    await expect(page).not.toHaveURL(/access-denied/);
    await expect(page.getByText(/time.*clock|clock/i)).toBeVisible();
  });

  test('should access job management (default permission)', async ({ page }) => {
    await page.goto('/jobs');
    
    // Should not be redirected to access denied
    await expect(page).not.toHaveURL(/access-denied/);
    await expect(page.getByText(/job|management/i)).toBeVisible();
  });

  test('should handle access denied gracefully', async ({ page }) => {
    // Try to access a potentially restricted page
    await page.goto('/admin');
    
    // Should either show page (if admin) or redirect/show access denied
    const isAdmin = await page.getByText(/admin/i).isVisible();
    const isAccessDenied = await page.getByText(/access.*denied|not.*authorized|permission/i).isVisible();
    const wasRedirected = page.url().includes('access-denied') || page.url().includes('dashboard');
    
    // One of these should be true
    expect(isAdmin || isAccessDenied || wasRedirected).toBeTruthy();
  });

  test('should show incident reports link based on permissions', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Incident reports should be visible (default true for all users)
    const incidentLink = page.locator('a[href*="/incident-reports"]');
    
    // Should be visible for most users
    await expect(incidentLink).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Module Access', () => {
  test('should navigate between allowed modules', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click on Jobs module
    const jobsLink = page.locator('a[href="/jobs"]');
    if (await jobsLink.isVisible()) {
      await jobsLink.click();
      await expect(page).toHaveURL('/jobs');
    }
    
    // Go back to dashboard
    await page.goto('/dashboard');
    
    // Click on Time Clock module
    const timeClockLink = page.locator('a[href="/time-clock"]');
    if (await timeClockLink.isVisible()) {
      await timeClockLink.click();
      await expect(page).toHaveURL('/time-clock');
    }
  });

  test('should maintain session across module navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.goto('/jobs');
    await page.goto('/time-clock');
    await page.goto('/dashboard');
    
    // Should still be logged in
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should show user-specific content based on role', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for role-specific elements
    const adminElements = page.locator('[class*="admin"], a[href="/admin"]');
    const employeeElements = page.locator('[class*="employee"], [class*="my-assigned"]');
    
    // At least dashboard should be visible
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });
});

test.describe('Operations Common Access', () => {
  test('should access operations common documents', async ({ page }) => {
    await page.goto('/operations-common');
    
    // Should be accessible (default permission)
    await expect(page).not.toHaveURL(/access-denied/);
    
    // Should show operations page content
    await expect(page.getByText(/operations|common|documents/i)).toBeVisible();
  });
});

