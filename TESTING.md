# Testing Guide

This document describes the automated testing system for the Work Management application.

## Overview

The testing suite includes:
- **Unit Tests** (Jest) - Test individual functions and components
- **Integration Tests** (Jest) - Test server actions and database operations
- **E2E Tests** (Playwright) - Test complete user flows in real browsers
- **Load Tests** (k6) - Test system performance under various loads

## Quick Start

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI (interactive mode)
npm run test:e2e:ui

# Run all tests
npm run test:all
```

## Test Structure

```
__tests__/
  unit/
    lib/
      permissions.test.ts    # Permission utilities
      receipt-ocr.test.ts    # OCR extraction logic
    actions/
      jobs.test.ts          # Job server actions
      time-clock.test.ts    # Time clock actions
  integration/
    qc-workflow.test.ts     # QC workflow integration

e2e/
  auth.setup.ts             # Authentication setup
  auth.spec.ts              # Login/logout tests
  jobs.spec.ts              # Job management tests
  time-clock.spec.ts        # Time clock tests
  qc.spec.ts                # Quality control tests
  permissions.spec.ts       # Role-based access tests

k6/
  config.js                 # Shared configuration
  smoke-test.js             # Quick sanity check
  load-test.js              # Normal traffic simulation
  stress-test.js            # High load simulation
  spike-test.js             # Sudden traffic surge
  soak-test.js              # Extended duration test
```

## Unit & Integration Tests

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- permissions.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should create job"

# Run with verbose output
npm test -- --verbose
```

### Writing Tests

```typescript
// Example unit test
import { hasPermission } from '@/lib/permissions';

describe('hasPermission', () => {
  it('should return true for allowed modules', () => {
    const permissions = { timeClock: true };
    expect(hasPermission(permissions, 'timeClock')).toBe(true);
  });
});
```

## E2E Tests (Playwright)

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run specific test file
npx playwright test auth.spec.ts

# Run in specific browser
npx playwright test --project=chromium

# Interactive UI mode
npm run test:e2e:ui

# Debug mode
npx playwright test --debug
```

### Browser Configuration

Tests run on:
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit/Safari (Desktop)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('should create a new job', async ({ page }) => {
  await page.goto('/jobs');
  
  await page.getByRole('button', { name: /create/i }).click();
  await page.getByLabel(/title/i).fill('New Job');
  await page.getByRole('button', { name: /save/i }).click();
  
  await expect(page.getByText('New Job')).toBeVisible();
});
```

## Load Testing (k6)

### Prerequisites

Install k6 from https://k6.io/docs/getting-started/installation/

### Running Load Tests

```bash
# Smoke test (quick sanity check)
npm run test:load

# Or run specific tests:
k6 run k6/smoke-test.js      # 1 VU, 30s
k6 run k6/load-test.js       # 50 VUs, 12 min
k6 run k6/stress-test.js     # 200 VUs, 17 min
k6 run k6/spike-test.js      # 200 VU spike, 5 min
k6 run k6/soak-test.js       # 30 VUs, 1+ hour

# With custom base URL
BASE_URL=https://your-app.com k6 run k6/load-test.js
```

### Test Types

| Test | Purpose | VUs | Duration |
|------|---------|-----|----------|
| Smoke | Basic sanity check | 1 | 30s |
| Load | Normal traffic | 50 | 12 min |
| Stress | Peak traffic | 200 | 17 min |
| Spike | Sudden surge | 10→200→10 | 5 min |
| Soak | Long-running stability | 30 | 1+ hour |

### Performance Thresholds

- 95th percentile response time < 500ms
- 99th percentile response time < 1000ms
- Error rate < 1% (normal), < 5% (load), < 10% (stress)

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request

### GitHub Actions

The workflow includes:
1. **Unit Tests** - Jest with coverage
2. **E2E Tests** - Playwright across browsers
3. **Lint** - ESLint and TypeScript checks
4. **Build** - Verify production build
5. **Load Tests** - Manual trigger only

### Required Secrets

For CI, configure these GitHub secrets:
- `DATABASE_URL` - Database connection string
- `NEXTAUTH_SECRET` - NextAuth secret key
- `TEST_USER_EMAIL` - Test account email
- `TEST_USER_PASSWORD` - Test account password
- `PRODUCTION_URL` - (Optional) Production URL for load tests

## Coverage Reports

After running tests with coverage:

```bash
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format

## Debugging Tests

### Jest

```bash
# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose
```

### Playwright

```bash
# Debug mode (step through tests)
npx playwright test --debug

# Trace viewer (after test failure)
npx playwright show-trace test-results/*/trace.zip

# Generate trace for all tests
npx playwright test --trace on
```

## Best Practices

1. **Keep tests isolated** - Each test should be independent
2. **Use meaningful names** - Describe what the test verifies
3. **Mock external services** - Don't rely on external APIs
4. **Clean up after tests** - Reset state when needed
5. **Run tests locally** - Before pushing to CI
6. **Monitor flaky tests** - Fix or quarantine unreliable tests

## Troubleshooting

### Tests timing out
- Increase timeout in test configuration
- Check for network issues or slow database

### E2E tests failing
- Ensure app is running locally
- Check for authentication issues
- Review screenshots in `test-results/`

### Load tests failing
- Verify target URL is accessible
- Check k6 is installed correctly
- Review error messages in output

