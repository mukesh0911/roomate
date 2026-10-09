# NestMate Defect Log

Evidence date: 2026-10-09. Severity is product impact, not test inconvenience. Test/data/environment defects are listed separately so they are not misreported as product defects.

## Product defects

### BUG-001 — Client-side mock authentication could diverge from Firebase Auth

- **Feature:** Authentication / route guards
- **Severity:** P0
- **Reproduction steps:** Put a `nestmate_auth_session`/mock persona in local storage, reload a protected route, and compare the rendered identity with `auth.currentUser` and Firestore rule identity.
- **Expected:** UI identity, route identity, and Firebase authorization identity are the same authenticated user.
- **Actual:** Legacy helpers and production hydration paths could render a synthetic session that Firestore did not recognize.
- **Root cause:** Two authentication sources of truth and fake local-storage Playwright states.
- **Files:** `app/src/App.tsx`, `app/src/hooks/useAuth.ts`, `tests/global-setup.ts`, deleted fake-auth helpers and tracked `tests/.auth/*` artifacts.
- **Fix:** Removed production mock hydration; connected the Auth emulator only through explicit test mode; generated genuine Firebase sessions through UI login and persisted IndexedDB state.
- **Regression test:** `tests/auth/00-auth-foundation.spec.ts` (six cases), plus all 102 desktop/mobile browser cases.
- **Status:** FIXED / VERIFIED.

### BUG-002 — Admin authorization had hard-coded identity fallbacks

- **Feature:** Admin authorization and maintenance
- **Severity:** P0
- **Reproduction steps:** Authenticate with an email embedded in client/rule fallback lists without relying exclusively on `admins/{normalizedEmail}`.
- **Expected:** One authoritative admin registry controls both UI and backend access.
- **Actual:** Client and rules accepted hard-coded addresses; demo cleanup also protected named personal accounts in code.
- **Root cause:** Bootstrap shortcuts became authorization logic.
- **Files:** `app/firestore.rules`, `app/src/hooks/useAdmin.ts`, `app/src/pages/AuthPage.tsx`, `app/src/pages/admin/AdminSettings.tsx`.
- **Fix:** Registry-only authorization, safe token-email checks, registry-derived cleanup protection, neutral example placeholders.
- **Regression test:** Firestore admin rule cases; browser non-admin and admin route cases.
- **Status:** FIXED / VERIFIED.

### BUG-003 — Accepted-contact pairs could be forged without an accepted connection

- **Feature:** Connections / private contact access
- **Severity:** P0
- **Reproduction steps:** As an authenticated participant, create `acceptedPairs/a_b` naming another user but without a matching accepted connection.
- **Expected:** Pair creation succeeds only as part of a valid accepted connection transition with matching participants.
- **Actual:** Membership in the requested pair was sufficient.
- **Root cause:** Rules trusted caller-provided pair data and the client wrote acceptance in separate operations.
- **Files:** `app/firestore.rules`, `app/src/hooks/useConnections.ts`.
- **Fix:** Rules validate deterministic pair ID, accepted connection existence-after-write, and participant equality; client uses one batch for connection plus both directional pairs.
- **Regression test:** Firestore pair-forgery and accepted batch cases; connection browser tests.
- **Status:** FIXED / VERIFIED.

### BUG-004 — Chat participants could alter protected room data and spoof senders

- **Feature:** Chat / messaging authorization
- **Severity:** P0
- **Reproduction steps:** As a room participant, change `participants` or create a message whose `senderId` is another UID/`system`.
- **Expected:** Participants remain immutable; non-admin sender equals the authenticated UID.
- **Actual:** Broad room updates and unbound message sender fields were allowed.
- **Root cause:** Field-level invariants were absent from rules.
- **Files:** `app/firestore.rules`, `app/src/hooks/useChat.ts`.
- **Fix:** Exactly two accepted participants on create, immutable participants, update-key allowlist, sender binding, narrow read/edit transitions, caller-bound system-style events.
- **Regression test:** Firestore chat/message authorization cases; chat and multi-user browser suites.
- **Status:** FIXED / VERIFIED.

### BUG-005 — Authenticated callers could spoof arbitrary notifications

- **Feature:** Notifications
- **Severity:** P0
- **Reproduction steps:** Create a notification for an unrelated recipient with arbitrary trusted-looking content.
- **Expected:** Client-created notifications are caller/relation bound; privileged broadcasts use the admin path.
- **Actual:** Any authenticated caller could target any UID.
- **Root cause:** Notification create rule validated neither actor nor relationship.
- **Files:** `app/firestore.rules`, `app/src/hooks/useNotifications.ts`, notification call sites.
- **Fix:** Added schema, actor, recipient/relation, and supported-type constraints; call sites now include actor/connection identity.
- **Regression test:** Firestore spoofing/valid-event cases; notification browser cases.
- **Status:** FIXED / VERIFIED.

### BUG-006 — Storage objects were not bound to listing ownership or chat participation

- **Feature:** Firebase Storage
- **Severity:** P0
- **Reproduction steps:** As an unrelated authenticated user, upload/delete another listing's image or a chat attachment.
- **Expected:** Listing owner and room participants only; verification files owner/admin only.
- **Actual:** Authentication alone authorized several paths.
- **Root cause:** Path rules lacked Firestore ownership/participant checks.
- **Files:** `app/storage.rules`, `app/storage.rules.test.ts`.
- **Fix:** Firestore-backed listing/chat ownership checks and owner-bound verification paths.
- **Regression test:** 14 Storage emulator rule cases.
- **Status:** FIXED / VERIFIED.

### BUG-007 — Active production collections fell through to incorrect rule behavior

- **Feature:** Matches, support, broadcasts, moderation
- **Severity:** P1
- **Reproduction steps:** Use the product paths that create/read `matches`, `supportTickets`, or `broadcasts` as the intended role.
- **Expected:** Least-privilege rules match the product operations.
- **Actual:** Missing explicit blocks caused valid non-admin operations to be denied or governed only by catch-all behavior.
- **Root cause:** Product collections were added without synchronized rule contracts.
- **Files:** `app/firestore.rules`.
- **Fix:** Added explicit caller-bound matches, support-ticket creation, and admin-only broadcast contracts; normalized report operations.
- **Regression test:** Firestore rules suite.
- **Status:** FIXED / VERIFIED.

### BUG-008 — Listing draft state disagreed across product, rules, and fixtures

- **Feature:** Listing lifecycle
- **Severity:** P1
- **Reproduction steps:** Save or seed a listing with `status=draft` through normal rules.
- **Expected:** The lifecycle state used by UI and deterministic scenarios is accepted consistently.
- **Actual:** UI/fixtures used draft while rules and shared type rejected it.
- **Root cause:** Enum drift.
- **Files:** `app/firestore.rules`, `app/src/hooks/useListings.ts`, `app/src/pages/EditListing.tsx`.
- **Fix:** Added draft to the production status contract and owner-safe creation rule.
- **Regression test:** Firestore listing-state tests, seed verifier, listing browser suite.
- **Status:** FIXED / VERIFIED.

### BUG-009 — Admin reports used inconsistent fields and state counts

- **Feature:** Moderation / admin reports
- **Severity:** P1
- **Reproduction steps:** Open seeded pending/resolved/dismissed reports and compare displayed target/body/counts with stored records.
- **Expected:** `targetId`, `description`, and `pending|resolved|dismissed` are consistent.
- **Actual:** UI and seed paths mixed alternate fields/statuses; the metric counted all reports as pending.
- **Root cause:** Parallel report schemas.
- **Files:** `app/src/pages/admin/AdminReports.tsx`, `app/src/hooks/useAdmin.ts`, seed catalog.
- **Fix:** Canonical fields/state machine and pending-only metric.
- **Regression test:** Deterministic validator and admin browser suite.
- **Status:** FIXED / VERIFIED.

### BUG-010 — Seed/reset tooling could target the wrong backend and did not prove integrity

- **Feature:** QA data foundation
- **Severity:** P0
- **Reproduction steps:** Run legacy seed/reset commands with ambient Firebase configuration or inspect their project defaults and partial reset behavior.
- **Expected:** Destructive QA operations fail closed unless all services are local emulators and project is exactly `demo-nestmate`.
- **Actual:** Multiple competing seed paths contained shared-project assumptions, synthetic UIDs, stale fields, and incomplete reset behavior.
- **Root cause:** Accumulated scripts with different contracts.
- **Files:** `tests/data/emulator-universe.cjs`, `tests/seed/emulator-universe.cjs`, root scripts; obsolete seed/token scripts deleted.
- **Fix:** One canonical 17-persona registry; localhost/project guards; Auth/Firestore purge; 102-document deterministic seed; privileged and referential verifier; Storage fixture.
- **Regression test:** `npm run test:data` reports `RESET_OK`, `SEED_OK`, and `VERIFY_OK`.
- **Status:** FIXED / VERIFIED.

### BUG-011 — Listing detail lacked a page-level listing heading

- **Feature:** Room detail / accessibility
- **Severity:** P3
- **Reproduction steps:** Open a valid `/room/:id` and inspect the heading hierarchy.
- **Expected:** The listing title is the page H1.
- **Actual:** The title appeared only as breadcrumb/static text.
- **Root cause:** Visual title markup was not semantic.
- **Files:** `app/src/pages/RoomDetail.tsx`.
- **Fix:** Rendered title as H1 with flat-type/location subtitle.
- **Regression test:** Room-detail browser suite on desktop and mobile.
- **Status:** FIXED / VERIFIED.

### BUG-012 — Development seed utility was emitted in production bundles

- **Feature:** Build isolation
- **Severity:** P1
- **Reproduction steps:** Run `vite build` and inspect `dist/assets`; a `SeedData` chunk was present despite a development-only route.
- **Expected:** Destructive development utilities are absent from production artifacts.
- **Actual:** The route was gated but the lazy import was unconditional.
- **Root cause:** Import boundary did not share the environment guard.
- **Files:** `app/src/App.tsx`.
- **Fix:** Made both lazy import and route development-only.
- **Regression test:** Production build manifest contains no `SeedData` chunk.
- **Status:** FIXED / VERIFIED.

### BUG-013 — Account deletion is not an atomic or complete erasure workflow

- **Feature:** Settings / delete account
- **Severity:** P1
- **Reproduction steps:** Delete a persona with accepted pairs, chat messages, reports/reviews/verifications, analytics, and uploaded files; inspect dependent data after top-level deletion or interrupt the sequence midway.
- **Expected:** Complete, authorized, retry-safe erasure/anonymization with defined retention semantics and no dangling references.
- **Actual:** Client sequentially deletes selected top-level records, deletes shared chat-room documents without deleting message subcollections, omits accepted pairs and several collections/storage paths, and can partially fail before Auth deletion.
- **Root cause:** A cross-collection privileged workflow was implemented in an untrusted client with no transaction/job ledger or server cleanup.
- **Files:** `app/src/pages/SettingsPage.tsx`, Firestore/Storage model.
- **Fix:** Replaced browser-side deletes with the authenticated `requestAccountDeletion` callable Cloud Function. It requires a recent login and literal confirmation, removes user-linked documents, recursively deletes shared chat messages, purges profile/verification/chat/listing Storage prefixes, and deletes Auth last so earlier failures remain retryable. The confirmation UI explicitly states that shared conversation history is removed.
- **Regression test:** `npm run test:account-deletion` proves invalid confirmation is non-mutating and verifies Auth removal, 11 representative Firestore paths (including a nested message), Storage purge, and idempotent lost-response retry. A browser test also exercises the complete Settings UI and post-delete protected-route denial.
- **Status:** FIXED / VERIFIED ON EMULATORS.

### BUG-014 — Payment selection has no repository-side verification/fulfilment path

- **Feature:** Pricing / premium
- **Severity:** P1
- **Reproduction steps:** Select a paid plan and inspect the repository for server-side Razorpay signature verification and authoritative entitlement update.
- **Expected:** No payment or entitlement fulfilment is reachable while NestMate has no paid plan. A trusted backend must verify payment before any future premium launch.
- **Actual:** Pricing is informational/coming-soon and no paid checkout or entitlement grant is enabled.
- **Root cause:** Paid plans are intentionally out of the current product scope.
- **Files:** `app/src/pages/PricingPage.tsx`; no server package discovered.
- **Fix:** Product-owner decision on 2026-10-09: keep all paid plans disabled. Do not add Razorpay or payment secrets until a paid launch is separately approved.
- **Regression test:** Required future sandbox payment tests (success, forged callback, duplicate webhook, refund/reversal).
- **Status:** ACCEPTED / INACTIVE — NOT A CURRENT RELEASE BLOCKER. Must be reopened before enabling payments.

### BUG-015 — Static route metadata advertises an unavailable calculator route

- **Feature:** Navigation / SEO
- **Severity:** P3
- **Reproduction steps:** Compare sitemap/static route metadata with the React route table and navigate to `/calculator`.
- **Expected:** Advertised URLs resolve to product pages.
- **Actual:** `/calculator` has no route and lands on Not Found.
- **Root cause:** Static metadata drift.
- **Files:** static sitemap/route metadata identified in `QA/PRODUCT-MAP.md`.
- **Fix:** Not changed because the deployment/SEO owner must choose removal versus implementing the feature.
- **Regression test:** Future route-to-sitemap parity check.
- **Status:** OPEN — NON-BLOCKING P3.

## Classified non-product failures corrected during execution

| ID | Classification | Evidence | Correction | Status |
|---|---|---|---|---|
| DATA-01 | Data bug | Draft, expiry, notification, report, verification, public-PII and UID contracts disagreed | Rebuilt canonical emulator universe and validator | Fixed |
| TEST-01 | Test bug | Chat/listing/workflow tests used obsolete IDs and fake-auth injection | Bound all active tests to registry IDs and real storage states | Fixed |
| TEST-02 | Test bug | Notification test omitted visible delete action and raced the Firestore subscription | Accessible fallback selector and settled-state wait | Fixed |
| TEST-03 | Test bug | Mobile chat selected hidden preview duplicate; identity test assumed desktop full-name header | Thread-scoped last copy and profile-based identity proof | Fixed |
| ENV-01 | Environment bug | Playwright/Vite port ownership was ambiguous | Dedicated strict port 4173, no server reuse | Fixed |

## Release blockers

1. A production Firebase deployment, real provider configuration, and live external-service checks were intentionally not performed; all destructive QA ran only on `demo-nestmate` emulators.
2. Paid plans must remain disabled; BUG-014 must be reopened before any payment or premium entitlement launch.
