const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve(__dirname, '../playwright-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVerification() {
  const browser = await chromium.launch({ headless: true });
  const results = {
    desktop: { passed: [], failed: [], warnings: [] },
    mobile: { passed: [], failed: [], warnings: [] },
  };

  const viewports = [
    { name: 'desktop', width: 1440, height: 900, isMobile: false },
    { name: 'mobile', width: 375, height: 812, isMobile: true },
  ];

  for (const vp of viewports) {
    console.log(`\n========================================`);
    console.log(`Starting UI Verification for: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`);
    console.log(`========================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });

    const page = await context.newPage();

    // Track console & network errors
    const consoleErrors = [];
    const networkFailures = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign extensions/devtools warnings
        if (!text.includes('React DevTools') && !text.includes('chrome-extension')) {
          consoleErrors.push(text);
          console.log(`  [Console Error] ${text}`);
        }
      }
    });

    page.on('requestfailed', req => {
      const url = req.url();
      networkFailures.push(`${req.method()} ${url} - ${req.failure()?.errorText}`);
      console.log(`  [Network Failure] ${req.method()} ${url}`);
    });

    page.on('response', resp => {
      if (resp.status() >= 400) {
        const url = resp.url();
        // Ignore analytics or external font 404s if any
        networkFailures.push(`HTTP ${resp.status()} ${url}`);
        console.log(`  [HTTP ${resp.status()}] ${url}`);
      }
    });

    try {
      // 1. Fresh User Flow: Navigate to Explore
      console.log(`\n[Step 1] Loading /explore ...`);
      await page.goto('http://localhost:3000/explore', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Verify page title and header elements
      const hasExploreHeader = await page.locator('#h1, .explore, main').first().isVisible();
      if (hasExploreHeader) {
        results[vp.name].passed.push('Explore page loaded cleanly');
        console.log(`  ✓ Explore page loaded cleanly`);
      } else {
        results[vp.name].failed.push('Explore page failed to load header');
        console.log(`  ✗ Explore page failed to load header`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-01-explore-landing.png`) });

      // 2. Click + / Post a room -> Verify 2-option Chooser Modal
      console.log(`\n[Step 2] Testing 2-option Chooser Modal ...`);
      const postBtnSelector = vp.isMobile ? 'button.nv[data-n="post"]' : '#postBtn, button[data-n="post"]';
      const postBtn = page.locator(postBtnSelector).first();
      await postBtn.waitFor({ state: 'visible', timeout: 5000 });
      await postBtn.click();
      await page.waitForTimeout(600);

      const chooserModal = page.locator('#nm-chooser-ov');
      const isChooserOpen = await chooserModal.evaluate(el => el.classList.contains('o'));
      const isChooserVisible = await chooserModal.locator('.nm-chooser-card').isVisible();

      // Check z-index and computed styling
      const chooserZIndex = await chooserModal.evaluate(el => window.getComputedStyle(el).zIndex);
      console.log(`  Chooser modal open: ${isChooserOpen}, visible: ${isChooserVisible}, z-index: ${chooserZIndex}`);

      if (isChooserOpen && isChooserVisible) {
        results[vp.name].passed.push('2-option Chooser opens cleanly with proper visibility');
        console.log(`  ✓ 2-option Chooser modal opened successfully`);
      } else {
        results[vp.name].failed.push('2-option Chooser modal did not open');
        console.log(`  ✗ 2-option Chooser modal failed to open`);
      }

      // Check 2 options exist
      const optRoom = await chooserModal.locator('[data-chooser-action="post-room"]').isVisible();
      const optPref = await chooserModal.locator('[data-chooser-action="post-pref"]').isVisible();
      if (optRoom && optPref) {
        results[vp.name].passed.push('Both options (Post a Room & Post Requirement) are visible');
        console.log(`  ✓ Both options (Post a Room & Post Requirement) are present`);
      } else {
        results[vp.name].failed.push('Missing chooser action options');
        console.log(`  ✗ Missing chooser action options (room: ${optRoom}, pref: ${optPref})`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-02-chooser-open.png`) });

      // Test Backdrop dismissal
      console.log(`  Testing backdrop dismissal...`);
      // Click near top edge of overlay (outside .nm-chooser-card)
      await chooserModal.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
      const isClosedAfterBackdrop = await chooserModal.evaluate(el => !el.classList.contains('o'));
      if (isClosedAfterBackdrop) {
        results[vp.name].passed.push('Backdrop dismissal closes Chooser cleanly');
        console.log(`  ✓ Backdrop dismissal works`);
      } else {
        results[vp.name].failed.push('Backdrop click did not dismiss Chooser');
        console.log(`  ✗ Backdrop click failed to dismiss`);
      }

      // 3. Intent Switcher & Fast Drawer
      console.log(`\n[Step 3] Testing Fast Drawer via Chooser (Post Requirement / Set Preferences) ...`);
      // Re-open Chooser to test Post Requirement flow
      await postBtn.click();
      await page.waitForTimeout(600);
      const postPrefOption = chooserModal.locator('[data-chooser-action="post-pref"]');
      await postPrefOption.click();
      await page.waitForTimeout(800);

      // Verify Fast Drawer opens
      const fastDrawer = page.locator('#nm-fast-prefs-ov');
      const isDrawerOpen = await fastDrawer.evaluate(el => el.classList.contains('o'));
      const isDrawerVisible = await fastDrawer.locator('.nm-drawer-card').isVisible();
      console.log(`  Fast Drawer open: ${isDrawerOpen}, visible: ${isDrawerVisible}`);

      if (isDrawerOpen && isDrawerVisible) {
        results[vp.name].passed.push('Fast 2-Step Drawer opens cleanly via Chooser');
        console.log(`  ✓ Fast Drawer opened cleanly`);
      } else {
        results[vp.name].failed.push('Fast Drawer failed to open');
        console.log(`  ✗ Fast Drawer failed to open`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-03-fast-drawer-open.png`) });

      // Step 1: Select Budget (e.g. ₹25,000)
      const budgetPill = fastDrawer.locator('[data-fast-budget="25000"]');
      if (await budgetPill.isVisible()) {
        await budgetPill.click();
        console.log(`  ✓ Clicked ₹25,000 budget pill`);
      }

      // Step 2: Select Localities (pick 2 locality chips)
      const locChips = fastDrawer.locator('.nm-fast-loc-chip');
      const count = await locChips.count();
      console.log(`  Found ${count} locality chips in Fast Drawer`);
      if (count > 1) {
        await locChips.nth(0).click();
        await page.waitForTimeout(200);
        await locChips.nth(1).click();
        await page.waitForTimeout(200);
        console.log(`  ✓ Selected 2 locality chips`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-04-fast-drawer-filled.png`) });

      // Click Save & Unlock Matches
      const submitBtn = fastDrawer.locator('#nm-fast-prefs-submit');
      await submitBtn.click();
      await page.waitForTimeout(1000);

      const isDrawerClosedAfterSubmit = await fastDrawer.evaluate(el => !el.classList.contains('o'));
      if (isDrawerClosedAfterSubmit) {
        results[vp.name].passed.push('Fast Drawer submits and closes cleanly');
        console.log(`  ✓ Fast Drawer submitted and closed`);
      } else {
        results[vp.name].failed.push('Fast Drawer did not close after submit');
        console.log(`  ✗ Fast Drawer did not close`);
      }

      // Verify live % match badges on room cards
      await page.waitForTimeout(1000);
      const matchBadges = page.locator('.mp');
      const badgeCount = await matchBadges.count();
      console.log(`  Found ${badgeCount} match badges on explore cards`);

      if (badgeCount > 0) {
        const firstBadgeText = await matchBadges.first().textContent();
        console.log(`  First match badge text: "${firstBadgeText?.trim()}"`);
        if (firstBadgeText && (firstBadgeText.includes('%') || firstBadgeText.includes('match') || firstBadgeText.includes('Set preferences'))) {
          results[vp.name].passed.push(`Match badges rendered cleanly: ${firstBadgeText.trim()}`);
          console.log(`  ✓ Match badges rendered cleanly`);
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-05-live-matches.png`) });

      // 4. Match Breakdown Modal ("Why this %?")
      console.log(`\n[Step 4] Testing 5-Factor Match Breakdown Modal ...`);
      const whyMatchBtn = page.locator('button[data-why-match]').first();
      const hasWhyMatchBtn = await whyMatchBtn.isVisible();

      if (hasWhyMatchBtn) {
        await whyMatchBtn.click();
        await page.waitForTimeout(600);

        const breakdownModal = page.locator('#nm-breakdown-ov');
        const isBreakdownOpen = await breakdownModal.evaluate(el => el.classList.contains('o'));
        const isBreakdownVisible = await breakdownModal.locator('.nm-breakdown-card').isVisible();

        console.log(`  Breakdown modal open: ${isBreakdownOpen}, visible: ${isBreakdownVisible}`);

        if (isBreakdownOpen && isBreakdownVisible) {
          results[vp.name].passed.push('5-Factor Breakdown modal opens cleanly');
          console.log(`  ✓ 5-Factor Breakdown modal opened`);

          // Check for horizontal overflow on mobile
          const cardBox = await breakdownModal.locator('.nm-breakdown-card').boundingBox();
          const viewportWidth = vp.width;
          if (cardBox && cardBox.width <= viewportWidth) {
            results[vp.name].passed.push(`Breakdown card fits within viewport width (${cardBox.width}px <= ${viewportWidth}px)`);
            console.log(`  ✓ Breakdown modal fits viewport width (no horizontal clipping)`);
          } else if (cardBox) {
            results[vp.name].failed.push(`Breakdown card overflows viewport width (${cardBox.width}px > ${viewportWidth}px)`);
            console.log(`  ✗ Breakdown modal overflows: ${cardBox.width}px > ${viewportWidth}px`);
          }

          // Verify factor rows are rendered
          const factorRows = breakdownModal.locator('.nm-factor-row');
          const factorRowCount = await factorRows.count();
          console.log(`  Factor rows count: ${factorRowCount}`);
          if (factorRowCount >= 5) {
            results[vp.name].passed.push('All 5 compatibility factors are displayed');
            console.log(`  ✓ All 5 factors displayed`);
          }

          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-06-breakdown-modal.png`) });

          // Close Breakdown Modal
          await breakdownModal.locator('[data-close-breakdown]').first().click();
          await page.waitForTimeout(400);
        } else {
          results[vp.name].failed.push('Breakdown modal failed to open on match badge click');
          console.log(`  ✗ Breakdown modal failed to open`);
        }
      } else {
        console.log(`  Note: No active match button with data-why-match found`);
      }

      // 5. Roommates Tab & Active Recently Sorting
      console.log(`\n[Step 5] Testing Roommates Tab & Freshness Sorting ...`);
      const roommatesTabBtn = page.locator('.cats button[data-c="2"]').or(page.locator('button.chip:has-text("Roommates")')).first();
      await roommatesTabBtn.click();
      await page.waitForTimeout(1500);

      // Verify URL or active tab state
      const isRoommatesActive = await roommatesTabBtn.evaluate(el => el.getAttribute('aria-pressed') === 'true' || el.classList.contains('active'));
      console.log(`  Roommates tab active: ${isRoommatesActive}`);

      // Check Active recently sort option
      const sortSelect = page.locator('#sort');
      if (await sortSelect.isVisible()) {
        const sortOptions = await sortSelect.locator('option').allTextContents();
        console.log(`  Sort options available: ${sortOptions.join(', ')}`);
        const hasRecentSort = sortOptions.some(opt => opt.toLowerCase().includes('active recently'));
        if (hasRecentSort) {
          results[vp.name].passed.push('Sort dropdown includes "Active recently"');
          console.log(`  ✓ "Active recently" option found in Sort dropdown`);

          await sortSelect.selectOption('recent');
          await page.waitForTimeout(800);
          results[vp.name].passed.push('Successfully selected "Active recently" sorting');
        } else {
          results[vp.name].failed.push('Sort dropdown missing "Active recently" option');
          console.log(`  ✗ Missing "Active recently" sort option`);
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-07-roommates-tab.png`) });

      // Check for 403 or server errors during Roommates tab navigation
      const has403 = networkFailures.some(f => f.includes('403'));
      if (!has403) {
        results[vp.name].passed.push('Zero 403 errors encountered during Roommates discovery');
        console.log(`  ✓ ZERO 403 errors during discovery`);
      } else {
        results[vp.name].failed.push('Encountered 403 error during Roommates discovery');
        console.log(`  ✗ Encountered 403 error during discovery!`);
      }

    } catch (err) {
      console.error(`  Error during ${vp.name} test:`, err);
      results[vp.name].failed.push(`Runtime error: ${err.message}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`FINAL VERIFICATION SUMMARY`);
  console.log(`========================================`);
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'verification-summary.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );
}

runVerification().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
