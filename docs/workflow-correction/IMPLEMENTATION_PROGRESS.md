# Existing workflow correction — implementation in progress

Updated 6 November 2026 (Asia/Calcutta). This is an active implementation checkpoint, not a completion or release certificate. The implementation brief in attachment `2364ab2d-f57d-4e8b-bb70-679d56a69e90` supersedes conflicting blueprint proposals. No deployment, production migration, production fixture reset, or production data mutation is authorized or performed.

## Latest continuation

The 523-error lint blocker has been removed without disabling rules: the existing JavaScript renderer is isolated behind a typed React lifecycle and is explicitly included in the same ESLint checks. Function-scoped bindings retain their original hoisting. Undefined staff-sort and report/email-action references were corrected. Source regression coverage now passes 473 tests. Canonical URL serialization, person/chat entity parameters, browser history and the PG share ID are implemented; source modules remain frozen for current validation. The sitemap now lists only existing public destinations and the README describes actual capabilities.

Person disconnect writes a scope-specific monotonic revocation epoch, preventing older person-consent aliases from re-authorizing communication while preserving separate listing consent. Raw display-field interpolation is escaped before sanitization. Expanded browser tests cover malicious listing/profile/notification text and query preservation through Back/reload. An intermediate rule-expression budget failure was corrected; all 17 backend/security groups then passed. The subsequent Back-button browser failure was fixed through explicit router synchronization. The final targeted browser run passes all nine checks on unchanged source, including selected-chat reload, with zero page errors. This is separate browser evidence; the earlier full-run artifact retains its pre-fix browser failure. The final current-rules regression sweep passes all 71 tests.

## Confirmed product decisions for this phase

- A declined request remains historical; a later Connect uses a new request ID.
- Disconnect revokes person-level communication and preserves history.
- Listing communication permission, person connections, applications and global blocks remain distinct.
- Founder clarification: a first Rooms Message requests **listing-specific consent**; the poster must accept before chat opens. A separately authorized conversation is reused across discovery sections without creating a person connection.
- Applications independently support pending, shortlisted, selected, rejected, withdrawn and declined-by-applicant states. Selection changes neither listing availability nor other applications.
- Existing numeric request allowance is retained. No new monthly renewal, paid plan, expiry duration, retention period or occupancy-confirmation policy is silently introduced.
- D17 founder answer on 6 November: keep shared messages for peers and remove the deleted member's identity. This resolves peer-message treatment; the legacy recursive room/storage deletion handler has been replaced with a retryable service and worker, which remain disabled pending coverage review. The configured Storage bucket is now used, and the callable is gated as well as the UI.

## Changes implemented so far

| Area | Changes | Verification boundary |
| --- | --- | --- |
| Shared records | `listingTruth.ts` provides canonical persisted rent aliases, truthful lifecycle labels and communication restriction helpers. `applicationState.ts` defines actor-specific applicant transitions. | Unit contracts; fresh full run pending after latest changes. |
| Requests | New history IDs, two-direction pair serialization, atomic allowance/request/recipient event, explicit recipient decisions and retained withdrawal history. | Earlier isolated real-rules scenarios passed; latest source frozen-run result must be checked. |
| Communication | Separate person/listing permission mirrors; current authorization before room reuse; immutable pair room registry; listing contexts retained; explicit disconnect. | Earlier isolated real-rules scenarios passed. Registry/context additions require latest run. |
| Global restrictions | Both users' blocks/account states checked by Firestore and Storage. Block revokes current consent; revocation timestamps prevent direct unblock writes restoring old consent. | Earlier block/unblock and Storage scenarios passed. Additional direct-write revocation checks remain to finish. |
| Messaging | Idempotent client message IDs, transactional message/summary/recipient event, per-member unread state, actual date labels, private Storage paths and authenticated attachment reads, bounded latest history and explicit earlier-page loading. | Earlier transactional message/unread/Storage checks passed; history UI and latest policy must be retested. |
| Applications | Separate application records and locks, question-answer/version snapshot, own withdrawal/decline, independent owner stages, actual owner listeners and existing applicant controls wired to application commands. | Earlier multiple-applicant/selection/rejection/withdrawal scenarios passed; latest UI check pending. |
| Discovery/entities | URL handoff for location/budget/move-in; predicates before bounded page collection; cursor tracks consumed records; direct ID resolution for shared/Saved/Connections/chat profile entry; fictional featured inventory removed. | Source contracts/unit checks; browser validation in progress. |
| Matching/truth | Active renderers use the existing shared matching engine; invented viewer lifestyle/move-in/phone verification claims removed. | Latest source and missing-factor presentation still need review. Existing algorithm weights are preserved. |
| Profile | Basic edits preserve undisplayed locality preferences; avatar upload stages the URL and only Save publishes it. | Profile regression tests passed; browser Save/Discard validation remains. |
| Staff | Actual rent/status/identity field adapters, real environment and zero series, moderator removed from blanket administrator/Storage authority; restricted staff data queries; sanction before final report resolution; honest secondary-operation feedback. | Moderator direct-access denials passed; positive moderator coverage and staff workflows remain. |
| Identity review | Exact displayed document path plus pending-state transaction, coherent trust mirrors and owner notification; no property auto-publication. Dormant automatic-approval entry fails closed into current review. | Versioned-review regression cases added; emulator/browser review still needs completion. |
| SDK | Installed Firebase 12.13.0 to address reproduced `ca9/b815` assertion. The official release notes identify the race fix in this version. | Latest browser suite must establish whether the reproduced failure is resolved. |

## Evidence and current gates

The current acceptance matrix is [ACCEPTANCE_STATUS.md](ACCEPTANCE_STATUS.md). It supersedes the intermediate run notes below: 24 unchanged-source workflow/emulator/browser checks and 71 Firestore/Storage regressions now pass. The additional featured Saved journey persists after reload and handles a real ID beginning with `f`. The D17 worker test retains 207 messages and an attachment through two injected failures, removes owned private data/assets, and denies stale-session resurrection. Eleven Functions/worker regressions pass. The worker in `app/functions/accountDeletion.js` is wired through the callable and background trigger, with availability explicitly disabled. The legacy recursive handler has been removed. Local service/worker acceptance does not establish deployed event delivery or complete legacy data coverage. Hosted CI has not run. That checkpoint had 523 lint errors; the latest continuation above supersedes it with zero errors and two staff-effect warnings.

### Historical implementation notes

The intermediate pending and failed runs below are superseded by the current acceptance checkpoint above.

Continuation on 6 November: request conflicts now retry against the committed pair lock, with a dedicated regression proving no second quota write. Attachment writes require the authenticated uploader's path and an absent existing object; real Storage tests now reject both overwrite and foreign-uploader paths. Category cards carry durable room-type/managed-stay URLs, discovery includes hostels and city text consistently, and missing detail matching factors display Unknown. Hosting CI now depends on the reusable type/source/Firestore/Storage validation job; no deployment was run and the hosted CI execution is not yet verified.

- `npm.cmd --prefix app run check`: **PASS**, exit 0 on this continuation.
- Targeted `productionReadinessBackend.test.ts`: **22 tests PASS** before the additional category test was added; the fresh full source run below supersedes this only when complete.
- Latest completed isolated run: **13 backend/rules/Storage groups PASS**, including reverse-request serialization and uploader/overwrite denials; browser failed waiting for the lazy Explore route (screenshot shows Loading NestMate). Source hashes stayed unchanged throughout that run.
- Current isolated run adds positive moderator report access and stale-document identity review: **15 backend groups PASS so far**; browser completion remains pending. A preceding browser run passed listing consent and shared-room messaging, then failed the applicant shortlist interaction. That failure is still open, not a completion claim.

- A completed intermediate source run passed **466 assertions in 42 test files**. Later source changes mean this is historical evidence, not a final pass.
- A subsequent broad run had a timing benchmark failure (`26.1 ms` versus the existing `15 ms` threshold) while other work ran concurrently. The threshold has not been weakened; rerun under an appropriate isolated workload.
- A completed intermediate isolated Firebase run passed **12 workflow groups**, including real Firestore authorization, transactional messages, independent applications, global blocks and Storage access.
- Browser testing reached the actual listing Message action and reproduced a Firebase SDK internal assertion. Firebase was updated based on [official release notes](https://firebase.google.com/support/release-notes/js#version_12130_-_may_7_2026). A later emulator startup failed its redundant rule upload; the runner now uses the CLI-loaded files and refuses to report stale results as fresh.
- Latest artifacts: `unit-results.json`, `emulator-results.json`, `browser-results.json`, `run-progress.json`. Inspect timestamps and `sourceChangedDuringRun`; only a completed run against unchanged source can support final acceptance.
- Several production bundles and TypeScript checks passed during implementation. Repeat final checks after source is frozen.

## Remaining work — do not mark complete

1. Expand the passing two-session journeys to profile drafts, complete notification destinations, deeper history, Saved tombstones, publication transitions and full accessibility coverage.
2. Finish deletion coverage review and deployed callable/job/UI acceptance before enabling account deletion; preserve the founder's peer-history policy. The lint gate now passes; retain the distinction between lint, runtime and deployment evidence.
3. Verify live permission invalidation, history pagination, own application notification navigation, Saved tombstones, profile draft cancellation, listing state propagation and question-answer comparison.
4. Complete remaining independent existing workflow defects: public/private discovery source cutover; legacy request/application compatibility; durable broadcast delivery; remaining privacy/settings/data/support operations; stale route/CI/documentation contracts. Do not equate truthful unavailable feedback with completed functionality.
5. Record exact changes, final PASS/FAIL/BLOCKED/NOT VERIFIED matrix against the brief's 25 scenarios and prior findings, and required index/rule/client deployment order.

## Decisions / rollout prerequisites requiring explicit review

| Item | Why it cannot be silently decided | Available next step |
| --- | --- | --- |
| Legacy listing-attributed connections as applicant records | Historical consent status is not a reliable application-stage history. Rewriting or inventing stages would change existing user data. | Reviewed compatibility adapter/backfill manifest with explicit provenance; new independent applications work without rewriting old consent. |
| Private discovery source cutover | Existing source documents remain broadly readable. Stronger source rules need compatible projection coverage/readers; blindly switching all clients can hide legacy inventory. | Stage trusted projection generation and coverage verification, approve any backfill and client/rule cutover; no permissive fallback should be called a privacy fix. |
| Account erasure / peer conversation retention | Founder chose retained peer messages with removed account identity. The legacy destructive handler has been removed. The replacement callable/service/background worker is wired but disabled; current/legacy bucket, prefix and record coverage still needs review. | Keep the public callable gated; complete the reviewed manifest and validate durable trigger delivery and an isolated callable-to-UI journey before enabling it. |
| Publication and capacity | Identity review is not property/content approval. Selected applicants are not occupants. Existing PG display options do not establish an atomic inventory-allocation contract. | Preserve current publication rules for legacy listings; identify actual capacity-mutating operations before adding any occupancy/reservation mechanism. |
| External legal/help content and delivery services | A route, stored broadcast or UI toast is not reviewed legal content, a support reply, email delivery or a completed fan-out. | Use actual approved content/providers and tracked operation results; preserve explicit unavailable state where genuinely blocked. |

The existing repository already had extensive modified/deleted/untracked files before this implementation. Do not reset or restore those changes, and do not attribute the complete Git diff to this phase. Application code and local emulator fixtures changed in this phase; the original blueprint source-integrity result remains a historical analysis-phase artifact and must not be rerun to imply the app is unchanged now.


## 7 November 2026 ? private discovery implementation

Replaced active discovery, featured inventory and peer profile reads with allowlisted callable adapters over existing records. Account/listing source reads now require ownership or full administrator access. Added shared generated matching/intent contracts with a drift check, authenticated person discovery, either-direction block filtering, restricted-owner inventory filtering and a non-identifying invalidation signal. Anonymous physical cards exclude publisher identity. Added scope-specific peer permissions instead of loading private peer records in client transactions. Fixed hidden-record cursor continuation, server score rendering and accidental viewer-name attribution. Restored the older-message loader after the production build caught its missing export. Moderator report loading no longer queries private account/listing collections.

Current evidence: 474 source tests pass; production build passes; 17 Functions tests pass; full lint had zero errors/two existing AdminPage warnings. The initial updated 71-test rules sweep passed before the legacy-contact update rule refinement. The first combined workflow/privacy run is a failure, not release evidence: a concurrent rules sweep reset shared fixtures, legacy contact fields exposed an unrelated-update incompatibility, and callable worker startup prevented the Featured assertion. Corrected the legacy update rule, added a dedicated regression and callable worker warm-up; sequential backend, final rules and browser verification remain in progress. Never run suites that clear the same demo project concurrently. No production data was read or written.


Final checkpoint: the sequential backend run passes all 18 groups. Firestore passes 58 assertions; the Storage-only retry passes all 14 assertions after a cold setup timeout in the combined run. The final production build exits 0. An initial head refresh could supersede requested room resolution; the renderer now avoids starting another page read while one is loading. All five main browser workflows pass with that guard. The malicious-name fixture exceeded the new 80-character response limit; the expectation now checks the exact bounded literal, and the focused security check plus 390/768/1440 layouts pass on identical application source. All nine checks have evidence, across two runs; the original failed artifacts remain. The local HTTP host uses actual exported onCall wrappers and real emulator Auth, without replacing authorization logic. The Firebase CLI worker bootstrap and background/deployed delivery remain unverified. See privacy-validation-report.json and current acceptance for remaining work.


## 8 November 2026 - Account jobs and settings continuation

Implemented private export jobs/download/expiry/cleanup, server-only durable broadcast fan-out and retry counts, and live chat draft/room-selection preservation. The actual HTTP callable + worker + Storage browser download passes. A full frozen-source run passes 19 backend/security groups and 10 browser checks. A fresh sequential regression sweep passes all 72 Firestore/Storage assertions. Functions Node checks pass 22/22.

Settings subsequently gained persisted discovery opt-in and broadcast preferences, provider-aware credential controls and an explicitly disabled deletion action. Unsupported privacy/email switches no longer imply saved functionality. TypeScript, lint and build pass. The final settings browser repeat passes 11/11 on unchanged source with zero page errors; the source-suite repeat passes 474/474. See ACCEPTANCE_STATUS.md for the current result, rather than historical counts above. Deletion remains disabled and no production action occurred.


### Help and support completion checkpoint

Added `/help` with actual signed-in support-ticket submission, stored reference receipts, preserved form errors, workflow guidance and existing support navigation. The route is included in the sitemap. Unsupported newsletter inputs are visibly disabled and no longer display a false subscribed state. Staff ticket handling and remaining legal/content routes are not claimed complete.

The final twelve-check browser run passes on unchanged source with zero page errors, including real ticket persistence and an unrelated principal's denied read. TypeScript, zero-error lint (two existing warnings), and production build pass after these changes. The source regression repeat passed 474 tests before this final help/footer addition; the final browser/type/build checks cover the added UI. Unchanged backend/security code retains 19 passing groups, 22 Functions tests and 72 Firestore/Storage assertions. account-jobs-validation.json reconciles the actual source hashes. No deployment or production action occurred.


## 8 November 2026 - Repository cleanup

Moved 1,470 reviewed obsolete artifacts into the verified external recovery backup rather than discarding uncommitted work. The project root now contains seven configuration/documentation files; maintained scripts contain twelve build/test tools. Archived historical reports, screenshots, one-off patch/debug tools, unused reference assets and fifteen unreachable legacy modules. Current product contracts, tests, service/rule source, configured environments and referenced assets remain.

Runtime dependencies are reduced from 63 to 9, including removal of the obsolete root-package link. npm removed 179 installed packages. Obsolete Leaflet styles and map/chart chunks are gone. Documentation now has a current index, architecture/database boundaries, local setup, release process and testing guide. Post-cleanup type/lint/source/build/Functions and documentation/asset integrity checks pass; all 474 source tests pass. Older browser/emulator evidence is retained with its original checkpoint boundary, not relabeled as post-cleanup verification. See ../maintenance/cleanup-2026-11-08.json for recovery location and results. No deployment or production change occurred.


## 8 November 2026 - Fetching and data-flow recovery

Added per-account concurrent discovery deduplication, bounded transient retries, response validation and nonfatal optional invalidation. Failed refreshes preserve existing data. Landing and discovery expose real retry states and incomplete roommate profiles receive an actionable prompt. Chat hydration is bounded, reuses interaction context, preserves conversations on query failure, reports unavailable history and advances unread state only through the visible last message. Server account reads are scoped to each request, retain query order and recheck restrictions on subsequent requests. Export retry requires recent authentication. Missing export/broadcast services remain disabled by default; unsupported broadcast audience and manufactured recipient estimates were removed.

Current verification: 486 source tests, 23 Functions tests and the full 32-check emulator/browser run pass, with sourceChangedDuringRun=false. TypeScript, lint (zero errors, two existing warnings), production build and Functions/shared-module checks pass. The live deployment scope remains only the two previously approved discovery functions; see the separate deployment record. Broader acceptance and release prerequisites remain in ACCEPTANCE_STATUS.md.


## 8 November 2026 - Rooms and Roommates functional audit

Traced private Firestore sources, trusted discovery projections, canonical rent adapters, pair locks, consent grants, room membership and UI relationship actions. Found a missing listing context in chat preflight, unconditional Message labels on room cards, connection updates that only refreshed roommate views, missing-data match bonuses and verification-based compatibility inflation. Corrected these paths using the existing UID, relationship, consent and matching contracts. Accepted permission reuses its request instead of charging another allowance. Normalized mixed-schema preferences and kept opted-out historical contacts out of discovery. Removed invented budget bands and hardcoded roommate counts.

The expanded test workflow creates a real review-pending listing, verifies publication through authorized review, checks All/Rooms identity-price-score consistency, exercises listing consent independently of roommate opt-in, and tests pending state in All/Rooms/Saved/Roommates, acceptance, decoded images, messages and private discovery opt-out with independent authenticated principals. A first browser pass caught the stale room-card render; a later pass completed all 34 checks but correctly failed its unchanged-source gate because the renderer was corrected during the run. Final frozen-source acceptance and deployment evidence are recorded in ACCEPTANCE_STATUS.md.
