# NestMate Data Mapping Audit

**Evidence date:** 2026-10-08  
**Status:** static code/rule mapping complete; live/emulator integrity validation pending rebuilt isolated seed system

## Mapping method

The table below reconciles production reads/writes, TypeScript interfaces, Firestore rules, indexes, and existing seed artifacts. “Allowed values” lists the production contract, not aspirational fixture data. A mismatch is considered verified when two checked-in executable sources disagree; exploitability/runtime impact is separately tested in security/data phases.

## Collection and relationship map

| Path | ID source | Required/core fields | Optional/state fields | Foreign keys | Create / read / update / delete |
|---|---|---|---|---|---|
| `users/{uid}` | Firebase Auth UID | `uid`, `name`, `role`, onboarding profile data | `status: active/suspended/banned`; trust/premium flags; saved/skipped/blocked arrays; settings; timestamps | Auth UID | Self creates/updates/deletes with rule restrictions; public read; admin broad access |
| `privateUserData/{uid}` | Same UID | Any of `phone`, `email`, `workEmail`, `whatsappNumber` | `updatedAt` | `users/{uid}` | Owner/admin only |
| `userContacts/{uid}` | Same UID | `whatsappNumber` | timestamps | `users/{uid}`; accepted pair lookup | Owner/admin write; owner/admin/accepted partner read |
| `acceptedPairs/{a_b}` | `${viewerUid}_${targetUid}` directional pair | `user1`, `user2`, `connectionId`, `createdAt` | None declared | both users; `connections/{connectionId}` | Either named participant/admin currently creates/updates/deletes; participants/admin read |
| `listings/{id}` | Auto ID in product; deterministic test ID | `ownerId`, title, location, pricing, property attributes, images, status, timestamps | `ownerVerified`, preferences, coordinates, views, applicants, freshness | `ownerId → users/{uid}` | Public read; active self-owned create; owner/admin update/delete; public restricted view increment |
| `connections/{id}` | Auto ID in product; deterministic test ID | `fromUserId`, `toUserId`, `status`, `createdAt` | `listingId`, `screeningAnswers` | two users; optional listing owned by recipient | Sender creates pending; participants/admin read/delete; recipient accepts/rejects; either blocks |
| `chatRooms/{id}` | Auto/deterministic | exactly two `participants`, created/last-message metadata | `matchId`, typing map, phone sharing | participant UIDs; optional match/connection | Active participant creates; participants/admin read/update/delete |
| `chatRooms/{id}/messages/{id}` | Auto/deterministic | `senderId`, `content`, `read`, `createdAt` | `imageUrl`, `isSystem` | parent room participant | Active room participant creates; participants/admin read; read/own-edit rules; admin delete |
| `notifications/{id}` | Auto/deterministic | Product interface: `userId`, `type`, `title`, `description`, `read`, `createdAt` | `actionUrl` | recipient UID | Any auth creates; recipient/admin reads/updates/deletes |
| `listingViews/{listingId_date}` | Composite deterministic | `listingId`, `ownerId`, `date`, `count` | None | listing and owner | Public create/update under field limits; authenticated read |
| `ratings/{id}` | Not established | No production interface discovered | Rating data | User(s), unspecified | Auth read/create only |
| `reviews/{id}` | Auto | `targetUserId`, `reviewerId`, reviewer display fields, integer rating 1–5, text, timestamp | text ≤1000 | two users | Auth read/create; reviewer/admin update/delete |
| `matches/{id}` | Auto | `userId`, `matchedUserId`, `compatibilityScore`, `status`, timestamp | `pending/accepted/rejected` | two users | Product hook reads/creates; no explicit non-admin rule |
| `skippedUsers/{id}` | Auto | `userId`, `skippedUserId`, timestamp | None | two users | Auth read; caller-bound append only |
| `agreementOTPs/{id}` | Agreement ID | Unspecified | Unspecified | agreement | Any authenticated read/write |
| `agreements/{id}` | Agreement ID | `landlordId`, `tenantId` plus agreement payload | workflow fields | two users | Any auth creates; participants/admin read/update |
| `verifications/{id}` | Auto/deterministic | `userId`, `type`, `documentUrl`, lowercase status | review timestamp/note | user | Self creates; owner/admin reads; admin updates/deletes |
| `ownerVerifications/{uid}` | Owner UID | `userId`, uppercase state-machine status | doc type/url/name, reviewer/note, counters, audit trail, timestamps | same `users/{uid}`; owner listings | Owner safe submit/update; owner/admin read; admin review/delete |
| `reports/{id}` | Auto/deterministic | `reporterId`, `targetId`, reason, `status=pending` | description ≤2000, target type, timestamps | reporter/target/listing | Active caller creates; admin read/update/delete |
| `admins/{email}` | Lowercase authenticated email | `email`, role/name | timestamps | Auth token email | Own entry get; admin manage; catch-all grants admins everything |
| `config/admin` | Fixed | `adminEmails` and display configuration | other UI config | admin emails | Auth read; admin write |
| `broadcasts/{id}` | Auto | target/title/message plus timestamps/count | action URL | generated notifications | Admin UI reads/writes; no explicit non-admin rule |
| `analyticsEvents/{id}` | Auto | whitelisted `name`, caller-bound `actorId`, timestamp | entity ID, city, nonnegative result count | user/optional entity | Active caller creates; admin reads; immutable |
| `supportTickets/{id}` | Auto | help-form payload | status/timestamp | optional user/contact | Product creates; no explicit non-admin rule |

## Listing field contract

Production `Listing` expects:

- Ownership/display: `ownerId`, `ownerName`, `ownerAvatar`.
- Content: `title`, `description`, `flatType`, `furnishing`, `city`, `state`, `locality`, `address`.
- Commercial: `totalRent`, `partnerShare`, `partnersNeeded`, `deposit`, `availableFrom`.
- Detail: `amenities[]`, `houseRules[]`, `images[]`, `preferredGender`/`genderPreference`, coordinates.
- Lifecycle: `status`, `ownerVerified`, `lastConfirmedAt`, `createdAt`, `updatedAt`.
- Counters: `applicants`, `views`.
- Enrichment-only derived fields: `isOwnerPremium`, `isOwnerVerified`, `ownerQuizAnswers`.

Stored statuses accepted by rules are `active`, `paused`, `filled`, `closed`, and `pending_verification`. `expired` is derived from time; `draft` has no current production rule/interface representation.

## User field contract and privacy split

`users/{uid}` is publicly readable. Production helpers intentionally blank `phone`, `email`, `workEmail`, and `whatsappNumber` on the public document and hydrate the caller's own view from `privateUserData/{uid}`. `userContacts/{uid}` is the separately shareable contact card for accepted partners.

Rule-protected trust fields include `isVerified`, `isPremium`, `workEmailVerified`, `verificationLevel`, verification details, premium timestamp, and identity verification flags. `connectsUsed` may not be decremented by a user.

## Verified mapping mismatches

| ID | Executable source A | Executable source B | Verified mismatch | Expected resolution |
|---|---|---|---|---|
| DM-01 | `Listing` type/rules allow five stored statuses | seed factories/scripts create `status=draft` | Seeded draft cannot be created through production rules and is treated as paused/unknown by freshness logic | Define a production draft state or keep draft outside Firestore scenario claims |
| DM-02 | Freshness expires at 45 days | local/full seed describe a 35-day listing as expired | “Expired” seed is actually `needs_confirmation`, not expired | Seed ≥45 days (prefer 46) or rename stale scenario |
| DM-03 | Notification hook reads `description` and `actionUrl`; union uses seven generic types | seeds write `message`, `link`, and types such as `connection_request` | Seeded notification body/action/type does not match UI interface | Normalize fixture fields/types to production contract |
| DM-04 | Report create rule requires initial `status=pending` | seeds use `open` and `resolved`; requested catalog needs pending/resolved/dismissed | Seed contract and product creation state disagree | Canonicalize report enum and admin transitions |
| DM-05 | Authoritative owner state lives at `ownerVerifications/{uid}` | full seed/validator primarily write/check `verifications/{test_verif...}` with uppercase owner states | UI subscription to `ownerVerifications/{uid}` will not see seeded states | Seed both only when testing legacy; owner scenarios must use UID-keyed authoritative collection |
| DM-06 | `OwnerVerificationGate` accepts government-ID document types | existing UI/discovery copy refers to electricity bill/property tax/rental deed in places | Meaning of “identity verification” vs property proof is inconsistent | Align UI/form/catalog with the implemented identity-verification contract |
| DM-07 | `users/{uid}` is public and PII should be blank | full seed persona objects contain public `email` and `phone` before being written | Seed places test PII in publicly readable docs despite also seeding private data | Strip PII in public seed writes |
| DM-08 | Persona UID must equal Firebase Auth UID for rule-authorized self actions | deterministic personas use synthetic UIDs while login occurs as one admin account; storage states inject only local storage | UI persona identity and Firebase authorization identity diverge | Create real Auth emulator users with deterministic UIDs/tokens and genuine browser sessions |
| DM-09 | `useAdmin` client comment says registry-only; rules say registry plus three hard-coded emails | client also accepts hard-coded emails and `config/admin.adminEmails` | Client and rule admin sources differ, enabling UI/rule disagreement | One authoritative registry/custom-claim model |
| DM-10 | `matches`, `broadcasts`, `supportTickets` are used in production | no matching explicit Firestore blocks for normal users | Non-admin product operations fall through to catch-all admin-only grant/deny | Add least-privilege rules or remove inactive operations |
| DM-11 | Accepted contact access trusts `acceptedPairs/{viewer_target}` | pair create rule only checks caller is one of request-resource participants | Pair is not proven to reference an accepted connection | Derive/validate acceptance server-side or in rules with immutable connection reference |
| DM-12 | Chat room intended to remain a two-person participant boundary | update rule permits any participant to update all room fields | A participant can alter `participants` and other protected metadata | Restrict update keys and preserve participant set |
| DM-13 | Message author shown from `senderId` | create rule only checks caller belongs to room | Caller can write another UID or `system` as sender | Bind non-system sender to `request.auth.uid`; trusted system path needed |
| DM-14 | Notifications represent trusted product events | any authenticated caller can create arbitrary record for any `userId` | Sender/recipient/type/content are unbound | Restrict client-created event shapes/recipients or use trusted backend |
| DM-15 | Listing/chat files belong to a listing/room | Storage rules allow any authenticated upload/delete under any listing/chat path | Object ownership/participation not enforced | Add metadata/Firestore-backed ownership rules or trusted upload service |
| DM-16 | Admin verification side effects touch multiple documents as one business transition | implementation performs sequential client writes | Partial approval can leave verification/user/listings inconsistent | Use trusted transactional backend or explicit compensation/idempotency |
| DM-17 | Account deletion promises erasure of conversations/profile | Settings deletes room docs but not their message subcollections and omits several dependent collections/storage paths | Orphans and retained personal data are possible | Inventory and delete all dependencies via trusted backend |
| DM-18 | Seed environment guard defaults to `demo-nestmate` and checks only a short forbidden-name set | full seed/validator hard-code `nestmate-eb562` and credentials, bypassing config isolation | Destructive/test writes can target a shared non-emulator Firebase project | Replace with emulator-only default and explicit allowlist |
| DM-19 | Production auth persistence is Firebase SDK state | generated Playwright storage states contain `nestmate_auth_session` JSON only | Browser UI may appear logged in while Firestore is unauthenticated | Generate certified Firebase Auth emulator sessions/storage |
| DM-20 | Reset implies reset of deterministic universe | `test:reset` only deletes local JSON/auth-state files | Firestore data remains stale/duplicated | Implement project-scoped emulator purge and verify empty baseline |

## Orphan and integrity rules required by the validator

The rebuilt validator must fail on:

- Listing with missing owner.
- Connection with missing participant, self-connection, invalid status, or listing not owned by recipient.
- Accepted connection lacking both directional accepted-pair records, or a pair pointing to a non-accepted/mismatched connection.
- Chat with other than two unique existing participants, a chat not backed by an accepted scenario where product policy requires it, or a message sender not equal to a participant/system.
- Notification with missing recipient, unsupported type/fields, or invalid action URL shape.
- Review/match/skipped record with missing user reference.
- Verification document keyed/referenced to the wrong user.
- Report with missing reporter/target, self-target, invalid state/reason.
- Listing-view record whose listing/owner/date composite is inconsistent.
- Public user test document containing non-empty private PII.
- Duplicate scenario IDs or scenario records.
- Timestamp outside the deterministic scenario window or internally reversed ordering.
- Any configured project other than an explicit emulator/demo allowlist.

## Phase 2 exit status

The current code and fixture contracts are fully mapped. Twenty static mismatches are verified. Runtime severity and remediation status are recorded in `QA/DEFECT-LOG.md` as fixes/tests are completed.

## Post-audit resolution status (2026-10-09)

| Mismatch | Resolution |
|---|---|
| DM-01 | Fixed: `draft` is in the shared listing/rule contract. |
| DM-02 | Fixed: canonical expired fixture is 46 days old against the 45-day rule. |
| DM-03 | Fixed: canonical notifications use `description`, `actionUrl`, and supported types. |
| DM-04 | Fixed: report states are `pending`, `resolved`, `dismissed`. |
| DM-05 | Fixed for active tests: authoritative `ownerVerifications/{uid}` scenarios are seeded and verified. |
| DM-06 | Documented contract; browser transition coverage remains incomplete. |
| DM-07 | Fixed: seed strips public PII and verifies the privacy split. |
| DM-08 | Fixed: Auth emulator users have fixed matching UIDs. |
| DM-09 | Fixed: admin registry is the sole active authorization source. |
| DM-10 | Fixed: explicit least-privilege blocks added. |
| DM-11 | Fixed: accepted pair is tied to an accepted connection and matching participants. |
| DM-12 | Fixed: participant set is immutable and update keys are restricted. |
| DM-13 | Fixed: message sender is bound to caller; client system-style messages use the caller UID. |
| DM-14 | Fixed for implemented client event shapes; privileged broadcasts remain admin-only. |
| DM-15 | Fixed: listing/chat/verification object ownership enforced and tested. |
| DM-16 | Open: trusted transactional verification backend is still preferable; current browser coverage does not certify partial-failure recovery. |
| DM-17 | Open P1: complete account erasure requires trusted backend and policy (BUG-013). |
| DM-18 | Fixed: emulator-only exact-project guard and legacy unsafe seed paths removed. |
| DM-19 | Fixed: real Firebase IndexedDB states, no mock auth key. |
| DM-20 | Fixed: reset purges Auth and Firestore emulator state before deterministic reseed. |

The original table is intentionally preserved as discovery evidence; this appendix is the authoritative final disposition.
