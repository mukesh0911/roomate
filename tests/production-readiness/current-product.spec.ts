import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[key] || '')) throw new Error(`Explicit local emulator required: ${key}`);
}
const app = initializeApp({ projectId: 'demo-nestmate' }, 'readiness-browser');
const db = getFirestore(app);
const emulatorAuth = getAuth(app);

async function guardContext(context: BrowserContext) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const liveFirebase = (url.hostname.endsWith('.googleapis.com') && url.hostname !== 'fonts.googleapis.com')
      || url.hostname.endsWith('.cloudfunctions.net') || url.hostname.endsWith('.firebaseio.com');
    if (liveFirebase) await route.abort('blockedbyclient');
    else await route.continue();
  });
}
test.beforeEach(async ({ context }) => { await guardContext(context); });

async function assertLocalFirebase(page: Page) {
  const config = await page.evaluate(async () => {
    const path = '/src/lib/firebase.ts';
    const { auth } = await import(path);
    return { project: auth.app.options.projectId, host: auth.emulatorConfig?.host, port: auth.emulatorConfig?.port };
  });
  expect(config, 'Browser SDK must target the isolated demo Auth emulator').toMatchObject({ project: 'demo-nestmate', host: '127.0.0.1', port: 19099 });
}

async function openAuth(page: Page) {
  await page.goto('/');
  await assertLocalFirebase(page);
  await page.getByRole('link', { name: 'Sign In', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

for (const width of [320, 360, 390, 430, 768, 1440, 1920]) {
  test(`current routes render without crash or page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/explore', '/saved', '/messages', '/connections', '/listings', '/profile', '/admin']) {
      await page.goto(route);
      if (route === '/') await assertLocalFirebase(page);
      await expect(page.locator('#root')).not.toBeEmpty();
      if (route === '/admin') await expect(page.getByRole('heading', { name: 'Administrator Sign In' })).toBeVisible();
      else if (route !== '/') await expect(page.locator('#rail')).not.toBeEmpty();
      else await expect(page.getByRole('heading', { name: 'Find your people. Find your place.', exact: true })).toBeVisible();
      await expect(page.getByText('This page couldn’t load', { exact: true })).toHaveCount(0);
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: document.documentElement.clientWidth,
      }));
      expect(dimensions.scroll, `${route} overflows at ${width}px`).toBeLessThanOrEqual(dimensions.width + 1);
      expect(errors, `${route}: ${errors.join('; ')}`).toEqual([]);
      if ((width === 320 || width === 390 || width === 1440) && (route === '/' || route === '/explore')) {
        await page.screenshot({ path: `docs/production-readiness/evidence/${route === '/' ? 'landing' : 'explore'}-${width}.png`, fullPage: true });
      }
    }
  });
}

test('registration persists separate public/private data and session after refresh; ordinary user cannot enter admin', async ({ page }) => {
  const email = `readiness-${Date.now()}@example.test`;
  await openAuth(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Create an account', exact: true }).click();
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill('EmulatorOnly!2026');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/explore/);
  const user = await emulatorAuth.getUserByEmail(email);
  await expect.poll(async () => (await db.doc(`users/${user.uid}`).get()).exists).toBe(true);
  const publicData = (await db.doc(`users/${user.uid}`).get()).data()!;
  expect(publicData.email || '').toBe('');
  expect(publicData.isVerified).toBe(false);
  expect(publicData.isPremium).toBe(false);
  expect((await db.doc(`privateUserData/${user.uid}`).get()).data()?.email).toBe(email);
  await page.goto('/profile');
  await page.locator('[data-as="edit"]:visible').first().click();
  await page.getByLabel('Full name', { exact: true }).fill('Readiness new member');
  await page.getByLabel('City', { exact: true }).fill('Pune');
  await page.getByLabel('Locality', { exact: true }).fill('Baner');
  await page.getByLabel('Find a room', { exact: true }).check();
  await page.locator('[data-sv="1"]:visible').click();
  await expect.poll(async () => (await db.doc(`users/${user.uid}`).get()).data()?.onboardingComplete).toBe(true);
  let savedProfile = (await db.doc(`users/${user.uid}`).get()).data()!;
  expect(savedProfile.housingPreferences.activeIntents).toEqual(['find_room']);
  expect(savedProfile.roommateDiscoveryEnabled).toBe(false);
  expect(savedProfile.city).toBe('Pune');
  await page.reload();
  await page.locator('[data-as="edit"]:visible').first().click();
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('Pune');
  await expect(page.getByLabel('Locality', { exact: true })).toHaveValue('Baner');
  await expect(page.getByLabel('Find a room', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Team up to rent together', { exact: true })).not.toBeChecked();
  await page.getByLabel('Team up to rent together', { exact: true }).check();
  await page.getByLabel('Show my profile in roommate discovery', { exact: true }).check();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: 'docs/production-readiness/evidence/profile-editor-320.png', fullPage: true });
  await page.locator('[data-sv="1"]:visible').click();
  await expect.poll(async () => (await db.doc(`users/${user.uid}`).get()).data()?.roommateDiscoveryEnabled).toBe(true);
  savedProfile = (await db.doc(`users/${user.uid}`).get()).data()!;
  expect(savedProfile.housingPreferences.activeIntents).toEqual(['find_room', 'team_up']);
  await page.goto('/admin');
  await expect(page.getByText('Access Denied', { exact: false })).toBeVisible();
});

test('invalid password stays in auth dialog with error; real email sign-in survives refresh', async ({ page }) => {
  await openAuth(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill('seeker.a@nestmate.test');
  await dialog.getByLabel('Password', { exact: true }).fill('WrongPassword!');
  await dialog.getByRole('button', { name: 'Sign in with email', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Password', { exact: true }).fill('Nestmate-Emulator-Only-123!');
  await dialog.getByRole('button', { name: 'Sign in with email', exact: true }).click();
  await expect(page).toHaveURL(/\/explore/);
  await page.reload();
  await page.goto('/admin');
  await expect(page.getByText('Access Denied', { exact: false })).toBeVisible();
});

test('two authenticated browsers enforce request, accept, message and block with real database effects', async ({ browser }) => {
  const stamp = Date.now();
  const password = 'EmulatorOnly!2026';
  const people = [];
  for (const suffix of ['a', 'b']) {
    // Discovery is intentionally ordered by document ID. Keep these fixtures on
    // its first page without resetting other tests or changing the product sort.
    const person = await emulatorAuth.createUser({ uid: `00_readiness_${9999999999999 - stamp}_${suffix}`, email: `readiness-pair-${stamp}-${suffix}@example.test`, password });
    await db.doc(`users/${person.uid}`).set({
      uid: person.uid, name: `Readiness ${stamp} ${suffix}`, status: 'active', role: 'seeker',
      email: '', phone: '', workEmail: '', whatsappNumber: '',
      housingIntent: 'team_up', roommateDiscoveryEnabled: true, onboardingComplete: true,
      city: 'Bengaluru', age: 25, gender: 'female', budget: 18000,
      localities: ['Koramangala'], isPremium: false, isVerified: false,
      verificationLevel: 0, connectsUsed: 0, createdAt: new Date(),
    });
    people.push(person);
  }
  const contexts = [await browser.newContext(), await browser.newContext()];
  await Promise.all(contexts.map(guardContext));
  try {
    const pages = [await contexts[0].newPage(), await contexts[1].newPage()];
    for (let index = 0; index < 2; index++) {
      await openAuth(pages[index]);
      const dialog = pages[index].getByRole('dialog');
      await dialog.getByLabel('Email', { exact: true }).fill(people[index].email!);
      await dialog.getByLabel('Password', { exact: true }).fill(password);
      await dialog.getByRole('button', { name: 'Sign in with email', exact: true }).click();
      await expect(pages[index]).toHaveURL(/\/explore/);
    }
    const before = await pages[0].evaluate(async target => {
      const path = '/src/lib/nestmateBackend.ts';
      const backend = await import(path);
      try { await backend.getOrCreateChatRoomBackend(target); return 'allowed'; }
      catch { return 'denied'; }
    }, people[1].uid);
    expect(before).toBe('denied');
    await pages[0].goto('/explore?tab=roommates');
    const peerCard = pages[0].locator('.card.rm').filter({ hasText: `Readiness ${stamp} b` });
    await expect(peerCard).toBeVisible();
    await peerCard.locator('[data-conn]').click();
    await expect(peerCard.getByRole('button', { name: 'Withdraw', exact: true })).toBeVisible();
    const connectionId = (await db.collection('connections').where('fromUserId','==',people[0].uid).get()).docs[0].id;
    await peerCard.locator('.t').click();
    await expect(pages[0].locator('.ra [data-withdraw]')).toBeVisible();
    await expect(pages[0].locator('.rbar [data-withdraw]')).toHaveCount(1);
    await pages[0].setViewportSize({ width: 390, height: 844 });
    await expect(pages[0].locator('.rbar [data-withdraw]')).toBeVisible();
    await pages[0].setViewportSize({ width: 1280, height: 900 });
    await expect(pages[0].locator('[data-conn]')).toHaveCount(0);
    await expect(pages[0].locator('.ra [data-msg]')).toHaveCount(0);
    expect((await db.doc(`connections/${connectionId}`).get()).data()?.status).toBe('pending');
    expect((await db.doc(`users/${people[0].uid}`).get()).data()?.connectsUsed).toBe(1);
    const notifications = await db.collection('notifications').where('connectionId', '==', connectionId).get();
    expect(notifications.docs.some(document => document.data().userId === people[1].uid && document.data().actorId === people[0].uid)).toBe(true);
    await pages[1].goto('/connections');
    await pages[1].locator('[data-s="1"]').click();
    const incoming = pages[1].locator(`[data-conn-act="accept"][data-conn-id="${connectionId}"]`);
    await expect(incoming).toBeVisible();
    await pages[1].setViewportSize({ width: 320, height: 844 });
    await expect(incoming).toBeVisible();
    expect(await pages[1].evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await incoming.click();
    await pages[1].setViewportSize({ width: 1280, height: 900 });
    await expect(pages[0].locator('.ra [data-msg]')).toBeVisible();
    await expect(pages[0].locator('.rbar [data-msg]')).toHaveCount(1);
    await pages[0].setViewportSize({ width: 390, height: 844 });
    await expect(pages[0].locator('.rbar [data-msg]')).toBeVisible();
    await pages[0].setViewportSize({ width: 1280, height: 900 });
    await expect(pages[0].locator('[data-conn]')).toHaveCount(0);
    expect((await db.doc(`connections/${connectionId}`).get()).data()?.status).toBe('accepted');
    expect((await db.doc(`acceptedPairs/${people[0].uid}_${people[1].uid}`).get()).exists).toBe(true);
    const rooms = await Promise.all(pages.map((page, index) => page.evaluate(async target => {
      const path = '/src/lib/nestmateBackend.ts';
      return (await import(path)).getOrCreateChatRoomBackend(target);
    }, people[1 - index].uid)));
    expect(rooms[0]).toBe(rooms[1]);
    const content = `Readiness message ${stamp}`;
    await pages[0].locator('.ra [data-msg]').click();
    await pages[0].getByPlaceholder('Write a message').fill(content);
    await pages[0].getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(async () => (await db.doc(`chatRooms/${rooms[0]}`).get()).data()?.lastMessage).toBe(content);
    expect((await db.doc(`chatRooms/${rooms[0]}`).get()).data()?.lastMessage).toBe(content);
    expect((await db.collection(`chatRooms/${rooms[0]}/messages`).get()).size).toBe(1);
    await pages[1].goto('/messages');
    await expect(pages[1].getByText(content, { exact: true }).first()).toBeVisible();
    await pages[1].reload();
    await expect(pages[1].getByText(content, { exact: true }).first()).toBeVisible();
    await pages[0].goto('/explore?tab=roommates');
    await pages[0].locator('.card.rm').filter({ hasText: `Readiness ${stamp} b` }).locator('.t').click();
    await expect(pages[0].locator('.ra [data-msg]')).toBeVisible();
    await pages[1].evaluate(async id => {
      const path = '/src/lib/nestmateBackend.ts';
      await (await import(path)).updateConnectionStatusBackend(id, 'blocked');
    }, connectionId);
    await expect(pages[0].locator('.ra').getByRole('button', { name: 'Connection blocked', exact: true })).toBeDisabled();
    await expect(pages[0].locator('.ra [data-msg]')).toHaveCount(0);
    await pages[0].setViewportSize({ width: 390, height: 844 });
    await expect(pages[0].locator('.rbar').getByRole('button', { name: 'Connection blocked', exact: true })).toBeDisabled();
    await pages[0].reload();
    await pages[0].goto('/explore?tab=roommates');
    await expect(pages[0].locator('.card.rm').filter({ hasText: `Readiness ${stamp} b` }).getByRole('button', { name: 'Connection blocked', exact: true })).toBeDisabled();
    const after = await pages[0].evaluate(async room => {
      const path = '/src/lib/nestmateBackend.ts';
      try { await (await import(path)).sendMessageBackend(room, 'must be rejected'); return 'allowed'; }
      catch { return 'denied'; }
    }, rooms[0]);
    expect(after).toBe('denied');
    expect((await db.collection(`chatRooms/${rooms[0]}/messages`).get()).size).toBe(1);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('stored listing markup cannot execute scripts and safe controls/private preview URLs survive sanitization', async ({ page }) => {
  const marker = `ReadinessStoredMarkup${Date.now()}`;
  await db.doc('listings/readiness-xss-listing').set({
    ownerId: 'qa_owner_a', title: `<img src="/readiness-missing.png" onerror="window.__readinessXss=true">${marker}`,
    city: 'Bengaluru', locality: 'Koramangala', monthlyRent: 11000, deposit: 22000,
    status: 'active', roomType: 'Private room', ownerVerified: false,
    createdAt: new Date(), updatedAt: new Date(), lastConfirmedAt: new Date(),
  });
  await page.goto('/explore?tab=rooms');
  await expect(page.locator('.card .t').filter({ hasText: marker }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__readinessXss)).toBeUndefined();
  expect(await page.locator('.card [onerror]').count()).toBe(0);
  const sanitized = await page.evaluate(async () => {
    const path = '/src/lib/sanitizeRenderedHtml.ts';
    const { sanitizeRenderedHtml } = await import(path);
    const blob = URL.createObjectURL(new Blob(['preview'], { type: 'image/png' }));
    const host = document.createElement('div');
    host.innerHTML = sanitizeRenderedHtml(`<script>window.__readinessXss=true</script><svg onload="window.__readinessXss=true"></svg><a href="javascript:alert(1)">bad</a><button data-n="saved" aria-label="Saved">Saved</button><img src="${blob}" alt="private preview">`);
    const result = {
      script: host.querySelector('script') !== null,
      handlers: host.querySelector('[onload],[onerror]') !== null,
      unsafeLink: host.querySelector('a')?.getAttribute('href'),
      control: host.querySelector('button')?.getAttribute('data-n'),
      blob: host.querySelector('img')?.getAttribute('src') === blob,
    };
    URL.revokeObjectURL(blob);
    return result;
  });
  expect(sanitized).toEqual({ script: false, handlers: false, unsafeLink: null, control: 'saved', blob: true });
});

test('listing photos create and edit through real Storage ownership rules; invalid upload leaves only a draft', async ({ page }) => {
  await openAuth(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill('owner.a@nestmate.test');
  await dialog.getByLabel('Password', { exact: true }).fill('Nestmate-Emulator-Only-123!');
  await dialog.getByRole('button', { name: 'Sign in with email', exact: true }).click();
  await expect(page).toHaveURL(/\/explore/);
  const created = await page.evaluate(async () => {
    const path = '/src/lib/nestmateBackend.ts';
    const backend = await import(path);
    return backend.createNewListingBackend({ title: 'Readiness real photo listing', loc: 'Koramangala', city: 'Bengaluru', rent: 12000, dep: 24000, type: 'Private room', ph: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5f8AAAAASUVORK5CYII='] }, null);
  });
  const listing = (await db.doc(`listings/${created.id}`).get()).data()!;
  expect(listing.ownerId).toBe('qa_owner_a');
  expect(listing.status).toBe('pending_verification');
  expect(listing.images).toHaveLength(1);
  expect(decodeURIComponent(listing.images[0])).toContain(`listings/${created.id}/`);
  expect(new URL(listing.images[0]).host).toBe('127.0.0.1:19199');
  expect((await page.request.get(listing.images[0])).ok()).toBe(true);
  await page.evaluate(async id => {
    const path = '/src/lib/nestmateBackend.ts';
    await (await import(path)).updateListingBackend(id, { ph: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5f8AAAAASUVORK5CYII='] });
  }, created.id);
  const updated = (await db.doc(`listings/${created.id}`).get()).data()!;
  expect(updated.images[0]).not.toBe(listing.images[0]);
  expect(updated.images[0]).not.toMatch(/^data:/);
  const failed = await page.evaluate(async () => {
    const path = '/src/lib/nestmateBackend.ts';
    try {
      await (await import(path)).createNewListingBackend({ title: 'Readiness failed photo draft', loc: 'Koramangala', city: 'Bengaluru', rent: 12000, ph: ['data:text/html;base64,PGgxPk5vdCBhbiBpbWFnZTwvaDE+'] }, null);
      return null;
    } catch (error) { return (error as { draftListingId?: string }).draftListingId || null; }
  });
  expect(failed).not.toBeNull();
  expect((await db.doc(`listings/${failed}`).get()).data()?.status).toBe('draft');
});
