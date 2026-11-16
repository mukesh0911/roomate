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
      const hasExploreHeader = await page.locator('#h1, .explore, main, .nm-explore-root').first().isVisible();
      if (hasExploreHeader) {
        results[vp.name].passed.push('Explore page loaded cleanly');
        console.log(`  ✓ Explore page loaded cleanly`);
      } else {
        results[vp.name].failed.push('Explore page failed to load header');
        console.log(`  ✗ Explore page failed to load header`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-01-explore-landing.png`) });

      // 1B. Test City Switcher Pill & Popup (#ppc)
      console.log(`\n[Step 1B] Testing City Switcher Pill & Popup (#ppc) ...`);
      const cityPill = page.locator('.city[data-pop="c"]').first();
      const isCityVisible = await cityPill.isVisible();
      console.log(`  City pill visible: ${isCityVisible}`);

      if (isCityVisible) {
        const pillText = await cityPill.textContent();
        results[vp.name].passed.push(`City pill is visible (Text: "${pillText?.trim()}")`);
        console.log(`  ✓ City pill is visible with label: "${pillText?.trim()}"`);

        // Click city pill to open #ppc
        await cityPill.click();
        await page.waitForTimeout(500);

        const cityPopup = page.locator('#ppc');
        const isCityPopupOpen = await cityPopup.evaluate(el => el.classList.contains('o'));
        console.log(`  City popup #ppc open: ${isCityPopupOpen}`);

        if (isCityPopupOpen) {
          results[vp.name].passed.push('Clicking city pill opens #ppc popup');
          console.log(`  ✓ City popup opened successfully`);

          // Verify [data-select-city] options
          const cityOptions = cityPopup.locator('[data-select-city]');
          const cityOptionCount = await cityOptions.count();
          console.log(`  Found ${cityOptionCount} city options in #ppc`);

          if (cityOptionCount >= 5) {
            results[vp.name].passed.push(`Found ${cityOptionCount} city options in #ppc`);
            console.log(`  ✓ Supported city chips present`);

            // Click Mumbai or Bengaluru
            const targetCityBtn = cityPopup.locator('[data-select-city="Mumbai"]').or(cityPopup.locator('[data-select-city="Bengaluru"]')).first();
            await targetCityBtn.click();
            await page.waitForTimeout(800);

            const isPopupClosed = await cityPopup.evaluate(el => !el.classList.contains('o'));
            if (isPopupClosed) {
              results[vp.name].passed.push('Selecting a city closes #ppc popup');
              console.log(`  ✓ Selecting city closed popup cleanly`);
            }
          } else {
            results[vp.name].failed.push('City popup missing [data-select-city] options');
            console.log(`  ✗ Missing city options in #ppc`);
          }
        } else {
          results[vp.name].failed.push('Clicking city pill did not open #ppc');
          console.log(`  ✗ City popup failed to open`);
        }
      } else {
        results[vp.name].failed.push('City pill is not visible in viewport');
        console.log(`  ✗ City pill is hidden`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-01b-city-selected.png`) });

      // 2. Click + / Post a room -> Verify 2-option Chooser Modal
      console.log(`\n[Step 2] Testing 2-option Chooser Modal ...`);
      const postBtnSelector = vp.isMobile ? 'button.nv[data-n="post"]' : '.top button[data-n="post"], button[data-n="post"]';
      const postBtn = page.locator(postBtnSelector).first();
      await postBtn.waitFor({ state: 'visible', timeout: 5000 });
      await postBtn.click();
      await page.waitForTimeout(600);

      const chooserModal = page.locator('#nm-chooser-ov');
      const isChooserOpen = await chooserModal.evaluate(el => el.classList.contains('o'));
      const isChooserVisible = await chooserModal.locator('.nm-chooser-card').isVisible();

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

      // 3. Fast Drawer: Post Requirement / Set Preferences
      console.log(`\n[Step 3] Testing Fast Drawer via Chooser (Post Requirement / Set Preferences) ...`);
      await postBtn.click();
      await page.waitForTimeout(600);
      const postPrefOption = chooserModal.locator('[data-chooser-action="post-pref"]');
      await postPrefOption.click();
      await page.waitForTimeout(800);

      const fastDrawer = page.locator('#nm-fast-prefs-ov');
      const isDrawerOpen = await fastDrawer.evaluate(el => el.classList.contains('o'));
      const isDrawerVisible = await fastDrawer.locator('.nm-drawer-card').isVisible();
      console.log(`  Fast Drawer open: ${isDrawerOpen}, visible: ${isDrawerVisible}`);

      if (isDrawerOpen && isDrawerVisible) {
        results[vp.name].passed.push('Fast 2-Step Drawer opens cleanly via Chooser');
        console.log(`  ✓ Fast Drawer opened cleanly`);

        // Check horizontal overflow on drawer card
        const drawerCardBox = await fastDrawer.locator('.nm-drawer-card').boundingBox();
        if (drawerCardBox && drawerCardBox.width <= vp.width + 1) {
          results[vp.name].passed.push(`Fast Drawer fits within viewport width (${drawerCardBox.width}px <= ${vp.width}px)`);
          console.log(`  ✓ Fast Drawer fits viewport width without horizontal clipping`);
        } else if (drawerCardBox) {
          results[vp.name].failed.push(`Fast Drawer overflows viewport width (${drawerCardBox.width}px > ${vp.width}px)`);
          console.log(`  ✗ Fast Drawer overflows viewport width!`);
        }

        // Verify required inputs: #nm-fast-name, #nm-fast-ug, budget pills, locality chips, traits
        const hasNameInput = await fastDrawer.locator('#nm-fast-name').isVisible();
        const hasGenderSelect = await fastDrawer.locator('#nm-fast-ug').isVisible();
        console.log(`  Drawer fields: name=${hasNameInput}, gender=${hasGenderSelect}`);

        if (hasNameInput) {
          await fastDrawer.locator('#nm-fast-name').fill('Alex Seeker');
        }

        // Select Budget (e.g. ₹25,000)
        const budgetPill = fastDrawer.locator('[data-fast-budget="25000"]');
        if (await budgetPill.isVisible()) {
          await budgetPill.click();
          console.log(`  ✓ Clicked ₹25,000 budget pill`);
        }

        // Select Localities
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

        // Optional lifestyle traits in drawer
        const traitButtons = fastDrawer.locator('[data-fast-ls]');
        const traitCount = await traitButtons.count();
        console.log(`  Found ${traitCount} lifestyle trait chips in Fast Drawer`);
        if (traitCount >= 4) {
          results[vp.name].passed.push('Fast Drawer renders lifestyle trait options');
          console.log(`  ✓ Lifestyle trait chips verified`);
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-04-fast-drawer-filled.png`) });

        // Submit Fast Drawer
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
      } else {
        results[vp.name].failed.push('Fast Drawer failed to open');
        console.log(`  ✗ Fast Drawer failed to open`);
      }

      // 4. Verify Mobile Room Card CTA Button
      console.log(`\n[Step 4] Testing Room Card CTA Button styling & attributes ...`);
      await page.waitForTimeout(1000);
      const roomCards = page.locator('.card:not(.rm)');
      const roomCardCount = await roomCards.count();
      console.log(`  Found ${roomCardCount} room cards on Explore`);

      if (roomCardCount > 0) {
        const firstCardBtn = roomCards.first().locator('.ft .msgb, .ft button').first();
        const btnVisible = await firstCardBtn.isVisible();
        const btnBox = await firstCardBtn.boundingBox();
        const hasApplyAttr = await firstCardBtn.getAttribute('data-apply-place');
        const btnText = await firstCardBtn.textContent();

        console.log(`  First room card button: visible=${btnVisible}, width=${btnBox?.width}px, text="${btnText?.trim()}", data-apply-place="${hasApplyAttr}"`);

        if (btnVisible && btnBox && btnBox.width >= 50) {
          results[vp.name].passed.push(`Room card CTA button is visible with adequate width (${Math.round(btnBox.width)}px >= 50px)`);
          console.log(`  ✓ Room card CTA button width and visibility passed`);
        } else {
          results[vp.name].failed.push(`Room card CTA button is too narrow or hidden (${btnBox?.width}px)`);
          console.log(`  ✗ Room card CTA button sizing issue`);
        }

        if (hasApplyAttr) {
          results[vp.name].passed.push(`Room card CTA button has data-apply-place="${hasApplyAttr}"`);
          console.log(`  ✓ data-apply-place contract verified`);
        } else {
          results[vp.name].warnings.push('Room card button missing data-apply-place attribute');
          console.log(`  ! Room card button missing data-apply-place`);
        }
      }

      // 5. Room Detail Mobile Sticky Bar (.detail-view)
      console.log(`\n[Step 5] Testing Room Detail View & Mobile Sticky Bar (.detail-view) ...`);
      if (roomCardCount > 0) {
        const firstCard = roomCards.first();
        // Click on the card body/title to navigate to room detail
        const cardTitle = firstCard.locator('.t, .tr').first();
        await cardTitle.click();
        await page.waitForTimeout(1000);

        const isDetailViewClassApplied = await page.evaluate(() => {
          const root = document.querySelector('.nm-explore-root');
          return root ? root.classList.contains('detail-view') : false;
        });

        console.log(`  .nm-explore-root has .detail-view: ${isDetailViewClassApplied}`);
        if (isDetailViewClassApplied) {
          results[vp.name].passed.push('.detail-view class toggled on .nm-explore-root');
          console.log(`  ✓ .detail-view class applied cleanly`);
        } else {
          results[vp.name].failed.push('.detail-view class not applied to .nm-explore-root on detail page');
          console.log(`  ✗ .detail-view class missing`);
        }

        if (vp.isMobile) {
          // Verify #bb is hidden on mobile in detail view
          const isBottomBarHidden = await page.evaluate(() => {
            const bb = document.getElementById('bb');
            if (!bb) return true;
            const style = window.getComputedStyle(bb);
            return style.display === 'none' || style.visibility === 'hidden';
          });

          console.log(`  Mobile bottom bar #bb hidden in detail view: ${isBottomBarHidden}`);
          if (isBottomBarHidden) {
            results[vp.name].passed.push('Mobile bottom bar #bb is hidden in .detail-view');
            console.log(`  ✓ Mobile bottom bar hidden`);
          } else {
            results[vp.name].failed.push('Mobile bottom bar #bb is not hidden in .detail-view');
            console.log(`  ✗ Mobile bottom bar still visible in detail view`);
          }

          // Verify .rbar is anchored cleanly
          const rbar = page.locator('.rbar').first();
          if (await rbar.isVisible()) {
            const rbarStyle = await rbar.evaluate(el => {
              const comp = window.getComputedStyle(el);
              return { position: comp.position, bottom: comp.bottom };
            });
            console.log(`  Sticky .rbar position: ${rbarStyle.position}, bottom: ${rbarStyle.bottom}`);
            if (rbarStyle.bottom === '0px' || rbarStyle.position === 'fixed') {
              results[vp.name].passed.push('.rbar is anchored at bottom: 0 on mobile');
              console.log(`  ✓ .rbar anchored cleanly`);
            }
          }
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}-05-detail-view.png`) });

        // Go back to Explore
        const backBtn = page.locator('.rd .back, .rd .ghb.back, button.back').first();
        if (await backBtn.isVisible()) {
          await backBtn.click();
          await page.waitForTimeout(800);
        }
      }

      // 6. Match Breakdown Modal ("Why this %?")
      console.log(`\n[Step 6] Testing 5-Factor Match Breakdown Modal ...`);
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

          // Check for horizontal overflow
          const cardBox = await breakdownModal.locator('.nm-breakdown-card').boundingBox();
          const viewportWidth = vp.width;
          if (cardBox && cardBox.width <= viewportWidth + 1) {
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

      // 7. Roommates Tab & Freshness Sorting
      console.log(`\n[Step 7] Testing Roommates Tab & Freshness Sorting ...`);
      const detailViewCheck = await page.evaluate(() => document.querySelector('.nm-explore-root')?.classList.contains('detail-view'));
      if (detailViewCheck) {
        const backBtn = page.locator('.rd .back, .rd .ghb.back, button.back').first();
        if (await backBtn.isVisible()) {
          await backBtn.click();
          await page.waitForTimeout(800);
        }
      }
      const roommatesTabBtn = page.locator('.cats button[data-c="2"]').or(page.locator('button.chip:has-text("Roommates")')).first();
      await roommatesTabBtn.click();
      await page.waitForTimeout(1500);

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

      if (consoleErrors.length === 0) {
        results[vp.name].passed.push('Zero console errors encountered');
        console.log(`  ✓ ZERO console errors during run`);
      } else {
        results[vp.name].warnings.push(`${consoleErrors.length} console errors logged`);
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

  const totalFailed = results.desktop.failed.length + results.mobile.failed.length;
  if (totalFailed > 0) {
    console.error(`\nTest completed with ${totalFailed} failure(s).`);
    process.exit(1);
  } else {
    console.log(`\nAll visual and interaction flows PASSED on Desktop & Mobile!`);
  }
}

runVerification().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
