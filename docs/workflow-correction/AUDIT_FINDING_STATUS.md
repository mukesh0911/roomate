# Prior finding traceability

6 November 2026. Reuses A01-A52 from the completed product audit; no new full audit was performed. This is an implementation checkpoint. PASS applies to the evidence named in the final column; it is not a claim that every screen or release gate passed. NOT VERIFIED includes implemented changes that still need broader acceptance. FAIL records a known unresolved defect. BLOCKED identifies a coverage, policy or operational prerequisite.

Current detailed commands, results and the 25-scenario matrix are in [ACCEPTANCE_STATUS.md](ACCEPTANCE_STATUS.md). This table records historical finding traceability; individual evidence counts below belong to their original checkpoints.

| Finding | Status | Current correction / outstanding evidence |
| --- | --- | --- |
| A01 Landing location/budget handoff | NOT VERIFIED | Explicit URL predicates and pre-pagination filters implemented; complete hero-to-discovery browser/filter restoration remains. |
| A02 City treated only as locality text | NOT VERIFIED | Backend and local text predicates include actual city; exact city selection, city controls and all displayed city labels remain incomplete. |
| A03 Move-in/category handoff | NOT VERIFIED | Hero and category URLs carry filters; hostel/coliving classification regression passes. Category-control browser matrix remains. |
| A04 Fictional featured inventory | PASS | Fixture fallback removed. Featured uses real records and canonical rent without fabricated verification/title/location defaults; actual-record browser journey passes. Empty/error presentation still needs dedicated browser coverage. |
| A05 Featured heart disconnected from Saved | PASS | Actual save, refreshed state, Saved reload and return to the featured saved state pass in browser. |
| A06 UID coerced to chat profile index | NOT VERIFIED | UID-based entity loader replaces coercion; actual profile-button browser journey remains. |
| A07 Chat photos bypass Storage | NOT VERIFIED | Private upload command and validated paths wired; real Storage tests pass. Attachment-picker/retry/orphan browser coverage remains. |
| A08 No unread write model | PASS | Atomic recipient counter and own read reset verified with independent principals. |
| A09 All message separators Today | NOT VERIFIED | Actual timestamps and paged history implemented; multi-day browser rendering remains. |
| A10 Invented staff rent | NOT VERIFIED | Canonical rent adapter replaces 14000 fallback; shared adapter tests pass. Same-record staff/detail runtime comparison remains. |
| A11 Non-active staff listings shown Active | NOT VERIFIED | Shared lifecycle labels preserve pending/rejected/unknown. Full staff runtime lifecycle comparison remains. |
| A12 ID metadata mismatch | NOT VERIFIED | Declared name/type/note adapters corrected; staff submission-preview browser coverage remains. |
| A13 Ban versus listing visibility | FAIL | Interaction rules enforce restrictions; all discovery visibility/projection effects of account sanctions remain unresolved. |
| A14 Broadcast saved presented as delivered | NOT VERIFIED | Feedback now says saved/delivery unavailable. Durable recipient fan-out and delivery status are unfinished. |
| A15 Staff grant called invitation | NOT VERIFIED | Grant terminology and error feedback corrected; complete audited grant/revoke and actual staff UI testing remain. |
| A16 Fake purge/reset successes | PASS | Unavailable operations no longer claim a reset/purge occurred. No destructive reset capability was introduced. |
| A17 Resolve before sanction succeeds | NOT VERIFIED | Sanction precedes final resolution in active staff handler. Forced sanction-failure/retry browser evidence remains. |
| A18 Applicant decline before backend completion | PASS | Separate actor-specific persisted application transitions replace connection rejection; real-rule decline/reject/withdraw tests pass. |
| A19 Applicant refresh | PASS | Real application listener and owner query deliver actionable IDs; actual browser shortlisting passes. Plain listing consent is excluded from applicants. |
| A20 Saved/Connections only hydrate loaded entities | NOT VERIFIED | Direct ID loaders and saved marking after hydration implemented; featured Saved reload passes. Outside-first-page people and unavailable tombstones remain. |
| A21 Shared links depend on first discovery page | NOT VERIFIED | Authorized direct ID resolution and an actual f-prefixed shared destination pass; full outside-first-page matrix remains. |
| A22 Internal versus browser history | NOT VERIFIED | Canonical filters and stable entity IDs now persist in native history; React Router handles popstate remounts and scroll coordinates are retained. Back/reload and selected-chat reload pass in the final unchanged-source browser run; complete destination/forward/scroll coverage remains. |
| A23 Footer legal/help routes absent | FAIL | Approved content and actual router destinations remain unfinished. |
| A24 Clipboard success not awaited | NOT VERIFIED | Known copy handlers await completion and report failure; PG sharing uses the actual PG ID. Clipboard denial and complete share browser coverage remain. |
| A25 Invented comparison inputs | NOT VERIFIED | Shared matching engine and real viewer inputs replace lifestyle/move-in defaults; missing factor text verified at three widths. Complete applicant comparison/missingness remains. |
| A26 Basic edit erases localities | PASS | Source regression preserves undisplayed preferences during unrelated edits. |
| A27 Avatar commits before Save | NOT VERIFIED | Upload stages a draft URL; saved profile changes only on Save. Browser Save/Discard and orphan cleanup remain. |
| A28 Quota points at absent upgrade | NOT VERIFIED | Backend preserves cumulative allowance and reports exhaustion without inventing a renewal plan; complete exhausted-state UI remains. |
| A29 Raw user/listing source public reads | FAIL | Broad source reads remain. Projection tests do not establish source isolation; coverage/readers/cutover are still required. |
| A30 Moderator blanket admin authority | PASS | Moderator report access succeeds; staff grants and private identity access are denied under real rules. |
| A31 Delegated action attributes in untrusted markup | NOT VERIFIED | Raw display-field interpolations are escaped before sanitization. Hostile listing/profile/notification browser coverage passes on unchanged source. This does not establish every legacy rendering path. |
| A32 Stale ID review | PASS | Exact inspected document/version required; stale decision rejected and approval does not publish a listing under real rules. |
| A33 Historic token/retention exposure | BLOCKED | Current private paths do not revoke historical bearer links or establish reviewed legacy asset coverage/retention. |
| A34 Deletion report fields mismatch | BLOCKED | Staged worker covers reporterId/reportedBy/targetId; real emulator proves legacy reportedBy cleanup. Public deletion remains gated pending coverage review and deployed trigger/UI acceptance. |
| A35 Wrong bucket/shared-history deletion | BLOCKED | Actual configured bucket tested. Founder chose retained peer history; staged worker passes interrupted-page/storage retry, retained messages/attachments and de-identification. Replacement callable and trigger are wired but explicitly disabled; the legacy recursive handler is removed. |
| A36 Active/freshness policy contradictions | NOT VERIFIED | Active backend predicates improved; full lifecycle, legacy cutover and dormant-helper reconciliation remain. |
| A37 Multiple matching engines | NOT VERIFIED | Active matching renderers use shared engine; same-record cross-page scoring/alias matrix remains. |
| A38 Incomplete settings/data/unblock | BLOCKED | Block/unblock contracts pass. Export, complete privacy settings and public deletion enablement and acceptance remain unfinished. |
| A39 Manufactured staff activity | NOT VERIFIED | Zero/unknown mappings corrected; true global aggregate and staff runtime evidence remain. |
| A40 Contradictory dormant services | NOT VERIFIED | No replatform or blind deletion performed. Explicit dependency/retirement review remains. |
| A41 Source suites cannot execute | PASS | Source regression suite executes all 43 files and passes 473 tests. |
| A42 Old browser suite uses removed routes | FAIL | New isolated journeys use current routes; broad legacy Playwright route cleanup remains. |
| A43 Hosting bypasses validation | NOT VERIFIED | Hosting now depends on reusable type/source/build/Functions/rules/Storage/lint and independent-user workflow/browser checks. Hosted execution and branch/environment enforcement remain unverified. |
| A44 Stale capability documentation | NOT VERIFIED | README now describes current routes, actual capabilities, gates and verification. Historical blueprint documents link to current acceptance. Complete older QA/capability-document reconciliation remains. |
| A45 Duplicate responsive input IDs | NOT VERIFIED | Responsive hero IDs corrected in source; full DOM uniqueness/accessibility scan remains. |
| A46 Draft/location boundary inconsistencies | NOT VERIFIED | Locality preservation and avatar staging implemented; complete profile draft browser acceptance remains. |
| A47 Language/background push promises | BLOCKED | No provider/service integration was fabricated; approved scope and actual delivery are still required. |
| A48 Abuse/deployment controls | BLOCKED | Local rule tests cannot establish deployed abuse controls, rate limits, secrets, monitoring or incident response. |
| A49 Screening/application intake disconnected | PASS | Independent application submission with answer snapshot, real owner query and owner shortlisting pass. Full questionnaire comparison browser display remains additional coverage. |
| A50 Dormant automatic verification | NOT VERIFIED | Deprecated self-approval helper fails closed; exact-version manual path passes. Remaining dormant dependency review is not complete. |
| A51 Sitemap advertises missing routes | PASS | Sitemap now contains only the existing public home and explore routes; XML and current route reconciliation checked. Missing legal/help content remains A23. |
| A52 Production badge on demo | NOT VERIFIED | Actual environment adapter replaces constant badge; staff browser evidence remains. |

No production deployment, migration or live-data reset was performed. These remaining entries must not be turned into PASS merely because a build, screenshot, or unrelated test suite succeeds.

## Final handoff checkpoint ? 6 November 2026

The latest isolated run passed all 24 workflow/browser checks with unchanged source; 11 Functions/worker tests passed. The replacement deletion callable/service/background trigger is wired behind an explicit disabled flag, and the old recursive deletion handler has been removed. Coverage review, deployed event delivery and callable-to-UI acceptance remain open. That checkpoint had 523 lint errors; the latest continuation has zero errors and two staff-effect warnings. Earlier integration/pending-run descriptions are historical and superseded by this checkpoint and ACCEPTANCE_STATUS.md. No deployment or production migration was performed; the full roadmap remains incomplete.

## New continuation validation

473 source tests pass. Lint passes with zero errors and two existing staff-effect warnings. Typed React mounting now wraps the explicitly linted JavaScript renderer. CI includes build and independent-user workflow/browser acceptance using an installed CLI rather than a machine-specific path. After rule optimization, 17 backend/security groups pass. The Back-button failure is fixed; the final targeted browser run passes nine unchanged-source checks with zero page errors. The separate current-rules regression sweep passes all 71 tests. Current README and blueprint pointers distinguish historical proposals from current implementation.
