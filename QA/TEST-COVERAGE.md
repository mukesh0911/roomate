# NestMate Test Coverage

Evidence date: 2026-10-09. This report distinguishes inventory coverage, executable automated coverage, and inspected-but-not-executed behavior. A green suite is not treated as complete product coverage.

## Coverage summary

| Dimension | Covered / discovered | What counts as covered | Important gap |
|---|---:|---|---|
| Canonical production routes | 17 / 40 | Route reached with a real browser and relevant user state | Public info, onboarding completion, listing editor, match detail, preferences, preview, compare, help, and five admin subroutes lack dedicated behavior suites |
| Product feature groups | 15 / 30 | Dedicated browser cases proving at least one meaningful action | Listing create/edit lifecycle, owner verification transition, reporting/moderation mutation, contacts, reviews, support, map, saved items, and payment fulfilment remain shallow/uncovered |
| Interactive element types | 46 / 108 | Action plus user-visible outcome asserted, counted against `FEATURE-ELEMENT-MATRIX.md` | Many modal/form/destructive/error controls are inventoried but not executed |
| Submit-capable forms/workflows | 4 / 12 | Successful submit or mutation asserted in browser | Onboarding, listing editor, verification, support, report, profile-save, export, and admin mutation are not all exercised; payments are inactive |
| Browser scenarios | 50 / 324 minimum | 50 implemented scenarios; denominator is the minimum happy/negative/boundary triplet for 108 inventoried controls | Scenario depth is far below exhaustive inventory coverage |
| Core business rules | 22 / 23 | Unit or emulator rule assertion with deterministic data | Trusted multi-document verification remains a gap; payment fulfilment is excluded while plans are inactive |
| Backend operation families | 18 / 27 | Direct emulator rule/data validation or browser mutation evidence | Several admin/moderation/export/deletion and external integration operations lack end-to-end state verification |
| Roles/account classes | 5 / 5 | Anonymous, seeker, owner, admin, and restricted/incomplete accounts exercised | Individual pending/rejected verification personas are seeded but not all browser-transition tested |
| State transitions | 16 / 30 | Transition outcome proven by unit/rule/browser evidence | Full listing, verification, moderation, and agreement state machines remain incomplete; payments are inactive |
| Explicit security boundaries | 51 / 51 | 37 Firestore + 14 Storage emulator assertions | This number covers implemented assertions, not every theoretical adversarial input |
| Multi-user workflows | 3 / 3 | Independent contexts, identity isolation, real request/accept transition, notification, and concurrent two-way chat | Owner-create/admin-approve is still a separate listing-lifecycle coverage gap |
| Responsive areas | 15 / 20 | Same behavior executed with Pixel 5 mobile Chrome settings | Keyboard/input viewport behavior, complex modals, map gestures, listing editor, and onboarding forms need dedicated mobile inspection |
| Browser/project executions | 99 / 100 executed | 50 cases discovered per project; deletion executes once because it removes the shared disposable identity | Final master: 99 passed, 1 intentional skip, zero failures |

## Automated evidence

| Layer | Result | Scope |
|---|---:|---|
| TypeScript | PASS | `tsc -b` |
| Unit/component logic | 361 passed, 51 skipped | 30 passing files, 2 intentionally skipped files |
| Firestore rules | 37 / 37 passed | Admin, users/PII, listing, connection/pair, chat/message, notification, report, support/match/broadcast boundaries |
| Storage rules | 14 / 14 passed | Profile, listing, chat, verification ownership and unauthorized cases |
| Seed integrity | PASS | 17 Auth users, 102 Firestore docs, 9 listings, 4 accepted connections, 3 chat rooms, 5 notifications, 4 reports; reference/orphan/state checks |
| Auth foundation | 6 / 6 passed | Real emulator login, IndexedDB persistence, context isolation, logout, restricted accounts, admin denial |
| Desktop Chromium | 50 / 50 passed | Final master, zero retries |
| Mobile Chrome | 49 / 49 executed passed; 1 intentional skip | Destructive deletion executes only once against the shared disposable identity |
| Current headless master | 99 passed, 1 skipped | 7.6 minutes, one worker, zero retries, Functions/Auth/Firestore/Storage emulators |
| Production build | PASS | 2,554 modules; dev seed chunk absent |
| Headed master run | 102 / 102 passed | Chromium then mobile Chrome, 15.5 minutes, one worker, zero retries, fresh emulator seed |

## Browser scenario inventory (50 per project)

| Group | Cases | What is proved |
|---|---:|---|
| Real authentication | 6 | Genuine sessions, persistence, logout, restrictions, admin boundary |
| Environment | 1 | Browser/app shell startup without fatal error |
| Admin | 3 | Dashboard, users, verification queue access |
| Chat | 3 | Conversation list, existing thread, send mutation |
| Connections | 3 | Sent/incoming states and quota persona without fake auth |
| Explore roommates | 3 | Candidate render, self exclusion, locality search |
| Explore rooms | 4 | Seed render, search, price sort, detail navigation |
| Listing detail | 3 | Data/verification/amenity render and missing ID state |
| Notifications | 3 | Feed, async filter state, available action control |
| Owner dashboard | 3 | Overview, listing management tab, applicant tab |
| Pricing | 3 | Plan render, billing toggle, FAQ interaction (not payment verification) |
| Profile | 3 | Seeker identity/edit navigation and owner role/verification display |
| Settings | 4 | Hub, tab navigation, privacy toggle, trusted permanent deletion |
| Browser security gates | 5 | Non-admin, suspended, banned, incomplete, owner-to-admin denial |
| Listing-to-connection mutation workflow | 1 | Screening submit, live owner request, acceptance, notification, and two-way real-time chat |
| Multi-user contexts | 2 | Independent identities and concurrent chat contexts |

## Coverage interpretation

- The active suite intentionally excludes `tests/legacy`, old API harnesses, and old Playwright-based “unit” artifacts because they depended on synthetic auth/data contracts. They are not counted as passing evidence.
- The browser suite uses one deterministic registry and genuine Firebase Auth emulator sessions; no `injectFirebaseAuth` path is active.
- Desktop/mobile failures were investigated from accessibility trees and traces. Product defects were fixed in product code; stale selectors/races were fixed in tests.
- Browser tests mainly prove UI-visible results. Backend invariants are independently proven by Firestore/Storage rule tests and the seed validator.
- Headless execution is real Chromium, but it does not satisfy the requested headed criterion by itself. The headed result is therefore tracked independently.

## Highest-value next coverage

1. Owner verification submit/review/reject/resubmit state machine with database assertions.
2. Listing create/edit/admin-review/pause/fill/close/freshness lifecycle with another user's visibility.
3. Report create/admin resolve-dismiss/reporter notification workflow.
4. Onboarding and complex-form mobile keyboard/overflow/accessibility coverage.
5. Razorpay verification only if a paid plan is later approved and enabled.
