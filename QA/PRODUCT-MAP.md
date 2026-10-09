# NestMate Product Map

**Audit phase:** Phase 0 — repository and architecture discovery  
**Evidence date:** 2026-10-08  
**Evidence base:** current production source, Firebase rules/configuration, package scripts, seed/reset helpers, and Playwright configuration  
**Status:** discovery complete; runtime/data/security claims remain uncertified until their dedicated phases

## 1. Application architecture

NestMate is a client-rendered single-page application. There is no custom API server or Cloud Functions package in this repository. The browser talks directly to Firebase Authentication, Cloud Firestore, and Firebase Storage, so correctness and authorization are split between React code and Firebase rules.

| Layer | Current implementation | Evidence |
|---|---|---|
| UI | React 19.2 + TypeScript, built by Vite 7 | `app/package.json`, `app/src/main.tsx` |
| Routing | `BrowserRouter`, `Routes`, lazy-loaded pages | `app/src/App.tsx` |
| Local UI state | Zustand (`currentRole`, selected city, filters, active chat, auth modal) | `app/src/store/useStore.ts` |
| Remote state | Custom Firebase hooks; React Query is installed but is not the dominant data layer | `app/src/hooks/*` |
| Authentication | Firebase Auth: email/password and Google are active; phone OTP/linking remains implemented but its routes redirect to login | `useAuth.ts`, `AuthPage.tsx`, `App.tsx` |
| Database | Cloud Firestore accessed directly from browser | hooks, pages, `firestore.rules` |
| Files | Firebase Storage accessed directly from browser | `useStorage.ts`, `storage.rules` |
| Authorization | Firestore/Storage rules plus client route/visibility guards | `firestore.rules`, `storage.rules`, `App.tsx`, `AdminLayout.tsx` |
| Hosting | Firebase Hosting SPA rewrite to `index.html` | `app/firebase.json` |
| Testing | Vitest unit tests, Firebase emulator rule tests, and Playwright browser tests | package scripts and `tests/` |

Important architecture boundaries:

- `AppRoutes` maintains one route-facing auth/profile snapshot using `onAuthStateChanged` plus a Firestore `users/{uid}` listener.
- `useAuth` separately maintains a module-level singleton auth/profile snapshot. These two auth consumers can temporarily disagree and must be examined in Phase 5.
- `Layout` owns global authenticated/public navigation, auth modal access, role-sensitive navigation, and the live unread-notification count.
- Firestore rules are the only server-side business/security enforcement present in the repository.
- All timestamps written through normal product flows use Firestore `serverTimestamp()` except audit-trail entries in owner verification, which use client ISO timestamps.

## 2. Routes

### Public and authentication routes

| Route | Page/behavior | Access and notes |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/login` | `AuthPage` through `LoginRoute` | Public; an authenticated user is redirected to role dashboard; `?redirect=/admin...` is honored |
| `/phone-login` | Redirect to `/login` | Legacy convenience route; `PhoneLogin` component is not rendered |
| `/verify-otp` | Redirect to `/login` | Legacy convenience route; `OTPVerify` component is not rendered |
| `/verify-phone` | Redirect only | Component exists but route redirects according to auth/onboarding state |
| `/role-select` | `RoleSelect` | Authenticated, onboarding incomplete only |
| `/onboarding/seeker` | `SeekerOnboarding` | Authenticated; account must be active; route itself does not reject an already-onboarded profile |
| `/onboarding/owner` | `OwnerOnboarding` | Authenticated; account must be active; route itself does not reject an already-onboarded profile |
| `/explore` | `ExplorePage` | Public shell; interactive operations open auth or rely on authenticated profile |
| `/room/:id` | `RoomDetail` | Public detail; mutations require auth |
| `/match/:id` | `MatchDetail` | Public detail; mutations require auth |
| `/trust` | `TrustCenter` | Public |
| `/safety` | `SafetyCenter` | Public |
| `/help` | `HelpSupport` | Public page; ticket submission depends on Firestore permissions |
| `/how-it-works` | `HowItWorks` | Public |
| `/about` | `AboutUs` | Public |
| `/privacy` | `PrivacyPolicy` | Public |
| `/terms` | `PrivacyPolicy` | Public; reuses privacy component |
| `/pricing` | `PricingPage` | Public; loads Razorpay checkout script |

### Authenticated application routes

All routes below use `OnboardingGuard`, which requires Firebase/app auth, an active account, completed onboarding, and (where declared) the expected role.

| Route | Page/behavior | Role |
|---|---|---|
| `/dashboard` | Role-sensitive redirect | Owner → `/owner-dashboard`; otherwise `/explore?tab=rooms` |
| `/owner-dashboard` | `OwnerDashboard` | Owner |
| `/edit-listing/:id` | `EditListing`; `id=new` creates | Owner |
| `/chat` | `ChatPage` | Seeker or owner |
| `/chat/:roomId` | `ChatPage`, selected room | Seeker or owner |
| `/profile` | `ProfilePage` | Seeker or owner |
| `/profile/preview` | `ProfilePreview` | Seeker or owner |
| `/edit-profile` | `EditProfile` | Seeker or owner |
| `/preferences` | `PreferencesPage` | Seeker |
| `/applicants/compare` | `ApplicantCompare` | Owner |
| `/settings` | `SettingsPage` | Seeker or owner |
| `/notifications` | `NotificationsPage` | Seeker or owner |
| `/verify` | Redirect to `/edit-profile#verification` | Auth is enforced only after redirect by destination behavior |

### Admin routes

`PrivateRoute` first requires an active authenticated account. `AdminLayout` then calls `useAdmin` and redirects a non-admin to the normal role dashboard.

| Route | Page |
|---|---|
| `/admin` | `AdminDashboard` |
| `/admin/users` | `AdminUsers` |
| `/admin/listings` | `AdminListings` |
| `/admin/marketplace` | `AdminMarketplace` |
| `/admin/reports` | `AdminReports` |
| `/admin/verifications` | `AdminVerifications` |
| `/admin/notifications` | `AdminNotifications` |
| `/admin/settings` | `AdminSettings` |

### Redirects and development-only routes

| Route | Destination/behavior |
|---|---|
| `/browse-rooms`, `/find-rooms` | Owner → listings tab; everyone else → Explore rooms |
| `/browse-seekers`, `/find-flatmates` | Owner → dashboard seekers tab; everyone else → Explore roommates |
| `/map` | `/explore` (the `MapView` component is embedded rather than directly routed) |
| `/home` | Role dashboard |
| `/connections` | `/explore?tab=connections` |
| `/applicants` | `/owner-dashboard?tab=applicants` |
| `/create-listing` | `/edit-listing/new` |
| `/listings`, `/my-listings` | Owner listings tab |
| `/my-profile` | `/profile` |
| `/dev/seed` | `SeedData`, compiled into development builds only |
| `*` | `NotFound` |

`AdminRedirectWatcher` also rewrites a nested path containing `/admin` (for example `/explore/admin`) to the extracted admin path.

## 3. Features

1. Landing/marketing: hero search, featured live listings, living options, trust, testimonials, statistics, informational/legal pages.
2. Authentication: Google popup, email/password sign-in, opportunistic email sign-up, password reset, logout; dormant phone OTP and phone-linking implementation.
3. Onboarding: role selection, seeker lifestyle/profile workflow, owner/property workflow, image upload, completion gates.
4. Discovery: room and roommate tabs, text/city search, basic and advanced filters, sort, saved items, connections, map presentation, pagination/load-more.
5. Matching: compatibility scoring from quiz/profile/listing signals, explanations/caveats, explicit cross-city fallback, applicant fit ranking.
6. Listings: create/edit/delete, images, active/pause/filled/closed lifecycle actions, verification gating, freshness confirmation, views and weekly analytics.
7. Connections: send interest (optionally listing-attributed and screened), accept, reject, block, withdraw, monthly/free-tier quota tracking.
8. Messaging: real-time room list/messages, text/image messages, read state, typing state, contact-sharing negotiation, system messages.
9. Notifications: real-time in-app feed, unread count, native browser notifications, mark read/all read, delete, admin broadcasts.
10. Profiles: view/edit/preview, privacy-safe own profile hydration, saved/skipped/blocked lists, contact card, social links, presence.
11. Verification/trust: legacy user verification documents plus authoritative owner-verification state machine and admin review.
12. Reviews/vouches: list and create reviews; rule layer also permits reviewer edit/delete although the hook exposes create/read only.
13. Reporting/safety: report users/listings, blocked-user management, safety guidance, support tickets.
14. Owner tools: portfolio dashboard, applicants, seeker discovery, screening answers, applicant comparison, analytics.
15. Admin: metrics, user moderation, listing management, report resolution, verification decisions, broadcasts, admin registry/config, demo cleanup, and a database-wipe utility.
16. Settings: role switch, preferences, privacy, notifications, appearance/language, data export, destructive account deletion.
17. Pricing: plan presentation and Razorpay client checkout bootstrap.
18. Localization: English, Hindi, Tamil, and Telugu string table for a subset of shared labels.

## 4. Components

### Application/domain components

| Group | Components |
|---|---|
| Shell/auth | `Layout`, `AuthLayout`, `AuthLayoutSkeleton`, `AuthModal`, `PageShell` |
| Discovery cards | `RoomCard`, `CompactRoomCard`, `DashboardSeekerCard`, `OwnerSeekerCard`, `FlatmateAvatar`, `RoommateAvatar` (currently a one-line re-export/placeholder) |
| Search/location | `AdvancedFiltersModal`, `LocationAutocomplete`, `MapPreview` |
| Trust/profile | `TrustBadge`, `Badge`, `ProfileCompleteness`, `SeekerTrustBanner`, `ContactModal` |
| Verification | `OwnerVerificationGate`, `AadhaarVerifyModal`, `DigiLockerModal` |
| Connections/screening | `ScreeningQuestionnaireModal`, `ApplicantScreeningAnswersModal`, `CreateTeamModal` |
| State presentation | `StateLoading`, `StateEmpty` |
| Marketing | landing navbar/footer, hero/search, featured listings, trust/stats/how-it-works/living-options/testimonial/collage/final CTA sections, `HeroMatchShowcase` |
| UI primitives | Radix/shadcn-style accordion, alert/dialog, avatar, badge, breadcrumb, button/group, calendar, card, carousel, chart, checkbox, collapsible, command, context/dropdown menus, dialog/drawer, empty, field/form, hover card, inputs/OTP, item, keyboard hint, label, menus/navigation, pagination, popover, progress, radio, resizable, scroll area, select/separator/sheet/sidebar/skeleton/slider/sonner/spinner/switch/table/tabs/textarea/toggle/tooltip |

## 5. Hooks and local libraries

| Hook | Responsibility |
|---|---|
| `useAuth` | Shared Firebase auth/profile state; Google/email/phone methods; profile hydration; logout |
| `useUserProfile` | Profile reads/updates, role change, saved/skipped/blocked actions, reports, contact-card synchronization |
| `useListings` | Queries/filtering/pagination, CRUD, lifecycle, freshness, views and analytics |
| `useMatches` | User/listing candidate assembly, compatibility scoring, saved profile hydration, match/skipped records |
| `useConnections` | Request state machine, quota precheck/counter, accepted-pair index, live subscriptions |
| `useChat` | Rooms/messages, live subscriptions, reads, typing, phone sharing |
| `useNotifications` | Live recipient feed, browser permission, CRUD/read operations |
| `useReviews` | User review query and create with validation/duplicate precheck |
| `useAdmin` | Admin identity check and all back-office reads/mutations |
| `useStorage` | Compressed profile/listing/chat image and verification-document uploads |
| `useGeocoding` | Rate-limited Nominatim lookup and coordinate persistence |
| `useAnalytics` | Firestore product events |
| `useActiveTracking` | Periodic `lastActiveAt` update for signed-in user |
| `usePushNotifications` | Service worker registration and local notification display |
| `useTranslation` | Profile-selected language lookup |
| `useIsMobile` | Viewport media query |

Important pure/domain modules include matching, listing filters/freshness/visibility, applicant ranking, screening questions, report/review validation, role filtering/navigation, city normalization, user intent, trust/display truth, private PII handling, phone sharing, analytics aggregation, image compression, and account-state helpers.

## 6. Backend operations

Because there is no server API, “backend operations” are Firebase client writes and rule enforcement:

- Auth: create/sign in with email/password, Google popup, password reset, phone OTP sign-in/link, sign-out, delete current auth user.
- User/profile: public profile CRUD, owner-only private data CRUD, contact-card writes, saved/skipped/blocked arrays, settings and presence updates.
- Listing: public queries/detail reads, owner CRUD, admin status operations, verification unlock, view increments and daily view aggregation.
- Connection: dual-direction queries/subscriptions, request create plus `connectsUsed` increment, decision updates, accepted-pair maintenance.
- Chat: room discovery/create, message create/read subscription/read marking, room metadata/typing/phone-sharing updates.
- Notification: recipient subscription/read/delete, any authenticated client create, admin fan-out broadcast.
- Trust/moderation: verification submissions/admin transitions, report creation/admin actions, review creation/read.
- Admin: broad collection reads and mutations, cleanup/wipe operations, registry/config management.
- Storage: profile images, listing images, chat images, legacy verification documents, owner verification documents.

There are no repository-owned transactional server jobs, scheduled jobs, webhook handlers, payment verification handlers, or privileged Admin SDK application endpoints.

## 7. Firestore collections

| Collection/path | Document ID source | Core relationships/purpose | Rule-level access summary |
|---|---|---|---|
| `users/{uid}` | Firebase Auth UID | Public profile, role, status, preferences, trust flags, quota | Public read; self create/update/delete with protected fields; admin broad access |
| `privateUserData/{uid}` | Firebase Auth UID | Owner PII (`phone`, `email`, `workEmail`, WhatsApp) | Owner/admin only |
| `userContacts/{uid}` | Firebase Auth UID | Shareable WhatsApp contact | Owner/admin/accepted partner read; owner/admin write |
| `acceptedPairs/{a_b}` | Directional UID pair | Fast accepted-relationship lookup | Participants/admin; currently participant-created |
| `listings/{id}` | Firestore auto ID normally; deterministic seed IDs in tests | `ownerId → users/{uid}` | Public read; active owner create/update; admin manage; public view-count update exception |
| `connections/{id}` | Firestore auto ID or deterministic seed ID | `fromUserId`, `toUserId`, optional `listingId` | Participants/admin read; sender create; recipient decision; either block/delete |
| `chatRooms/{id}` | Firestore auto ID or deterministic seed ID | Two `participants`, optional match/connection metadata | Participants/admin read/write; active participant create |
| `chatRooms/{id}/messages/{id}` | Auto/deterministic | `senderId`, content/image/read | Room participants/admin; rules require membership but do not currently bind sender field |
| `notifications/{id}` | Firestore auto/deterministic | `userId` recipient | Recipient/admin read/update/delete; any authenticated user create |
| `listingViews/{listingId_YYYY-MM-DD}` | Composite deterministic ID | Listing/owner/date aggregate | Auth read; narrowly field-limited public create/update |
| `ratings/{id}` | Unspecified/auto | Legacy rating records | Auth read/create only |
| `reviews/{id}` | Auto | Reviewer/target user | Auth read/create; reviewer/admin update/delete |
| `matches/{id}` | Auto | Symmetric match relationship | Used by app but has no explicit non-admin Firestore rule block |
| `skippedUsers/{id}` | Auto | Caller → skipped user | Auth read; caller-bound create |
| `agreementOTPs/{id}` | Agreement ID | Legacy agreement OTP | Any authenticated read/write |
| `agreements/{id}` | Agreement ID | Landlord/tenant | Participant/admin read/update; any authenticated create |
| `verifications/{id}` | Auto/deterministic | Legacy `userId`, doc type/url/status | Owner/admin read; self create; admin update/delete |
| `ownerVerifications/{uid}` | Owner UID | Authoritative owner verification state | Owner/admin read; owner limited submission states; admin review |
| `reports/{id}` | Auto/deterministic | Reporter → target | Active self-bound reporter create; admin only read/manage |
| `admins/{lowercaseEmail}` | Normalized Firebase Auth email | Admin registry | Own entry get; admin management |
| `config/admin` | Fixed | Informational admin email list/config | Auth read; admin write |
| `broadcasts/{id}` | Auto | Admin broadcast history | Used by admin UI; no explicit non-admin rule block |
| `analyticsEvents/{id}` | Auto | Immutable actor/entity events | Active self-bound create; admin read |
| `supportTickets/{id}` | Auto | Help form submission | Used by UI; no explicit non-admin rule block |

The catch-all admin rule precedes collection-specific rules and grants an authorized admin full access. Firestore `allow` expressions are additive.

## 8. Storage usage

| Path | Product use | Rule summary |
|---|---|---|
| `profiles/{uid}/...` | Profile avatar | Authenticated read; owner image upload/delete; <10 MB |
| `listings/{listingId}/...` | Listing images | Public read; any authenticated image upload/delete; <10 MB |
| `chats/{roomId}/...` | Chat images | Any authenticated read/upload/delete; <10 MB |
| `verifications/{uid}/...` | Legacy identity document | Owner-only read/write/delete; <10 MB |
| `verificationDocs/{uid}/...` | Owner verification identity document | Owner-only read/write/delete; <10 MB |
| `agreements/{agreementId}/...` | Legacy agreement files | Any authenticated read/write; <20 MB |

The rules explicitly note missing per-listing and per-chat participant ownership enforcement. Admin document review relies on persisted download URLs even though Storage reads are owner-only.

## 9. Authentication methods and session model

- Active UI methods: Google popup; email/password sign-in; email/password account creation when sign-in reports user-not-found/invalid credentials; password reset email.
- Implemented but not normally routed: phone OTP sign-in and phone credential linking.
- Firebase Auth persistence uses the SDK default browser persistence.
- Product profile identity is `users/{Firebase uid}`; private identity fields are hydrated from `privateUserData/{uid}`.
- `AppRoutes` subscribes in real time to `users/{uid}` for role, onboarding completion, account status, and phone presence.
- `useAuth` loads the same profile through a shared singleton with one-time reads/explicit refresh.
- Development builds accept `localStorage.nestmate_auth_session` or `window.__MOCK_AUTH_USER__` as an alternate app identity even when Firebase `auth.currentUser` is null. This is a Phase 5 audit target because Firestore remains unauthenticated.
- Playwright storage-state generators currently populate local storage, not a certified Firebase Auth IndexedDB/session state.

## 10. Roles

| Role/capability | Source of truth | Main product surface |
|---|---|---|
| Anonymous | No Firebase user | Public landing/discovery/detail/info pages |
| Seeker | `users.role = seeker` | Explore rooms/roommates/saved/connections, preferences, profile, chat |
| Owner | `users.role = owner` | Owner dashboard/listings/applicants/seeker discovery, listing editor, chat |
| Admin | Auth token email plus `admins/{email}`; current rules/client also contain hard-coded email fallbacks and client config fallback | `/admin/*` and catch-all Firestore access |
| Premium | `users.isPremium = true` (admin-protected trust field) | Quota bypass/tie-break presentation |

Roles are mutable through Settings. Role-switch behavior changes `users.role` but does not itself rebuild or clear role-specific data.

## 11. Account states

- Authentication: anonymous or authenticated.
- Onboarding: no role, seeker incomplete, owner incomplete, complete.
- Moderation: `active`, `suspended`, `banned`; missing/unknown status is treated as active.
- Trust/billing flags: unverified/verified, verification levels, phone/work/Aadhaar/work-ID/student-ID flags, free/premium.
- Route behavior: suspended/banned users receive a full-screen restricted-account view on protected routes; rules block selected marketplace writes via `isActiveUser` but do not universally block all reads/writes.

## 12. Listing states

Stored and allowed by production rules:

- `pending_verification`: mandatory initial publish state for new listings.
- `active`: discoverable only when verification/visibility and freshness gates also pass.
- `paused`: owner-hidden.
- `filled`: closed because occupancy filled.
- `closed`: soft-closed.

Derived freshness states (not stored): `available`, `needs_confirmation` at 14 days, `expired` at 45 days, `closed`, `paused`.

The requested/seeded `draft` state is not part of the TypeScript `Listing` union or `firestore.rules` allowed status list. It exists in seed/factory data and therefore requires reconciliation in Phase 2/3 rather than being treated as a valid production state.

## 13. Connection states

- Stored states: `pending`, `accepted`, `rejected`, `blocked`.
- Derived UI states: `none`, `pending_sent`, `pending_received`, `connected`.
- Request creation optionally carries a listing attribution and screening answers.
- Accept creates two directional `acceptedPairs` documents and then updates the connection.
- Reject/block attempts to delete both accepted-pair documents before updating connection status.
- The product code does not expose a dedicated “withdraw” hook, but SeekerDashboard deletes a connection document directly.
- Free connection limit constant is 5. Product hook/rules use `users.connectsUsed`; a separate pure helper defaults `unlimitedFree` to false only when explicitly passed and needs later consistency validation.

## 14. Verification states

Authoritative owner-verification state machine:

`NOT_STARTED → SUBMITTED → UNDER_REVIEW → APPROVED`

Rejection branch:

`UNDER_REVIEW/SUBMITTED → REJECTED or RESUBMISSION_REQUIRED → SUBMITTED`

Approval marks user trust fields and unlocks all pending listings by setting `status=active`, `ownerVerified=true`, and freshness timestamps. The legacy `verifications` collection independently uses lowercase `pending`, `approved`, `rejected` and is adapted into admin UI records.

## 15. Moderation states

- User: `active`, `suspended`, `banned`.
- Reports: production creation requires `pending`; admin UI accepts arbitrary status strings through its hook. Existing seed artifacts use `open` for one report and `resolved` for another, so the state contract is inconsistent and must be resolved during data mapping.
- Suspension/ban pauses all listings owned by the user; reinstatement only resets the user status and does not automatically restore listings.
- Admin report screens can resolve/dismiss and can also suspend/ban a target.

## 16. Notifications

- Product interface types: `match`, `message`, `connect`, `room`, `agreement`, `verification`, `system`.
- Seed records instead use `connection_request`, `connection_accepted`, and `new_message`, and fields `message`/`link` instead of UI interface fields `description`/`actionUrl`.
- Feed and unread count are live Firestore subscriptions sorted client-side by `createdAt`.
- Notification page supports per-item read/delete, mark-all-read, and browser permission.
- Admin broadcast fans out one notification per target user and writes a `broadcasts` history record.
- Browser notifications are local Web Notifications; there is no FCM token/server push implementation in this repository.

## 17. Messaging

- A room contains two participant UIDs, optional match/connection metadata, last-message metadata, typing flags, and phone-sharing state.
- Messages are a subcollection ordered by `createdAt`, with text, optional image, sender, read flag, and optional system flag.
- Room and message streams use `onSnapshot`; this is genuine real-time behavior.
- The UI loads counterpart public profile/listing data and marks incoming unread messages read.
- Chat creation currently searches rooms containing user A and reuses the first also containing user B; otherwise it creates a two-participant room.
- Phone sharing is a request/accept state embedded in room metadata and sends system messages.

## 18. Business rules

1. A user must have a non-empty name and a recognized role before onboarding can be completed; seekers require at least five quiz answers and owners require a city.
2. Public discovery hides incomplete, suspended/banned, unnamed, and recognized demo profiles.
3. A new listing starts pending verification and explicitly unverified; only admin approval should make it active/verified.
4. Explicit `ownerVerified=false` or `pending_verification` listings are hidden; legacy active listings with no field are grandfathered.
5. Active listings become stale after 14 days and leave discovery after 45 days without confirmation.
6. Listing search/filtering is client-side after a bounded Firestore fetch; sort prioritizes premium and verified owners after query order.
7. Compatibility is derived from actual quiz/profile/listing signals; missing preferences should produce caveats rather than fabricated answers.
8. Owners search seekers; seekers may discover rooms, seekers, and owners depending on selected surface/filter.
9. A connection cannot target self or duplicate an existing pair; a listing-attributed request must reference an active listing owned by the recipient.
10. Free users are limited to five sends according to the current hook and rule counter; premium bypasses.
11. Only a connection recipient can accept/reject; either participant can block; sender/recipient may delete.
12. Contact-card reads are intended only for accepted partners.
13. Reviews require authenticated reviewer identity, no self-review, integer rating 1–5, and text ≤1000 characters.
14. Reports require an active caller, caller-bound reporter ID, non-self target, allowed reason, description ≤2000, and initial pending state.
15. Analytics events are caller-bound, immutable, and event-name/field whitelisted.
16. Public users may increment only listing view fields; session/day deduplication and owner-self-view exclusion are client behavior.
17. Admin status is intended to derive from normalized authenticated email registry, but current client/rules include fallback mechanisms requiring security validation.

## 19. Feature dependencies

| Feature | Depends on |
|---|---|
| Protected navigation | Firebase Auth → `users/{uid}` → role/onboarding/status |
| Room discovery | listings query → visibility/freshness → owner profile enrichment → filters/sort |
| Roommate discovery | users query → visibility/role filters → listing enrichment → compatibility |
| Send interest | active onboarded caller → target/listing → quota → connection write + counter |
| Applicant flow | incoming connection → seeker profile → screening answers → owner decision |
| Chat availability | connection/UI decision → room create/find → participant rules → messages |
| Contact sharing | accepted connection → directional `acceptedPairs` → `userContacts` read |
| Listing publication | owner onboarding → listing create → owner verification → admin approval → visibility/freshness |
| Notifications | triggering feature manually creates record → recipient live listener → optional browser notification |
| Admin UI | Firebase user/profile → admin identity resolution → catch-all rule access |
| Profile privacy | public `users` sanitization → owner-only `privateUserData` hydration → accepted contact card |
| Map | visible profiles/listings → stored coordinates or Nominatim geocoding → Leaflet/Google tiles |
| E2E feature suites | isolated test project → deterministic Firestore/Auth seed → genuine Firebase browser session → browser contexts |

## 20. External dependencies

| Dependency | Use | Operational caveat |
|---|---|---|
| Firebase Auth/Firestore/Storage/Hosting | Core backend and deployment | No custom trusted server layer |
| Google Identity via Firebase | Google popup sign-in | Popup/provider configuration required |
| Google map tiles/search URLs | Map display and nearby-place links | Tile URL/attribution and network availability |
| OpenStreetMap Nominatim | Location autocomplete/geocoding | Browser calls, global 1.1-second queue, external rate/service limits |
| Leaflet/react-leaflet | Map rendering | CSS/assets and browser layout required |
| Razorpay checkout script | Pricing purchase initiation | No repository-side payment verification found |
| Web Notifications + service worker | Local notification display | Permission and browser support required; not remote push |
| WhatsApp deep links | Accepted-contact handoff | External app/browser handling |
| Unsplash/Google-hosted/pravatar images | Marketing/demo visuals | External network and content stability |
| Sonner | Toast feedback | Client-only |
| EmailJS | Installed dependency | No active production import found in the inspected source |

## Discovery-time audit leads for later phases

These are not certified defects yet; each requires reproduction against the relevant rule/runtime/data layer.

1. **Environment mismatch:** current working-tree `app/vite.config.ts` uses port 3001 while Playwright and environment scripts target 3000.
2. **Dual/test auth identity:** development local-storage identity can render protected UI without authenticating Firebase, while `AppRoutes` and `useAuth` keep independent profile state.
3. **Admin identity drift:** `useAdmin` comments say “no hardcoded emails,” but the client and Firestore rules contain a three-email fallback; client also treats config membership as admin while rules call that config informational only.
4. **Rule gaps for used collections:** `matches`, `broadcasts`, and `supportTickets` are used by production code but have no explicit non-admin rules and therefore fall through to denial except for admins.
5. **Chat rule breadth:** participants can update room metadata without protected-field constraints; message creates do not bind `senderId` to auth UID.
6. **Accepted-pair trust:** either named participant can create an `acceptedPairs` document without rules proving the underlying connection is accepted.
7. **Notification spoofing:** any authenticated user may create a notification for any recipient/type/content.
8. **Storage ownership:** listing and chat object paths are not owner/participant restricted, and deletes are allowed to any authenticated user.
9. **Seed/production drift:** draft listings, report statuses, notification types/fields, verification collection choice, fixed real-looking IDs, and timestamps differ between seed artifacts and product contracts.
10. **Reset/seed split:** root `test:seed` combines a local artifact generator with a separate Firestore writer; `test:reset` only removes local artifacts; validators are split between local JSON and real Firestore checks.
11. **Inactive code/routes:** `SeekerDashboard`, `MapView`, phone pages, Aadhaar/DigiLocker modals, agreements, and ratings exist but are not all reachable as standalone current product flows.
12. **Account deletion completeness:** the settings flow deletes selected top-level documents but does not visibly delete chat message subcollections, storage objects, accepted pairs, reviews, reports, verification records, skipped records, analytics, or all Auth-related data.
13. **Static sitemap drift:** sitemap advertises `/calculator`, which has no application route.

## Phase 0 exit criteria

- Architecture, route graph, production features, domain components/hooks, Firebase operations, collections, storage, auth, roles/states, business rules, dependencies, and external services are mapped from current code.
- No production source or existing test behavior was changed during discovery.
- Pre-existing modifications to `app/package-lock.json` and `app/vite.config.ts` were preserved.

## Final audit note (2026-10-09)

Discovery leads 1–10 were remediated in the active product/test foundation and verified as described in `DEFECT-LOG.md`. Lead 12 (account deletion completeness) is now implemented as a trusted callable backend and verified in emulator integration plus browser tests. Lead 13 (sitemap `/calculator` drift) remains an open P3. Inactive/unreachable components in lead 11 remain mapped but are not counted as validated production flows.

The production build now guards both the `/dev/seed` route and its lazy import with `import.meta.env.DEV`, so the destructive seed page is absent from production assets.
- Runtime behavior, data integrity, security boundaries, and browser behavior are intentionally **not certified** by this document; they proceed through Phases 1–16.
