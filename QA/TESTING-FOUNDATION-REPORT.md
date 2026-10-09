# NestMate Testing Foundation Report

Evidence date: 2026-10-09

## Outcome

The active QA foundation is isolated, deterministic, and based on real Firebase emulator identities. It replaces the previous mixed seed/auth paths. Production and live Firebase data were not mutated.

## Certified local stack

| Layer | Configuration | Evidence |
|---|---|---|
| App | Vite test mode on strict `127.0.0.1:4173` | Environment smoke and all browser suites |
| Firebase project | Exact allowlist: `demo-nestmate` | Seed runner refuses every other project |
| Auth | Emulator `127.0.0.1:9099` | 17 fixed-UID users and six auth foundation cases |
| Firestore | Emulator `127.0.0.1:8080` | 102-document seed verification and 37 rule tests |
| Storage | Emulator `127.0.0.1:9199` | Disposable fixture and 14 rule tests |
| Desktop browser | Playwright Chromium, 1280×720 | 51 discovered cases |
| Mobile browser | Chromium with Pixel 5 device profile | Same 51 discovered cases |
| Isolation | `reuseExistingServer=false`, one worker, no retries | No stale server or retry-based green result |

## Canonical data architecture

- `tests/data/emulator-universe.cjs` is the runtime identity/ID/scenario registry.
- `tests/seed/emulator-universe.cjs` performs guarded reset, seed, and verify operations.
- Scenario clock is fixed at `2026-10-01T06:00:00.000Z`; freshness data is derived from it.
- The registry contains 17 personas: two primary seekers, weak/cross-city seekers, two owners, three verification-state owners, incomplete, suspended, banned, admin, premium, quota-exhausted, unaffiliated third party, and disposable deletion persona. Anonymous behavior uses no account.
- Public `users` records are separated from `privateUserData`; test PII is not written to public profiles.
- The validator checks Auth UID equality, required scenarios, enum validity, listing owners, connection participants/listing ownership, accepted-pair symmetry, chat participants/message senders, notification recipients, reports, verification keys, timestamps, duplicates, and orphans.

Verified command result:

```text
RESET_OK auth=purged firestore=purged
SEED_OK personas=17 firestoreDocuments=102 scenarioClock=2026-10-01T06:00:00.000Z
VERIFY_OK authUsers=17 listings=9 acceptedConnections=4 chatRooms=3 notifications=5 reports=4
```

## Authentication fixture architecture

1. Global setup opens the real `/login` UI for each persona.
2. It signs in against Firebase Auth emulator with the persona credential.
3. It waits until login routing completes.
4. It saves Playwright storage state including IndexedDB (`indexedDB: true`), where Firebase persists the real session.
5. Feature tests create independent contexts from the relevant generated state.

Generated `tests/.auth` files are ignored and not committed. Production no longer hydrates `nestmate_auth_session`, and the fake-auth injector/generator were deleted.

## Environment safety controls

- Test mode is explicit through `app/.env.test`; production defaults do not silently connect to emulators.
- Reset/seed fails unless Auth, Firestore, and Storage hosts resolve to localhost and the project is exactly `demo-nestmate`.
- Vite uses a dedicated strict test port; Playwright does not attach to arbitrary existing servers.
- Legacy scripts that contained conflicting token/seed behavior were removed from active use.
- The legacy service-account wipe utility no longer has a live project fallback, but remains an intentionally manual administrative script requiring an explicit key. It was not run.
- Dev seed UI import and route are removed from the production build graph.

## Commands

```text
npm run check
npm test -- --run
npm run test:data
npm run test:rules
npm run test:storage-rules
npm run test:e2e
npm run test:e2e:headed
npm run build
```

`test:e2e` and `test:e2e:headed` start all emulators and seed before Playwright. The direct headed master command used for the two projects is captured in `FINAL-E2E-REPORT.md`.

## Evidence results

| Gate | Result |
|---|---:|
| TypeScript | PASS |
| Unit/component logic | 361 passed; 51 skipped |
| Reset/seed/verify | PASS |
| Firestore rules | 37 passed |
| Storage rules | 14 passed |
| Real auth foundation | 6 passed |
| Test inventory | 51 cases × 2 projects = 102 executions |
| Production build | PASS; development seed utility absent |

## Known foundation limitations

- Global setup performs 17 UI logins, adding roughly one minute to a browser run. This is intentional correctness over speed; a future emulator token/bootstrap helper may optimize it only if it still creates genuine Firebase SDK persistence.
- Firebase emulator logs are very noisy for expected rule denials and shutdown socket resets. Exit status and Vitest summaries are the authoritative result.
- Playwright JSON/HTML output is overwritten by later focused runs unless CI assigns per-run artifact directories. CI should retain separate desktop/mobile/full/focused artifacts.
- Old ignored `tests/legacy`, `tests/api`, and `tests/unit` Playwright trees remain historical, not active evidence. They should be archived or migrated in a separate cleanup to avoid misleading maintainers.
- External Google OAuth, Razorpay, Nominatim/map tiles, WhatsApp handlers, email delivery, and deployed Firebase configuration are not proven by local emulators.

