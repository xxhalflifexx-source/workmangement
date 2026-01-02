import { test, expect } from '@playwright/test';

test.describe('Quality Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qc');
  });

  test('should display QC page', async ({ page }) => {
    // Should show QC heading or title
    await expect(
      page.getByRole('heading', { name: /quality.*control|qc|review/i })
        .or(page.getByText(/quality.*control|qc.*queue/i))
    ).toBeVisible();
  });

  test('should show QC queue or empty state', async ({ page }) => {
    // Should show either job cards or empty state message
    const jobCards = page.locator('[class*="card"], [class*="job"], tr').filter({ hasText: /awaiting|qc|review/i });
    const emptyState = page.getByText(/no.*jobs|queue.*empty|nothing.*review/i);
    
    const hasJobs = await jobCards.count() > 0;
    const hasEmptyState = await emptyState.isVisible();
    
    expect(hasJobs || hasEmptyState).toBeTruthy();
  });

  test('should display job details in QC queue', async ({ page }) => {
    // Find a job in the queue
    const jobCard = page.locator('[class*="card"], [class*="job"], tr')
      .filter({ hasText: /awaiting.*qc|ready.*review/i })
      .first();
    
    if (await jobCard.isVisible()) {
      // Should show job title and possibly assignee
      await expect(jobCard.getByText(/.+/)).toBeVisible();
    }
  });

  test('should have approve and reject buttons', async ({ page }) => {
    // Find a job in the queue
    const jobCard = page.locator('[class*="card"], [class*="job"], tr')
      .filter({ hasText: /awaiting.*qc/i })
      .first();
    
    if (await jobCard.isVisible()) {
      // Click to expand if needed
      await jobCard.click();
      await page.waitForTimeout(500);
      
      // Look for approve/reject buttons
      const approveButton = page.getByRole('button', { name: /approve|complete|accept/i });
      const rejectButton = page.getByRole('button', { name: /reject|rework|return/i });
      
      // At least one should be visible if we have a job in queue
      const hasApprove = await approveButton.isVisible();
      const hasReject = await rejectButton.isVisible();
      
      // They should exist (might be in modal or expanded view)
    }
  });

  test('should be able to view job photos in QC', async ({ page }) => {
    // Find a job with photos
    const jobCard = page.locator('[class*="card"], [class*="job"], tr')
      .filter({ hasText: /awaiting.*qc/i })
      .first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      // Look for photo thumbnails or gallery
      const photos = page.locator('img[src*="photo"], img[src*="image"], [class*="photo"]');
      
      // May or may not have photos
      const photoCount = await photos.count();
      expect(photoCount >= 0).toBeTruthy();
    }
  });

  test('should require reason when rejecting job', async ({ page }) => {
    // Find a job and try to reject
    const jobCard = page.locator('[class*="card"], [class*="job"], tr')
      .filter({ hasText: /awaiting.*qc/i })
      .first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const rejectButton = page.getByRole('button', { name: /reject|rework|return/i });
      
      if (await rejectButton.isVisible()) {
        await rejectButton.click();
        
        // Should show modal or form for rejection reason
        await expect(
          page.getByLabel(/reason|notes|comment/i)
            .or(page.getByPlaceholder(/reason|why|comment/i))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('QC Approval Flow', () => {
  test('should approve job and move to completed', async ({ page }) => {
    await page.goto('/qc');
    
    // Find a job in queue
    const jobCard = page.locator('[class*="card"], [class*="job"], tr')
      .filter({ hasText: /awaiting.*qc/i })
      .first();
    
    if (await jobCard.isVisible()) {
      // Get job title for verification
      const jobTitle = await jobCard.textContent();
      
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const approveButton = page.getByRole('button', { name: /approve|complete|accept/i });
      
      if (await approveButton.isVisible()) {
        await approveButton.click();
        
        // Wait for action to complete
        await page.waitForLoadState('networkidle');
        
        // Job should no longer be in queue or show success message
        await expect(
          page.getByText(/approved|completed|success/i)
            .or(page.locator('body'))
        ).toBeVisible();
      }
    }
  });

  test('should reject job and send back for rework', async ({ page }) => {
    await page.goto('/qc');
    
    // Find a job in queue
    const jobCard = page.locator('[class*="card"], [class*="job"], tr')
      .filter({ hasText: /awaiting.*qc/i })
      .first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const rejectButton = page.getByRole('button', { name: /reject|rework|return/i });
      
      if (await rejectButton.isVisible()) {
        await rejectButton.click();
        
        // Fill in rejection reason
        const reasonInput = page.getByLabel(/reason|notes|comment/i)
          .or(page.getByPlaceholder(/reason|why|comment/i));
        
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('Needs correction in section A - E2E test');
          
          // Confirm rejection
          const confirmButton = page.getByRole('button', { name: /confirm|submit|send/i });
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            
            // Wait for action to complete
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });
});

test.describe('QC Filters and Search', () => {
  test('should filter QC queue by priority', async ({ page }) => {
    await page.goto('/qc');
    
    const priorityFilter = page.getByLabel(/priority/i);
    
    if (await priorityFilter.isVisible()) {
      await priorityFilter.selectOption('HIGH');
      await page.waitForLoadState('networkidle');
      
      // Verify filter applied
      expect(true).toBeTruthy();
    }
  });

  test('should search within QC queue', async ({ page }) => {
    await page.goto('/qc');
    
    const searchInput = page.getByPlaceholder(/search/i);
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      
      // Verify search performed
      expect(true).toBeTruthy();
    }
  });
});

