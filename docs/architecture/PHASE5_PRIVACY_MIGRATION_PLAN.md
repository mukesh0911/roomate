# NestMate Phase 5.1 — Approved-Direction Privacy Migration Readiness

## Status, scope, and evidence standard

This is a revised architecture and migration-readiness plan. It is not a schema migration, Firestore rule change, production backfill, deployment, or security-fix claim. Production data and deployed rules remain unchanged.

**Verified facts** are based on the current worktree. **Proposals** require separate implementation and migration approval. Firestore Rules are an enforcement boundary; UI hiding and `sanitizePublicProfile` are not.

## Verified current state and corrections to the Phase 5 plan

| Verified fact | Evidence | Consequence |
| --- | --- | --- |
| `users/{uid}` has `allow read: if true`. | `app/firestore.rules` | Anonymous callers can read the complete stored document, not a client-sanitized projection. |
| `listings/{id}` also has `allow read: if true`. | `app/firestore.rules` | Anonymous listing browsing is already technically possible, but every field stored in a listing is public. Public listing payload needs an allowlist audit too. |
| The `UserProfile` model contains contact values, raw quiz answers, exact budget/date/location, account/trust state, and saved/blocked activity. | `app/src/hooks/useAuth.ts` | `users` cannot remain the discovery collection. |
| `privateUserData/{uid}` currently stores only contact fields and is owner/admin readable. | `app/src/lib/privateUserData.ts`, rules | It is a useful existing boundary, but lazy hydration is not a complete legacy migration. |
| Discovery still queries `users`, and its fallback performs an unconstrained collection scan. | `app/src/hooks/useMatches.ts`, `BrowseSeekers.tsx`, `MapView.tsx`, `OwnerDashboard.tsx` | New public discovery readers must use `publicProfiles`; Rules cannot filter an overly broad query. |
| Legacy seeker profiles without `roommateDiscoveryEnabled` are presently treated as discoverable. | `app/src/lib/profileEligibility.ts` | This conflicts with the approved direction. The fallback must be removed before any discovery-card publication. |
| Client code can read raw owner answers from users and `listing.ownerQuizAnswers`; room details derive lifestyle traits from them. | `useListings.ts`, `RoomDetail.tsx`, matching helpers | Raw answers must be removed from public listing/profile payloads; client-side cross-user detailed scoring cannot remain. |
| Admin access is currently based on an `admins/{lowercase-email}` document derived from the verified Auth token. | `app/firestore.rules` | Proposed rules retain this convention, subject to an admin-access regression suite. |
| The deterministic emulator seed writes raw quiz answers and account fields to `users`, and creates no `publicProfiles`. | `tests/seed/emulator-universe.cjs` | Fixtures must be versioned for private accounts, opted-in cards, opt-out cards, and legacy accounts before cutover testing. |

### Corrections from Phase 5

1. `publicProfiles` is **authenticated-only**, not anonymous. Anonymous users may browse approved active listings only.
2. There is no legacy seeker automatic opt-in and no public `/users` dual-read target. Legacy data remains private/preserved; users must explicitly consent before a discovery card is written.
3. `ownerQuizAnswers` is a prohibited field in any anonymously readable listing. The listing document contract must be audited separately before a rules cutover.
4. `publicProfiles` must not accept a client-written verification badge. A derived badge is written only by trusted backend/admin automation, or omitted in the first release.

## Approved product boundaries

- Anonymous: browse approved, active room listings only. No account, contact, raw compatibility, or private owner data.
- Authenticated, completed, opted-in users: browse authenticated roommate discovery cards.
- Posting or owning a listing never enables roommate discovery.
- Legacy seekers are not published automatically.
- Raw compatibility answers remain private. Candidate ranking uses a server-derived, minimal output; raw candidate answers never reach an unrelated client.
- Existing listing ownership, listing verification/approval, connections, accepted-pair `userContacts`, and accepted-pair chat authorization remain unchanged.

## Proposed schema and exact field contract

### `users/{uid}` — private account/profile record

**Readers:** owner and administrator. **Writers:** owner for an allowlisted mutable account subset; administrator for moderation/trust fields. **Anonymous and unrelated authenticated readers:** denied. This is the authoritative record for onboarding, matching inputs, activity, and existing workflow compatibility.

### `privateUserData/{uid}` — separately protected direct-contact record

**Readers/writers:** owner and administrator. Keep direct contact fields separated from the account record because they are especially sensitive. Accepted connections continue to receive only the existing relationship-gated `userContacts/{uid}` data; they do not receive this document. Do not duplicate all private profile fields here.

### `publicProfiles/{uid}` — authenticated, opt-in discovery card

**Readers:** authenticated users only, and only for cards meeting the eligibility predicate. **Owner writes:** create/update/delete only their own exact allowlisted card and only while discovery is explicitly enabled on the private account. **Admin:** moderation read/write. **Anonymous:** denied.

Required base fields:

```text
uid, displayName, city, localities, roommateDiscoveryEnabled,
discoverySetupVersion, updatedAt, schemaVersion
```

`city` and `localities` are broad preferred areas, never precise address or coordinates. `localities` must be capped and normalized. `roommateDiscoveryEnabled` is true only after an explicit, recorded consent action; it is never inferred from role, quiz completion, or listing ownership.

Optional fields are absent unless the user selected the corresponding disclosure setting: `avatar`, `ageRange`, `budgetRange`, `gender`, and `professionCategory`. `bio` requires a separate content/privacy decision; the conservative first release omits it. Social links are private by default and excluded.

### Field mapping and access matrix

Source is the current `users/{uid}` field unless noted. “Private” means retain/move in `users`; “Contact” means `privateUserData`; “Card” means an allowlisted public-profile field. All destination fields are written by the owner only through typed mappers unless marked admin/backend.

| Field(s) | Destination / transform | Readers | Writers | Opt-in and migration rule |
| --- | --- | --- | --- | --- |
| `uid` | `users.uid`; `publicProfiles.uid` must equal document ID | private: owner/admin; card: authenticated | owner/admin | Copy identity only when a card is explicitly created. |
| `name` | private `name`; optional card `displayName` | private owner/admin; card authenticated | owner | Preserve privately. Copy only after discovery consent and display-name consent. |
| `phone`, `email`, `workEmail`, `whatsappNumber` | `privateUserData` | owner/admin; accepted partner only through existing `userContacts` where applicable | owner/admin | Copy non-empty values in approved backfill, verify, then separately clear legacy copies. Never card/listing fields. |
| `avatar` | private; optional card `avatar` | owner/admin; card authenticated only if selected | owner | No automatic publish for legacy accounts. |
| `city`, `localities`, `locality`, `state` | private canonical location; optional card `city` + normalized broad `localities` | owner/admin; card authenticated only if selected | owner | Preserve. Exclude address, exact coordinates, building/landmark and free-form precision. |
| `geoLocation` | private only | owner/admin | owner/admin | Never backfill to card or listing owner profile. Existing map-person feature must be redesigned before cutover. |
| `age` | private; optional derived card `ageRange` | owner/admin; card authenticated only if selected | owner mapper | Do not publish exact age; never infer consent. |
| `budget`, `moveInDate` | private; optional normalized `budgetRange`, `moveInWindow` only after explicit choices | owner/admin; card authenticated only if selected | owner mapper | Do not publish exact values. `moveInWindow` is a future approved-card extension, not required in v1. |
| `gender`, `profession` | private; optional card `gender`, `professionCategory` | owner/admin; card authenticated only if selected | owner mapper | Values are optional per-field disclosure settings; category, not company, for profession. |
| `company`, `socialLinks`, `bio`, `preferences`, `householdExpectations`, `propertyBasics`, `ownerType`, `housingIntent`, `preferredRoomType` | private only | owner/admin | owner/admin | Never publish by default. `bio` requires later explicit approval and sanitization policy. |
| `quizAnswers`, owner lifestyle/compatibility tokens | private only; server-derived connection/candidate output only | owner/admin; authorized backend; pair-scoped output only | owner; backend writes derived output | Never card/listing fields. Remove public `ownerQuizAnswers` before final rules cutover. |
| `roommateDiscoveryEnabled` | private consent state; mirrored `true` on card | owner/admin; card’s flag is authenticated-readable | owner; backend may delete card on opt-out | Only explicit `true` creates/retains card. Missing/false legacy values create no card. Opt-out deletes/unpublishes card before any future discovery response. |
| `onboardingComplete`, `role`, `status`, `createdAt`, `updatedAt`, `lastActiveAt`, `verificationLevel`, `isVerified`, `phoneVerified`, `workEmailVerified`, `isPremium`, verification details | private account state; optional backend-derived badge only | owner/admin; card authenticated only for safe derived badge | owner limited; admin/backend for trust/moderation | Never expose raw state. No client may write a badge. |
| `connectsUsed`, `connectsLimit`, `settings`, `savedProfileIds`, `savedRoomIds`, `skippedUserIds`, `blockedUserIds`, `savedSearches` | private only | owner/admin | owner/admin | Preserve in place. Never copy. |
| listing `ownerName`, `ownerAvatar`, address, lat/lng, `ownerQuizAnswers`, owner trust fields | separate listing contract, not `publicProfiles` | anonymous only for reviewed listing-safe fields | listing owner constrained; admin approval fields | Audit and split/strip prohibited public fields. Raw answers, contact values and internal owner state must not be present in anonymous listing documents. |

### Required validation rules (proposal)

`publicProfiles` Rules must require all of the following: authenticated caller; `request.auth.uid == uid`; exact allowed keys; matching `uid`; `roommateDiscoveryEnabled == true`; bounded strings and arrays; no unapproved optional field; and immutable/backend-only trust fields. Rules must use `get()` on the caller's private `users/{uid}` record to require `onboardingComplete == true` and explicit discovery consent.

Firestore query limitation: Rules are not filters. Every client list query must include the same eligibility predicate that the rule permits (for example, `roommateDiscoveryEnabled == true`) and must target only `publicProfiles`. Required composite indexes must be identified from emulator query errors and committed before production cutover.

## Compatibility design and dependency inventory

| Dependency | Current behavior | Required compatible change before cutover |
| --- | --- | --- |
| Auth, App, onboarding, `useUserProfile`, Edit Profile, Settings | Reads/writes private and public-shaped data in `users`; contacts are partially split | Keep own private read. Introduce explicit account/contact/card mappers. Add discovery consent and per-field disclosures without overwriting existing values. |
| `useMatches`, Browse Seekers, Owner Dashboard seeker list | Query all `users`, filter client-side, calculate raw-answer compatibility | Query `publicProfiles` only after authenticated completed setup. Obtain a minimal derived score from a callable/backend, not raw candidate answers. |
| `useListings`, Room Detail, Browse Rooms, Map View | Fetch owner `users` docs; may use raw quiz answers and geolocation | Use listing-safe display snapshots. Never fetch another private account to render an anonymous listing. Map-person mode must use opt-in broad areas or be disabled pending a safe design. |
| Applicant Compare, owner applicant queue | Reads applicant private profile/quiz data from `users` | Replace with connection/listing-application scoped authorized data. Owner may see only applicants for their listing; unrelated owners cannot query profiles. |
| Chat, Profile Page, Safety Center, connections, `userContacts` | Reads other user docs for display; contact sharing is pair-gated | Use public-card/display snapshots for identity; preserve existing accepted-pair contact and chat rules. Do not grant accepted pairs general private-profile reads. |
| Admin hooks/pages, reports, verification, deletion/export | Lists/reads/writes `users` | Preserve admin access through the existing Auth-token/`admins` convention; add controlled admin visibility/moderation of cards. |
| Analytics/landing Stats | Counts users directly | Use a safe aggregate or authenticated/admin metric; anonymous site must not depend on private `users` count. |
| SeedData and emulator fixtures | Seed public-shaped users with raw answers | Maintain versioned fixtures for private owner, opted-in card, opt-out card, legacy seeker, incomplete account, accepted pair, admin, and public listing. |

### Server-derived compatibility proposal

A Cloud Function (or equivalent trusted backend) accepts the authenticated viewer and candidate IDs, verifies both discovery cards/consent and eligibility, reads private answers server-side, and returns only `candidateUid`, a bounded `scoreBucket`/percentage if approved, and fixed safe reason codes. It must not return raw answers, free-text inferred traits, exact budget, or private location. Cache only in a pair-scoped private record with ACLs for the two users/admin, or return ephemerally. This needs separate API, abuse/rate-limit, and cost approval.

## Backward-compatible rollout and rollback

1. **Baseline inventory (read-only):** approved privileged report counts field prevalence, legacy PII, raw `ownerQuizAnswers`, discovery-consent state, eligible cards, malformed values, and account IDs represented as restricted hashes. No writes.
2. **Implementation release A:** add typed models/mappers, consent/disclosure UI, `publicProfiles` Rules and emulator tests, card queries, safe listing display snapshots, and derived-scoring backend. Existing `/users` rules remain unchanged until application dependency validation is complete. No production dual-write yet without approval.
3. **Emulator dry run:** seed representative private/legacy/opted-in/opted-out/admin/account-pair states. Produce target-card previews, validation errors, prohibited-field detections, count reconciliation, and required-index report. No source documents are modified.
4. **Approved application release B:** deploy compatible readers first; publish a card only from an explicit consent event. Legacy users see a consent prompt and remain undiscoverable until they choose. Listing creation never invokes the card mapper.
5. **Approved production backfill:** after backup/export and review, a service-account job copies direct contact to `privateUserData`, writes cards only for accounts with recorded explicit consent, uses checkpointed idempotent batches, and records exceptions. It does not delete/blank source fields in its first pass.
6. **Validation window:** compare private account/card counts, consent counts, listings, connection/chat paths, admin workflows, derived-score responses, and denied-rule tests. Monitor old-reader usage until zero.
7. **Explicit rules cutover:** restrict `users` to owner/admin; enforce public-profile rules; remove prohibited listing fields with an approved, resumable migration. Do not expose `/users` again as rollback.
8. **Post-cutover and rollback:** stop the job on anomaly, revert application readers to already-populated safe cards/listing snapshots, and retain source backups. Restore data from backup only through an approved incident process; do not make private users public to roll back.

## Mandatory emulator security and regression tests

The following are required after proposed rules exist; none are currently evidence of a final privacy fix.

| Scenario | Expected result |
| --- | --- |
| Anonymous `users`, `privateUserData`, `publicProfiles` reads/list queries | denied; anonymous approved-safe listing read allowed. |
| Unrelated authenticated read/list of `users` and `privateUserData` | denied, including direct `get` and broad query. |
| Owner private account/contact read and allowed profile update | allowed; protected trust/status/quota fields cannot be spoofed. |
| Admin private account/card moderation | allowed under the current verified-token/`admins` mechanism. |
| Explicit opt-in completed user creates a conforming card | allowed and discoverable only to authenticated discovery users. |
| Legacy seeker with quiz, missing flag, or `false` flag | cannot create/publish a card and is absent from discovery. |
| Opt-out update/deletion | card becomes unreadable/unlisted; no stale client fallback to private `users`. |
| Card malformed document | reject extra keys, phone/email/social links, raw quiz, exact location/budget/date, invalid UID, long strings, oversized/locality arrays, invalid types, and client-written verification. |
| Listing payload security | anonymous reads expose only audited safe fields; direct attempts to add contact/raw answers/internal owner fields are denied by final listing rules. |
| Derived compatibility API | unrelated caller cannot request/receive another account's raw answers; returned data contains only approved minimal fields; pair ACL holds. |
| Connections/chat/contact sharing | pending connection cannot open chat/contact; accepted pair retains current permitted chat/contact path without private account access. |
| Browser regressions | anonymous room browse; authenticated opt-in roommate browse; opt-out/legacy empty state; profile save; listing post without discovery publication; approval visibility; My Listings; admin moderation. |

## Risks and open implementation constraints

- Until the rules cutover, all legacy `users` fields and stored listing fields remain exposed according to current public-read rules. This is an identified risk, not mitigated by this document.
- Security Rules cannot inspect a query result to redact fields or compute compatibility. The split collections, explicit rules, trusted backend, and client query migration are all required.
- The current account-wide `UserProfile` TypeScript type is too broad for a public card. Separate types and mappers are mandatory to avoid object spreading private fields.
- Public listing safety may require a separate `publicListings` projection or a strict listing key allowlist. That design decision must be resolved before anonymous listing contract enforcement.
- Existing direct client admin tooling and seed/debug screens require careful restriction or replacement; they must not become a backdoor after private-account rules are applied.

## Actions requiring further approval

1. Approve the exact optional-card disclosures and first-release `bio` decision.
2. Approve the derived-compatibility backend contract, rate limits, storage location, and safe score/reason outputs.
3. Approve the anonymous listing field allowlist/projection design and treatment of existing `ownerQuizAnswers`/precise address fields.
4. Approve implementation of the new collections, mappers, rules, fixture changes, and emulator tests.
5. After dry-run review, separately approve backup/export, production backfill, public-field cleanup, rules cutover, and deployment.
