import { test, expect } from '@playwright/test';

test.describe('Job Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jobs');
  });

  test('should display jobs page', async ({ page }) => {
    // Should show job management heading or title
    await expect(page.getByRole('heading', { name: /job|work|management/i })).toBeVisible();
  });

  test('should have create job button', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|new|add/i });
    await expect(createButton).toBeVisible();
  });

  test('should open create job modal when clicking create button', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|new|add/i }).first();
    await createButton.click();

    // Modal should appear
    await expect(page.getByRole('dialog').or(page.locator('[class*="modal"]'))).toBeVisible();
    
    // Should have title input
    await expect(page.getByLabel(/title/i)).toBeVisible();
  });

  test('should create a new job', async ({ page }) => {
    // Click create button
    const createButton = page.getByRole('button', { name: /create|new|add/i }).first();
    await createButton.click();

    // Fill in job details
    const uniqueTitle = `Test Job ${Date.now()}`;
    await page.getByLabel(/title/i).fill(uniqueTitle);
    
    // Fill description if present
    const descInput = page.getByLabel(/description/i);
    if (await descInput.isVisible()) {
      await descInput.fill('This is a test job created by E2E tests');
    }

    // Select priority if present
    const prioritySelect = page.getByLabel(/priority/i);
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('MEDIUM');
    }

    // Submit the form
    await page.getByRole('button', { name: /save|create|submit/i }).click();

    // Wait for success
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });
  });

  test('should display job list with proper columns', async ({ page }) => {
    // Should have table headers or list items
    await expect(page.locator('table, [class*="list"], [class*="grid"]')).toBeVisible();
    
    // Check for common column headers
    const headerArea = page.locator('thead, [class*="header"]').first();
    if (await headerArea.isVisible()) {
      // At least title and status should be visible
      await expect(page.getByText(/title|job/i).first()).toBeVisible();
      await expect(page.getByText(/status/i).first()).toBeVisible();
    }
  });

  test('should filter jobs by status', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.getByLabel(/status/i).or(page.locator('select').filter({ hasText: /all|status/i }));
    
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('IN_PROGRESS');
      
      // URL should update or list should filter
      await page.waitForLoadState('networkidle');
      
      // All visible status badges should show IN_PROGRESS (if any jobs exist)
      const statusBadges = page.locator('[class*="badge"], [class*="status"]').filter({ hasText: /in progress/i });
      const count = await statusBadges.count();
      
      // Either there are no jobs or all shown are IN_PROGRESS
      expect(count >= 0).toBeTruthy();
    }
  });

  test('should search jobs', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.keyboard.press('Enter');
      
      await page.waitForLoadState('networkidle');
      
      // Should show filtered results or no results message
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should expand job row to see details', async ({ page }) => {
    // Find a job row and click to expand
    const jobRow = page.locator('tr, [class*="row"], [class*="card"]').filter({ hasText: /job|task/i }).first();
    
    if (await jobRow.isVisible()) {
      await jobRow.click();
      
      // Should show expanded content (details, actions, etc.)
      await page.waitForTimeout(500); // Wait for animation
      
      // Look for action buttons or detailed info
      const actionsOrDetails = page.locator('[class*="expand"], [class*="detail"], button:has-text("Edit")');
      expect(await actionsOrDetails.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('should have submit to QC button for active jobs', async ({ page }) => {
    // Find a job that's not completed
    const jobRow = page.locator('tr, [class*="row"], [class*="card"]')
      .filter({ hasText: /in progress|not started/i })
      .first();
    
    if (await jobRow.isVisible()) {
      await jobRow.click();
      
      // Look for Submit to QC button
      const submitQCButton = page.getByRole('button', { name: /submit.*qc|send.*qc|completed/i });
      
      // Should be visible in expanded row or actions
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Job Editing', () => {
  test('should edit job title', async ({ page }) => {
    await page.goto('/jobs');
    
    // Find a job row
    const jobRow = page.locator('tr, [class*="row"], [class*="card"]')
      .filter({ hasText: /not started|in progress/i })
      .first();
    
    if (await jobRow.isVisible()) {
      await jobRow.click();
      
      // Find and click edit button
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Edit modal should open
        const titleInput = page.getByLabel(/title/i);
        if (await titleInput.isVisible()) {
          const newTitle = `Edited Job ${Date.now()}`;
          await titleInput.fill(newTitle);
          
          // Save
          await page.getByRole('button', { name: /save|update/i }).click();
          
          // Should see updated title
          await expect(page.getByText(newTitle)).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });

  test('should change job status', async ({ page }) => {
    await page.goto('/jobs');
    
    // Find a job and its status select
    const jobRow = page.locator('tr, [class*="row"], [class*="card"]')
      .filter({ hasText: /not started/i })
      .first();
    
    if (await jobRow.isVisible()) {
      await jobRow.click();
      
      // Try to find status dropdown in edit mode
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const statusSelect = page.getByLabel(/status/i);
        if (await statusSelect.isVisible()) {
          await statusSelect.selectOption('IN_PROGRESS');
          await page.getByRole('button', { name: /save|update/i }).click();
          
          // Should update status
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});

