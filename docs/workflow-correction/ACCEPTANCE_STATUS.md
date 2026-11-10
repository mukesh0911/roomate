# Current workflow acceptance

## Rooms and Roommates audit — 8 November 2026

The new functional-audit brief authorizes correction of these existing flows. Verification for this checkpoint is being refreshed; older counts below retain their original source boundary.

- Room chat checks now carry the listing ID to the trusted interaction lookup. An active poster does not have to opt into Roommates discovery to receive a listing-specific consent request. Private profile reads remain denied.
- Room cards, details and roommate cards derive Connect, Pending, Accept/Decline and Message from the same UID pair and live consent state. An accepted current communication grant reuses the existing request and room; it does not charge another allowance. Listing consent remains distinct from an application or a person connection.
- Room fit uses budget (25 points), city/locality (20), declared gender eligibility (20), actual household/lifestyle comparisons (20), and room/occupancy fit (15). Missing information earns no points. ID verification is displayed independently and contributes no compatibility points.
- Person fit uses city/locality (25), budget ratio (25), lifestyle (30), room preferences (10) and occupancy (10). Lifestyle credit uses at least five possible comparisons, so one shared answer cannot produce 100%. Stored preference aliases are normalized; pair scores are symmetric. Cross-city and explicit listing-gender conflicts retain caps. Scores are deterministic evidence-based fit indicators, not probabilities.
- Server-computed person scores and their explanations travel together without exposing private quiz answers. Actual declared budget and move-in date supply the corresponding card fields. Room cards and details share the room-fit helper and canonical rent. Missing detail preferences are labelled as missing rather than invented habits.
- Listing creation still enters review. A published room does not automatically make a landlord a discoverable roommate: the account must explicitly opt in and have an eligible housing intent. This preserves the existing privacy and live-in-host contracts.

> Console-error follow-up, 8 November 2026: the supplied log contains 22 image URL entries, all truncated to exactly 4,096 characters, and three interaction-context 403 responses. Raster image projection now preserves the complete bounded payload instead of slicing it. Chat hydration supplies its room ID; the gateway verifies both participants before disclosing minimal historical peer identity, without granting send permission. Foreign/mismatched rooms remain denied. Global landing-image preloads were removed because Explore does not use those images. Follow-up checks: 26 Functions tests and 35 focused client tests pass, as do TypeScript, focused lint, production build and Functions/shared-module checks. [Console-error evidence and limitations](../maintenance/console-errors-validation-2026-11-08.json). The earlier full-suite hashes below describe the preceding checkpoint, not this follow-up.

> Narrow approved deployment, 8 November 2026: the updated fetching implementation of `readDiscovery` and `getInteractionContext` is live in `us-central1`. Both CORS preflights return 204, a public listing read returns 200 with no publisher identity, and anonymous member/context requests return 401. [Deployment evidence](../maintenance/discovery-deployment-2026-11-08.json). The broader release is not deployed or accepted, and artifact cleanup policy remains unset. Historical no-deployment statements below describe their original checkpoints.


8 November 2026. Application changes are authorized by the later workflow-correction brief. This checkpoint records local implementation and test evidence; it does not authorize deployment or production migrations. The product is not yet fully accepted for release.

> Latest fetching checkpoint, 8 November 2026: 486 source tests, 23 Functions tests and 32 full workflow checks (19 backend/security and 13 browser) pass. The full run reports no source changes. Discovery outage/retry, chat refresh/history failures, account-switch isolation and unread races have regression coverage. TypeScript, lint and production build pass. Earlier checkpoints below remain historical.

> Repository cleanup, 8 November 2026: obsolete scripts, screenshots and historical reports were moved to an external recovery backup. The workflow/browser/rules artifacts below retain their original checkpoint hashes; they are not a new post-cleanup browser run. Post-cleanup checks pass: 474 source tests, type/lint/build/Functions checks, zero broken local documentation links and zero missing referenced public images. See [cleanup validation](../maintenance/cleanup-2026-11-08.json).

## Completed in this continuation

- Concurrent discovery reads are deduplicated per signed-in account without retaining completed permission responses. Transient reads retry once, malformed pagination fails explicitly, and an optional invalidation listener failure cannot erase a successfully loaded feed. Landing and discovery provide real retry states.
- Chat hydration uses bounded concurrency and one interaction-context read per room. Query failures preserve loaded conversations; failed history is visibly unavailable. Read cursors advance only through the displayed last message, preserving concurrently arriving unread messages.
- Export and broadcast controls default to unavailable until their callable, worker and Storage lifecycle are deployed and accepted. Set `VITE_ACCOUNT_EXPORT_ENABLED` or `VITE_BROADCASTS_ENABLED` only for an accepted environment. The isolated browser suite explicitly enables and exercises these services. Unsupported broadcast audience and estimated delivery counts were removed.
- Private exports run through an authenticated callable, trusted job and private Storage download. They stream compressed NDJSON containing current account records, owned listings and shared history, with file references rather than embedded asset bytes. Peer private account fields and internal application/review fields are excluded. Records are read over time; this is not an atomic database snapshot or a complete legacy-data export.
- Recent authentication is enforced for starting and downloading an export and at the Storage read boundary. Completed files expire after 24 hours. Retry, upload failure, generation replacement and cleanup have real emulator evidence. Browser download succeeds through the actual SDK callable wrapper and worker implementation.
- Administrative broadcasts use durable, server-only jobs, stable recipient notification IDs, page cursors, leases, retry and actual delivered counts. A forced second-page failure resumes without duplicate delivery/counting. Restricted accounts and broadcast opt-outs are excluded. Queued/partial delivery is not reported as complete.
- Chat drafts and focus survive live room updates; sends retain a stable retry identifier, and a reordered room list retains the selected room ID. The browser test forces a snapshot while a draft is being composed.
- Settings now persist roommate discovery opt-in and community broadcast preferences. Unsupported privacy/email controls have been removed, credentials follow the actual sign-in provider, and disabled account deletion is visibly unavailable. Browser acceptance verifies saved preferences across reload and independent-principal discovery exclusion.

- The existing support action and footer Help links now resolve to `/help`. Signed-in members can submit a private ticket and receive an actual stored reference. Help is included in the sitemap. Newsletter fields are disabled while subscriptions are unavailable; no false subscribed state is shown. Staff ticket handling remains separate work.

## Verification

| Gate / command | Current evidence | Boundary |
| --- | --- | --- |
| `npm.cmd --prefix app run check` | PASS | TypeScript project. |
| `npm.cmd --prefix app run lint -- --format json --output-file ../docs/workflow-correction/lint-results.json` | PASS: zero errors, two existing AdminPage dependency warnings | No lint rule disabled. |
| `npm.cmd --prefix app run build` | PASS | Current fetching, chat and service-availability changes included. Bundle splitting notices remain non-fatal. |
| `npm.cmd --prefix app test -- src --maxWorkers=1 --reporter=json --outputFile=../docs/workflow-correction/unit-results.json` | 486/486 PASS | Includes discovery deduplication/retry/account isolation, chat error/read races and unavailable-service guards. |
| `node --test app/functions/accountJobs.node-test.cjs app/functions/productionReadiness.functions.node-test.cjs app/functions/accountDeletion.node-test.cjs app/functions/discoveryGateway.node-test.cjs app/functions/privacyCompatibility.node-test.cjs` | 23/23 PASS | Request-scoped account reads preserve order and fresh restrictions; export retries require recent authentication. |
| `npm.cmd --prefix app/functions run check` | PASS | Syntax and generated shared-module consistency. |
| `node scripts/run-workflow-emulators.cjs` | 19 backend/security groups + 13 browser checks PASS, no source changes during run | Includes actual discovery outage/retry, settings, support, export, consent, applications, chat and three viewport checks. |
| `node scripts/run-workflow-emulators.cjs --regressions` | 72/72 PASS | 58 Firestore and 14 Storage assertions against the current unchanged rules. |
| `node scripts/run-workflow-emulators.cjs --browser-only` | Historical 12/12 PASS | Superseded for current source by the thirteen browser checks in the full run above. |

Evidence: [fetching checkpoint](../maintenance/fetching-validation-2026-11-08.json), [full workflow run](emulator-results.json), [current rules](rules-results.json), [historical browser continuation](browser-only-results.json), [source tests](unit-results.json), [lint](lint-results.json). The earlier reports and progress entries describe historical checkpoints and must not override this table.

The isolated project is `demo-nestmate-workflows`, using Auth 19080, Firestore 18180, Storage 19180, browser/Vite 4186 and loopback callable HTTP 19501. The HTTP host executes actual exported Firebase SDK callable middleware and real emulator Auth verification. Its local dispatcher invokes the real job implementation. It does not establish Firebase CLI worker bootstrap, deployed background events, scheduler delivery, indexes, monitoring or production readiness. Source hashes and `sourceChangedDuringRun` distinguish full-run evidence from later renderer changes. Reset-capable suites run sequentially.

## Required 25-scenario baseline

PASS applies only to the named automated contract. NOT VERIFIED identifies acceptance still needed; BLOCKED identifies a missing product or operational prerequisite.

| # | Scenario | Status | Evidence and boundary |
| --- | --- | --- | --- |
| 1 | New person Connect | PASS | Actual backend command, authenticated independent principals, atomic request/allowance/recipient notification. |
| 2 | Duplicate request prevention | PASS | Same-direction retries and simultaneous reverse writes; one pair request and one quota charge. Unit regression reconciles a losing transaction. |
| 3 | Recipient acceptance | PASS | Person consent with real rules; listing consent accepted through the existing Connections UI. |
| 4 | Decline then new request | PASS | Prior rejection retained; subsequent request has a new ID. |
| 5 | Pending state across all pages | NOT VERIFIED | Backend rejects premature messaging and browser received-request action works; complete cross-page stale-state matrix remains. |
| 6 | Accepted permission enables both members | PASS | Both principals resolve the same authorized room; actual send/read and recipient browser message delivery verified. Reverse browser composition remains additional coverage. |
| 7 | Rooms conversation becomes Message in Roommates | PASS | Two-session browser reuses listing permission and sends a real message without a person connection. |
| 8 | Same person across discovery sections | PASS | Browser Rooms/Roommates uses the same fixture UID and conversation; deep-link profile and Saved completeness require additional coverage. |
| 9 | Disconnect denies new messages | PASS | Real backend/rules denial with existing history retained. |
| 10 | Global block prevents communication | PASS | Backend/rules deny request, application and send; Storage permission checked separately. Every stale open UI is not yet covered. |
| 11 | Unblock does not restore consent | PASS | Stored revocation epoch prevents reuse of old accepted consent. |
| 12 | Rooms Message requests/reuses listing conversation | PASS | Founder-approved initial consent flow and subsequent shared room reuse in browser. |
| 13 | Apply is independent | PASS | Browser submits answers and owner receives an actionable application; listing consent alone no longer creates an applicant card. |
| 14 | Multiple independent applications | PASS | Independent records and locks under real rules. |
| 15 | Shortlist leaves other applicants unchanged | PASS | Real transaction plus owner browser shortlist. |
| 16 | Selection does not fill listing | PASS | Listing remains active and the other application remains pending after selection. |
| 17 | Applicant declines selection | PASS | Actor-specific transition under real rules. |
| 18 | Applicant withdraws | PASS | Actual withdrawal command and persisted terminal stage. |
| 19 | Host rejects | PASS | Actual owner rejection with actor enforcement. |
| 20 | Rejection preserves authorized conversation | PASS | New message succeeds after rejection without changing the independent communication grant. |
| 21 | Delivery and deduplication | NOT VERIFIED | Atomic request/message/application writes and durable multi-page broadcast fan-out, failure/retry and deterministic delivery counts pass. Complete notification destination coverage remains unverified. |
| 22 | Profile/intent changes affect discovery | NOT VERIFIED | Saved discovery opt-out survives reload and excludes the member from an independent viewer gateway request. Intent/locality source regressions pass; full Save/Discard and live propagation remain unverified. |
| 23 | Availability stays consistent | NOT VERIFIED | Canonical status and no-auto-fill contracts pass; every existing availability transition and stale discovery page remains unverified. |
| 24 | Concurrent PG inventory cannot oversubscribe | BLOCKED | Existing display options do not define a reviewed atomic occupancy/allocation operation. No reservation or occupancy policy was invented. |
| 25 | Admin/moderator capabilities | PASS | Moderator positive report access, denial of staff grants/private ID, administrator exact-version review and no identity-driven publication. Full staff UI and delivery operations remain additional acceptance work. |

## Remaining local work

1. Complete stale open-session UI invalidation, full notification destinations, paged-history browser coverage, profile draft/avatar cancellation, Saved tombstones and listing availability propagation. Rules already reject restricted writes; every old view has not been accepted.
2. Finish staff support-ticket handling, remaining content/legal destinations, unsupported settings cases, legacy route cleanup and full staff UI acceptance. The help page and ticket submission are locally verified. Email delivery and category-specific notification suppression are unavailable, not completed features.
3. Reconcile legacy listing-attributed request/application provenance. Plain listing consent is not an application; records with explicit legacy application metadata remain read-only.
4. Complete the broader keyboard, focus, error and screen-reader acceptance matrix. The passing three viewport checks cover actual loaded detail views, not every view.

## Release prerequisites requiring separate evidence

- Keep account deletion disabled until current/legacy collection and bucket coverage, callable-to-UI execution and deployed worker lifecycle are reviewed. The founder's policy is retained shared messages for peers with the deleted member identity removed. Stable opaque history references and user-authored message contents remain; semantic message redaction was not promised.
- PG allocation remains blocked on a reviewed atomic occupancy policy. Application selection never fills or reserves inventory; no booking or payment behavior was invented.
- Stage endpoint/shared-module/index/invalidation deployment, compatible readers and restrictive rules in a reviewed sequence. Never reopen unsafe private reads as rollback compatibility.
- Run remote CI and staging acceptance, verify configuration/bucket CORS and job triggers/scheduler, reconcile legacy inventory and establish monitoring/rollback ownership. Local test passes do not establish branch protection or deployment success.

No commit, push, production migration, inventory modification or production reset was performed. Only the two explicitly approved discovery functions have deployment authorization; see the deployment record above. Pre-existing workspace modifications and deletions remain intact.
