# Visual Regression Testing Guide

This document describes the visual regression testing strategy for the Amana frontend application using Playwright.

## Overview

Visual regression tests capture snapshots of key UI components and pages, then compare future renders against these baselines. This prevents unintended visual changes from making it into production.

## Technology Stack

- **Framework**: Playwright Test
- **Snapshot Format**: PNG images
- **Test Location**: `frontend/tests/visual/`
- **Configuration**: `frontend/playwright.config.ts`

## Key Pages and Components Tested

The visual tests cover the critical user journeys and pages:

### 1. **Landing Page** (`landing.spec.ts`)
- Homepage hero section
- Navigation layout and responsiveness
- Call-to-action buttons and positioning

### 2. **Login Page** (`login.spec.ts`)
- Login form layout
- Input field styling
- Error state display
- Responsive mobile layout

### 3. **Trades Page** (`trades.spec.ts`)
- Trades list header
- Trade card layout and grid
- Active trade indicators
- Mobile responsive view

### 4. **Responsive Layouts** (`viewport-utils.spec.ts`)
- Mobile (iPhone 12: 375×667px)
- Desktop (Chrome: 1440×900px)
- Layout shifts and overflow handling

## Running Visual Tests

### Run All Visual Tests

```bash
cd frontend
pnpm test:visual
```

### Run Specific Test File

```bash
pnpm test:visual trades.spec.ts
```

### Run with Specific Project (Viewport)

```bash
# Mobile tests only
pnpm test:visual --project=chromium-mobile

# Desktop tests only
pnpm test:visual --project=chromium-desktop
```

### Update/Regenerate Snapshots

**Use this only when visual changes are intentional** (e.g., design update, layout refactor):

```bash
pnpm test:visual:update
```

## Snapshot Policy

See [SNAPSHOT_POLICY.md](../frontend/tests/visual/SNAPSHOT_POLICY.md) for detailed guidelines on when and how to update snapshots.

### Quick Summary

✅ **DO regenerate snapshots when**:
- Intentional design changes are made
- UI components are refactored
- New visual states are added
- Committed alongside the code change that caused them

❌ **DO NOT regenerate snapshots to**:
- Silence a failing test
- Hide unrelated visual regressions
- Fix CI failures without investigation

## CI/CD Integration

### GitHub Actions Pipeline

Visual regression tests run automatically in the CI pipeline:

```yaml
- name: Frontend visual regression tests
  if: matrix.stack == 'frontend'
  run: pnpm test:visual
  working-directory: frontend
```

**Triggers**:
- On PR to `main` or `develop` branches
- On any changes to `frontend/**`
- Can be manually triggered via workflow_dispatch

### Playwright Configuration

The config (`playwright.config.ts`) includes:

- **Parallel Execution**: Tests run in parallel locally (disabled in CI for consistency)
- **Retry Logic**: Failed tests retry 2 times in CI
- **Browser Coverage**: 
  - Chromium Desktop (1440×900)
  - Chromium Mobile (iPhone 12 simulation)
- **Trace Collection**: Captures trace on first retry for debugging
- **HTML Reporting**: Generates interactive report in `playwright-report/`

## Test Structure

### Example Test File

```typescript
import { test, expect } from '@playwright/test';

test.describe('Trades Page Visual Tests', () => {
  test('trades page header matches snapshot', async ({ page }) => {
    // Navigate to page
    await page.goto('/trades');
    
    // Wait for full page load
    await page.waitForLoadState('networkidle');
    
    // Assert specific content loaded
    await expect(page.locator('h1')).toHaveText('Trades');
    
    // Capture scoped snapshot
    const header = page.locator('header').first();
    await expect(header).toHaveScreenshot('trades-header.png');
  });
});
```

### Best Practices

1. **Scope Snapshots Narrowly**
   - Use specific locators: `page.locator('header')`, `page.locator('main')`
   - Avoid full-page screenshots unless necessary
   - Smaller diffs are easier to review

2. **Use Meaningful Names**
   - Example: `trades-list-card.png` ✅
   - Avoid: `snapshot1.png` ❌

3. **Wait for Page Load**
   - Use `page.waitForLoadState('networkidle')` for API-driven content
   - Wait for specific elements before snapshot if using skeleton loaders

4. **Test Multiple Viewports**
   - Mobile (375×667) — matches iPhone 12
   - Desktop (1440×900) — matches standard desktop

5. **Use Data Attributes for Selectors**
   - Prefer: `page.locator('[data-testid="trade-card"]')`
   - Avoid: `page.locator('.trade-card:nth-child(1)')` (brittle selectors)

## Snapshot Artifacts and Storage

### Snapshot Files Location

```
frontend/
  tests/
    visual/
      trades.spec.ts
      trades.spec.ts-snapshots/
        trades-header.png
        trades-main.png
```

### Git Storage

- **Commit**: Baseline PNG files with corresponding test changes
- **Do Not Commit**: Temporary files in `test-results/` or `playwright-report/`

### `.gitignore` Rules

```gitignore
# Playwright report
playwright-report/
test-results/

# Temporary files
.pw-cache/
```

## Interpreting Test Results

### Local Test Run

```bash
$ pnpm test:visual
  
  Running 8 tests using 8 workers
  
  ✓ trades.spec.ts › trades page header matches snapshot
  ✓ trades.spec.ts › trades page main content matches snapshot
  ✓ login.spec.ts › login form layout matches snapshot
  ✗ landing.spec.ts › landing hero section layout
    Expected desktop screenshot
    Diff: https://localhost:54321
```

Click the Diff URL or open `playwright-report/index.html` to view:
- Side-by-side comparison of expected vs. actual
- Highlighted differences
- Baseline and current renders

### CI Failure

When a visual test fails in CI:

1. **Check the HTML Report** (artifact in workflow)
2. **Review the Diff**: Is the change intentional?
3. **Rerun Locally**: `pnpm test:visual` to debug in your environment
4. **Decide**:
   - If intentional: `pnpm test:visual:update` + commit
   - If regression: Fix the code + rerun tests

## Common Issues and Solutions

### "Page is still loading" errors

**Problem**: Test snapshots before content loads

**Solution**:
```typescript
// Wait for network requests to complete
await page.waitForLoadState('networkidle');

// Or wait for specific elements
await page.waitForSelector('[data-testid="trade-list"]');
```

### Snapshots differ between runs

**Problem**: Non-deterministic rendering (e.g., animations, dynamic content)

**Solution**:
- Disable animations in test:
  ```typescript
  await page.emulateMedia({ reducedMotion: 'reduce' });
  ```
- Mock timestamps or random data
- Wait for animations to complete

### Font rendering differences

**Problem**: Snapshots render differently on CI vs. local

**Solution**:
- CI uses pre-installed system fonts
- Ensure font files are committed
- Use web fonts (Google Fonts, etc.) for consistency
- CI configuration already uses consistent browsers

## Extending Tests

### Adding a New Visual Test

1. **Create Test File**
   ```bash
   touch frontend/tests/visual/my-feature.spec.ts
   ```

2. **Write Test**
   ```typescript
   import { test, expect } from '@playwright/test';
   
   test.describe('My Feature Visual Tests', () => {
     test('my component renders correctly', async ({ page }) => {
       await page.goto('/my-feature');
       await page.waitForLoadState('networkidle');
       await expect(page.locator('[data-testid="my-component"]'))
         .toHaveScreenshot('my-component.png');
     });
   });
   ```

3. **Generate Baseline**
   ```bash
   pnpm test:visual:update my-feature.spec.ts
   ```

4. **Commit**
   - Commit `.spec.ts` file
   - Commit generated `.png` snapshot files

### Testing Multiple States

```typescript
test('button states match snapshot', async ({ page }) => {
  await page.goto('/buttons');
  
  // Default state
  await expect(page.locator('[data-state="default"]'))
    .toHaveScreenshot('button-default.png');
  
  // Hover state
  await page.locator('button').first().hover();
  await expect(page.locator('[data-state="default"]'))
    .toHaveScreenshot('button-hover.png');
  
  // Disabled state
  await page.locator('button[disabled]').first();
  await expect(page.locator('[data-state="disabled"]'))
    .toHaveScreenshot('button-disabled.png');
});
```

## Performance and Maintenance

### Snapshot Size

- Typical per-snapshot: 50-200 KB
- Large snapshots (full-page): 500 KB+
- Consider impact on repository size

### Recommendations

1. **Keep Snapshots Focused**: Scope to smallest stable region
2. **Monitor Repository Size**: Periodically review snapshot storage
3. **Deprecate Old Snapshots**: Remove tests for deprecated UI

## Integration with Design System

When design tokens or system components change:

1. **Identify Affected Tests** (grep or manual review)
2. **Run Visual Tests**: `pnpm test:visual`
3. **Review All Diffs**: Ensure changes align with design update
4. **Bulk Regenerate**: `pnpm test:visual:update`
5. **Commit**: Design update + snapshot updates in single PR

## Related Documentation

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [SNAPSHOT_POLICY.md](../frontend/tests/visual/SNAPSHOT_POLICY.md)
- [Frontend Testing Guide](./frontend.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

## Support and Troubleshooting

For issues with Playwright or visual tests:

1. Check [Playwright Troubleshooting](https://playwright.dev/docs/troubleshooting)
2. Review test logs: Look for timing or timeout issues
3. Run with `--debug` flag: `pnpm test:visual --debug`
4. File an issue in the repository with snapshot diffs included
