# NestMate Deterministic Test Data Catalog

**Target:** local Firebase Emulator Suite only  
**Project allowlist:** `demo-nestmate`  
**Reference epoch:** fixed by the seed runner (`2026-10-01T06:00:00.000Z`) so ordering and freshness do not depend on wall-clock time; freshness tests may pass an explicit clock or seed relative to a declared run clock.

No scenario may use a production/shared Firebase project, a real user, random IDs, `Date.now()` in assertions, or UI-created setup that another test silently depends on.

## Persona registry

All authenticated personas require a real Firebase Auth emulator account whose UID exactly matches the Firestore document ID. Passwords are test-only environment values and must not be committed as live credentials.

| Key | UID | Role/state | Required records | Primary scenarios |
|---|---|---|---|---|
| `ANONYMOUS` | none | No session | None | Public routes, auth gates, public Firestore reads |
| `SEEKER_A` | `qa_seeker_a` | Active, onboarded seeker, verified, free, 0 connects | public/private/contact profile; saved arrays | Discovery, filters, send interest, reports |
| `SEEKER_B` | `qa_seeker_b` | Active, onboarded seeker, verified, free | profiles; accepted relation/chat with owner A | Second user, existing/read-unread chat |
| `SEEKER_WEAK` | `qa_seeker_weak` | Active seeker, conflicting quiz | profile | Weak/dealbreaker match |
| `SEEKER_OTHER_CITY` | `qa_seeker_other_city` | Active seeker in Chennai | profile | City filter/cross-city fallback |
| `OWNER_A` | `qa_owner_a` | Active onboarded owner, identity approved | profile, verification, contact, portfolio | Listing lifecycle, applicants, chat |
| `OWNER_B` | `qa_owner_b` | Active onboarded second owner, approved | profile, listing/contact | Cross-owner isolation |
| `OWNER_PENDING` | `qa_owner_pending` | Owner, `SUBMITTED` | profile, UID-keyed verification, pending listing | Pending verification gate |
| `OWNER_REJECTED` | `qa_owner_rejected` | Owner, `REJECTED` | profile, verification/note, pending listing | Rejection and resubmission |
| `OWNER_RESUBMIT` | `qa_owner_resubmit` | Owner, `RESUBMISSION_REQUIRED` | profile, verification/note | Resubmission loop |
| `ONBOARDING_INCOMPLETE` | `qa_incomplete` | Active, no role, incomplete | minimal public/private profile | Role select and guards |
| `SUSPENDED_USER` | `qa_suspended` | Suspended seeker | profile; historical connection | Account and write restrictions |
| `BANNED_USER` | `qa_banned` | Banned seeker | profile; historical report | Account and write restrictions |
| `ADMIN` | `qa_admin` | Active onboarded user plus `admins/{email}` registry doc | public/private profile + admin doc | All back-office actions |
| `PREMIUM_USER` | `qa_premium` | Active premium seeker, quota counter 5 | profile | Premium quota bypass |
| `QUOTA_EXHAUSTED` | `qa_quota` | Active free seeker, counter 5 | profile | UI and rule quota boundary |
| `UNRELATED_USER` | `qa_third_party` | Active seeker, no relationships | profile | Unauthorized document/storage/chat access |
| `DISPOSABLE_USER` | `qa_delete_me` | Active seeker with dependent data | profile, private/contact, connection, room/messages, notifications, report/review, storage | Account deletion integrity |

## Profiles and matching

| Scenario | Exact data |
|---|---|
| Strong match | `SEEKER_A` and `SEEKER_B`: same city/locality range, overlapping budgets, identical complete quiz; expected high score and no dealbreaker |
| Weak match | `SEEKER_WEAK`: different schedule/cleanliness/food preferences; expected lower score with explicit caveats |
| Dealbreaker | `SEEKER_WEAK.quizAnswers.smoking=regularly`, `SEEKER_A.preferences.smoking=never/dealbreaker` | 
| Different city | `SEEKER_OTHER_CITY.city=Chennai`; request Bengaluru first, then explicit disclosed fallback |
| Missing profile | `qa_profile_incomplete_named` has role but empty name or incomplete onboarding; must not appear in discovery |
| Restricted profile | suspended/banned personas; must not appear in public discovery |
| Saved data | `SEEKER_A.savedProfileIds=[qa_seeker_b]`, `savedRoomIds=[qa_listing_active]` |
| Orphan saved IDs | separate negative persona/data copy with one missing ID; UI must not invent a record |

## Listings

| Key / ID | Stored state | Owner | Exact distinguishing data | Expected visibility |
|---|---|---|---|---|
| `LISTING_DRAFT` / `qa_listing_draft` | `draft` if production contract is added; otherwise client-local draft fixture only | OWNER_PENDING | Valid form content, not submitted | Owner only; never discovery |
| `LISTING_PENDING` / `qa_listing_pending` | `pending_verification`, `ownerVerified=false` | OWNER_PENDING | Fresh timestamps | Owner/admin only; direct public link unavailable |
| `LISTING_ACTIVE` / `qa_listing_active` | `active`, `ownerVerified=true` | OWNER_A | Bengaluru/Koramangala, share 13000, multiple images, screening questions | Public discovery/detail |
| `LISTING_ACTIVE_SECOND_OWNER` / `qa_listing_owner_b` | `active`, verified | OWNER_B | Bengaluru/Indiranagar, share 17000 | Public; OWNER_A cannot edit |
| `LISTING_PAUSED` / `qa_listing_paused` | `paused`, verified | OWNER_A | Fresh | Owner/admin; hidden public |
| `LISTING_FILLED` / `qa_listing_filled` | `filled`, verified | OWNER_A | Fresh | Hidden public |
| `LISTING_CLOSED` / `qa_listing_closed` | `closed`, verified | OWNER_A | Fresh | Hidden public |
| `LISTING_STALE` / `qa_listing_stale` | `active`, verified | OWNER_A | `lastConfirmedAt` 15 days before scenario clock | Visible with needs-confirmation label |
| `LISTING_EXPIRED` / `qa_listing_expired` | `active`, verified | OWNER_A | `lastConfirmedAt` 46 days before scenario clock | Hidden public; owner can reconfirm |
| `LISTING_UNVERIFIED_ACTIVE_ATTACK` / `qa_listing_unverified_attack` | attempted `active`, `ownerVerified=false` | OWNER_PENDING | Written only in a denied rules test | Write denied / never exists |
| `LISTING_ORPHAN` / `qa_listing_orphan` | active/verified but missing owner | none | Inserted only in validator-negative fixture | Validator fails and discovery hides |

Every valid listing includes all `Listing` interface fields, server-like timestamps, nonempty owner relationship, sensible rent/deposit values, and deterministic image URLs served locally or stable data fixtures.

## Connections and quota

| Key / ID | From → To | State / attribution | Expected use |
|---|---|---|---|
| `CONNECTION_PENDING` / `qa_conn_pending` | SEEKER_A → OWNER_A | pending, `listingId=qa_listing_active`, complete screening answers | Owner incoming queue; seeker sent queue |
| `CONNECTION_ACCEPTED` / `qa_conn_accepted` | SEEKER_B → OWNER_A | accepted, active listing | Existing chat and contact access |
| `CONNECTION_REJECTED` / `qa_conn_rejected` | SEEKER_WEAK → OWNER_A | rejected | Rejected history/no chat access |
| `CONNECTION_BLOCKED` / `qa_conn_blocked` | SUSPENDED_USER → OWNER_A | blocked | Block filtering/access denial |
| `CONNECTION_OWNER_B` / `qa_conn_owner_b` | SEEKER_A → OWNER_B | accepted | Cross-owner isolation |
| Quota below boundary | copy/reset SEEKER_A with `connectsUsed=4` and no target pair | fifth send succeeds and counter becomes 5 |
| Quota boundary | QUOTA_EXHAUSTED with `connectsUsed=5` | sixth send denied, no connection, counter unchanged |
| Premium bypass | PREMIUM_USER with `connectsUsed=5` | send succeeds |

Accepted connections require both `acceptedPairs/{a_b}` and `{b_a}` records that reference the same accepted connection.

## Messaging

| Key / ID | Participants | Messages | Expected use |
|---|---|---|---|
| `CHAT_EMPTY` / `qa_chat_empty` | PREMIUM_USER, OWNER_B | none | Empty conversation state |
| `CHAT_EXISTING` / `qa_chat_existing` | SEEKER_B, OWNER_A | 4 deterministic alternating messages | Ordering/two-way history |
| `MESSAGE_UNREAD` / `qa_msg_unread` | sender OWNER_A | `read=false` | SEEKER_B unread badge and mark-read |
| `MESSAGE_READ` / `qa_msg_read` | sender SEEKER_B | `read=true` | Read presentation |
| Unauthorized room | same `CHAT_EXISTING`; caller UNRELATED_USER | none | Direct get/list/write denied |

Real-time tests keep both authenticated browser contexts open. They create a run-scoped message ID/content from a deterministic test title plus the Playwright test ID, then clean or reset the emulator between tests; assertions never accept arbitrary prior messages.

## Notifications

| ID | Recipient | Type | Read | Action |
|---|---|---|---|---|
| `qa_notif_connect` | OWNER_A | `connect` | false | `/owner-dashboard?tab=applicants` |
| `qa_notif_message` | SEEKER_B | `message` | false | `/chat/qa_chat_existing` |
| `qa_notif_verification` | OWNER_PENDING | `verification` | true | `/owner-dashboard?tab=listings` |
| `qa_notif_system` | SEEKER_A | `system` | true | `/safety` |

All use `description` and `actionUrl`, never legacy `message`/`link` fields.

## Moderation and reports

| ID | Reporter → target | State | Data |
|---|---|---|---|
| `qa_report_pending` | SEEKER_A → SUSPENDED_USER | `pending` | allowed reason and description |
| `qa_report_resolved` | SEEKER_B → BANNED_USER | `resolved` | resolution metadata |
| `qa_report_dismissed` | OWNER_A → SEEKER_WEAK | `dismissed` | dismissal metadata |

Negative cases: self-report, spoofed reporter, unsupported reason, >2000 description, suspended/banned reporter, and non-admin read/update.

## Verification

| Owner | `ownerVerifications/{uid}` state | Related listing/result |
|---|---|---|
| OWNER_B test variant | no document (`NOT_STARTED` derived) | pending listing |
| OWNER_PENDING | `SUBMITTED` | pending listing remains hidden |
| dedicated review variant | `UNDER_REVIEW` | pending listing remains hidden |
| OWNER_A | `APPROVED` | active verified listings |
| OWNER_REJECTED | `REJECTED` with note | may resubmit to `SUBMITTED` only |
| OWNER_RESUBMIT | `RESUBMISSION_REQUIRED` with note/count | may resubmit |

Legacy `verifications` fixtures are separate and only used by the legacy Edit Profile verification tests.

## Admin and analytics

- Admin registry: `admins/admin.qa@nestmate.test` (normalized email document key) bound to ADMIN Auth emulator account.
- Broadcast history starts with one deterministic record plus recipient notification fan-out.
- Analytics contains each whitelisted event type, valid actor/entity references, and timestamps across two days for filtering.
- Admin metrics expected values are derived by the validator from the catalog, not hard-coded independently in tests.

## Reset and isolation contract

1. Refuse to run unless both Auth and Firestore emulator hosts are explicitly present and the project equals `demo-nestmate`.
2. Purge Auth emulator accounts and Firestore emulator documents.
3. Recreate Auth users with catalog UIDs and test-only credentials.
4. Seed Firestore with security rules disabled through the emulator test environment.
5. Seed any Storage fixtures only into the Storage emulator.
6. Run the integrity validator through both privileged inspection and persona-scoped rule reads/writes.
7. Generate the runtime persona registry/storage sessions from the same source; never duplicate IDs by hand.
8. Reset before every state-mutating feature group and isolate browser contexts per persona.

## Phase 3 exit status

Scenario requirements and exact canonical identities/records are defined. The existing scripts do not meet this catalog and must be replaced/corrected before Phase 4 can pass.

## Phase 4 implementation result (2026-10-09)

The catalog is implemented by `tests/data/emulator-universe.cjs` and `tests/seed/emulator-universe.cjs`. Reset → seed → verify passed against local Auth, Firestore, and Storage emulators:

```text
RESET_OK auth=purged firestore=purged
SEED_OK personas=17 firestoreDocuments=102 scenarioClock=2026-10-01T06:00:00.000Z
VERIFY_OK authUsers=17 listings=9 acceptedConnections=4 chatRooms=3 notifications=5 reports=4
```

The earlier “must be replaced” statement is retained as the discovery-time finding; replacement and verification are complete.
