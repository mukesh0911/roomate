# NestMate Feature / Element Matrix

**Evidence date:** 2026-10-08  
**Inventory basis:** current routed pages and the production components/hooks they render  
**Counting rule:** one row represents one semantic control/action. Desktop/mobile duplicate renderings wired to the same handler are one element; repeated item controls (one per card/list row) are one element type. Purely decorative elements and generic UI-library primitives that have no product action are excluded.

Every row is initially `DISCOVERED`; test status and evidence are tracked separately in `QA/TEST-COVERAGE.md`.

## Global shell and navigation

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Shell | Logo/home link | All | Any routed page with main layout | Activate | Owner goes to dashboard; others landing page | None | Role-aware navigation | Route remains usable without profile | Anonymous, seeker, owner |
| Shell | Desktop primary nav links | All | Desktop viewport | Open Rooms/Dashboard, Find Seekers, Messages, Profile | Correct route/tab highlights | None | Role-specific link set | Protected target prompts login | Anonymous, seeker, owner |
| Shell | Mobile bottom nav: Rooms/Dashboard | All | Mobile viewport | Tap | Opens Explore rooms or owner dashboard | None | Role-aware destination | No horizontal overflow | Anonymous, seeker, owner |
| Shell | Mobile bottom nav: Messages | All | Mobile viewport | Tap | Auth modal or chat page | None | Auth required for chat | Anonymous never enters protected page | Anonymous, onboarded user |
| Shell | Mobile bottom nav: Profile | All | Mobile viewport | Tap | Auth modal or profile page | None | Auth required | Anonymous never enters profile | Anonymous, onboarded user |
| Shell | Mobile bottom nav: Menu | All | Mobile viewport | Tap/open/close/escape/backdrop | Drawer opens/closes and remains scrollable | None | Same actions as desktop | Focus/overlay must not trap page after close | Anonymous, seeker, owner |
| Shell | Post Room CTA | All | Main layout | Activate | Auth prompt, listing editor, or role guidance | None | Only owner proceeds directly | Seeker is directed to settings; anonymous signs in | Anonymous, seeker, owner |
| Shell | Notification bell | All | Main layout | Activate | Auth prompt or notifications page; unread badge shown | None | Recipient-only feed | Count remains zero on listener failure | Anonymous, user with unread notifications |
| Shell | Profile menu | Authenticated | Desktop | Open; choose dashboard/profile/settings/admin/logout | Correct target/action | Logout clears auth/UI state | Admin item only for admin | Click outside closes | Seeker, owner, admin |
| Shell | Global auth modal | Anonymous | Protected CTA | Open, continue to login, close | Modal title/redirect preserved | Local UI state only | Original target retained | Close cancels without navigation | Anonymous |

## Landing and public information

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Landing | Hero category selector | Anonymous/all | `/` | Select room/roommate intent | Selected category styled | None | Search target reflects intent | Keyboard selection works | None |
| Landing | Hero city/location input | Anonymous/all | `/` | Enter/select location | Query text displayed | None | Passed to Explore query | Empty query remains valid | Static city/locality data |
| Landing | Hero search CTA | Anonymous/all | `/` | Activate | Navigates to Explore with query params | None | No auth needed to browse | Invalid text must not crash | None |
| Landing | Featured listing cards | Anonymous/all | Active visible listings exist | Open a card | Navigates to `/room/:id` | Read only | Only visible/fresh listings shown | Empty/error fallback, no fabricated listing | Active and hidden listings |
| Landing | Owner/list-room CTAs | Anonymous/all | `/` | Activate | Login/role flow or listing workflow | None | Owner-only creation | Seeker guidance | Anonymous, seeker, owner |
| Landing | Navbar/footer links | All | `/` | Open info/legal/social links | Correct internal page or external target | None | Internal links match route table | No `/calculator` navigation from product UI | None |
| Public info | Trust/Safety/Help/About/How it works/Privacy/Terms links and CTAs | All | Relevant route | Activate available links/CTAs | Correct destination/content | Support submit is separate row | Public access | Not-found/external failures are explicit | None |
| Help | Support form fields + submit | All | `/help` | Fill category/subject/message/contact and submit | Validation then success/error feedback | Create `supportTickets` doc | Submit must be authorized by rules | Permission/network error visible; no false success | Anonymous and authenticated user |
| Pricing | Plan cards / choose plan | All | `/pricing` | Select plan | Checkout prompt/script or login guidance | No trusted payment state in repo | Payment not treated as verified client-side | Script failure shown; cancel safe | Free/premium persona |

## Authentication and onboarding

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Auth | Google sign-in button | Anonymous | `/login` | Activate popup and complete/cancel | Route to redirect, role select, onboarding, or dashboard | New user profile/private record if needed | Firebase user ↔ `users/{uid}` | Popup cancel/error remains on form | New/existing Google test account |
| Auth | Email field | Anonymous | Email mode | Type | Value/validation shown | None | Normalized email used | Required/invalid email error | Existing/new test email |
| Auth | Password field + visibility toggle | Anonymous | Email mode | Type/toggle | Mask state changes | None | Minimum 6 for signup path | Required/short/incorrect password error | Existing test credential |
| Auth | Email continue/submit | Anonymous | Valid fields | Activate | Existing signs in; unknown may create; correct redirect | Firebase auth plus new profile/private record | No login loop; onboarding derived from real profile | Firebase error translated and surfaced | Existing/new persona credential |
| Auth | Forgot password link/form | Anonymous | Email mode | Open, enter email, submit | Success or error feedback | Firebase reset email request | Does not reveal unsafe state beyond provider behavior | Missing/invalid/provider error | Test email |
| Auth | Back/switch auth-method links | Anonymous | Auth subview | Activate | Correct form without stale error/loading | None | Values intentionally retained/cleared | No duplicate submit | None |
| Auth | Logout controls | Authenticated | Shell/profile/admin | Activate | Returns public, protected route inaccessible | Firebase session cleared; UI state reset | All tabs/contexts isolated | Reload stays logged out | Seeker, owner, admin |
| Auth guard | Protected-route redirect | Anonymous | Direct protected URL | Navigate | `/login` (redirect where supported) | None | No protected data read | No bounce loop | Anonymous |
| Auth guard | Suspended/banned screen | Restricted user | Protected URL | Navigate/logout | Restriction message and sign-out | None | Restricted accounts cannot interact | Public pages remain accurately scoped | Suspended, banned |
| Role selection | Seeker card | Authenticated incomplete | `/role-select` | Select | Seeker onboarding opens | `users.role=seeker` | Self update only | Write error blocks navigation | Roleless user |
| Role selection | Owner card | Authenticated incomplete | `/role-select` | Select | Owner onboarding opens | `users.role=owner` | Self update only | Write error blocks navigation | Roleless user |
| Seeker onboarding | Back/next step controls | Incomplete seeker | Required prior fields | Navigate steps | Step/progress changes, values retained | None until saves | Cannot skip required fields | Inline validation | Incomplete seeker |
| Seeker onboarding | Identity/profile fields | Incomplete seeker | Seeker role | Enter name, city/localities, age/gender, profession/company, bio, move-in, budget | Values/validation display | Final update to own profile | Meaningful data required | Invalid/empty fields block finish | Incomplete seeker |
| Seeker onboarding | Avatar upload/remove | Incomplete seeker | Image selected | Upload/remove | Preview/progress | Storage profile object + avatar URL | Owner path/type/size | Upload failure recoverable | Image fixture |
| Seeker onboarding | Lifestyle quiz answers | Incomplete seeker | Quiz step | Select answers | Answer selection/progress | `quizAnswers` on finish | At least five answers | Missing answers block completion | Quiz fixture |
| Seeker onboarding | Finish | Incomplete seeker | Valid form/quiz | Submit | Explore/dashboard opens | `onboardingComplete=true` and profile fields | Server rules validate payload | Failed write stays on page | Incomplete seeker |
| Owner onboarding | Back/next step controls | Incomplete owner | Required prior fields | Navigate | Step/progress changes | None until save | Cannot skip required fields | Inline validation | Incomplete owner |
| Owner onboarding | Owner/property fields | Incomplete owner | Owner role | Enter identity, owner type, city/locality, property/household data | Values retained | Own user profile update | City/name required for completion | Invalid fields block finish | Incomplete owner |
| Owner onboarding | Finish/create listing CTA | Incomplete owner | Valid form | Submit | Listing creation flow opens | `onboardingComplete=true` | Owner role required | Write error visible | Incomplete owner |

## Explore, search, filter, sort, map, and saved items

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Explore | Main tabs: rooms, roommates, PG, saved, connections | All/role-dependent | `/explore` | Switch tab | URL and panel update | None | Owner roommate route redirects to owner seekers | Invalid tab falls back predictably | Mixed listings/profiles |
| Explore | Search input + clear | All | Discovery tab | Type/clear | Results filter; clear restores | Analytics search event when eligible | Search uses real data, not UI text as source | No-results state | Searchable fixtures |
| Explore | City selector | All | Discovery tab | Select city/all | Results scoped and URL/state updated | None | Explicit cross-city widening must be disclosed | Empty city result handled | Multi-city data |
| Explore | Sort selector | All | Results exist | Choose match/newest/price | Deterministic order | None | Comparator matches selected sort | Missing dates/prices stable | ≥3 varied records |
| Explore | Advanced filter trigger/apply/reset/close | All | Explore | Configure budget, locality, gender, verification, flat type, furnishing, amenities, lifestyle | Chips/count/results update | None | All selected filters applied with documented AND/OR semantics | Invalid min/max and zero results | Boundary fixtures |
| Explore | Room/PG cards | All | Visible listings | Open, save, share/contact as offered | Detail/auth modal/saved state | Save updates own `savedRoomIds` | Hidden listings absent | Broken image/data has fallback | Active, stale, expired, paused, unverified |
| Explore | Roommate cards | All | Visible profiles | Open, save, connect/accept as offered | Detail/auth/status state | Saved/connect mutations | Self/blocked/restricted profiles absent | Missing quiz shows honest caveat | Strong/weak/dealbreaker profiles |
| Explore | Saved sub-tabs and remove saved | Authenticated | Saved tab | Switch rooms/flatmates; toggle heart | List and counts update | Own saved arrays update | Only own profile changes | Missing/deleted saved ID ignored clearly | Saved and orphan IDs |
| Explore | Connections sub-tabs and actions | Authenticated | Connections tab | View connected/received/sent; accept/reject/open chat | State/count updates live | Connection/accepted-pair/chat writes | Recipient decides; participant only | Empty states; denied action visible | Pending/accepted/rejected connections |
| Explore | Load more | All | More than page size | Activate/scroll | Unique next records append | Reads only | No duplicates; cursor reset on filter | End state disables safely | >20 profiles/listings |
| Explore | Map/list toggle and markers | All | Geocoded results | Toggle/open marker/popup/recenter/zoom | Correct records and privacy radius shown | Optional self-owned coordinate persistence | Visibility gates match list view | Geocode/tile failure fallback | Geocoded/missing-coordinate data |

## Listing detail and lifecycle

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Listing detail | Gallery thumbnails/next/previous | All | Listing with images | Navigate | Selected image changes | None | No mutation | Missing/broken image fallback | Multi/no-image listings |
| Listing detail | Back/share/map/nearby links | All | Valid listing | Activate | Back/share sheet/external map target | None | Share uses current canonical detail URL | Share API unavailable falls back | Active listing |
| Listing detail | Save | Anonymous/user | Valid listing | Toggle | Auth prompt or heart/count state | Own `savedRoomIds` | No cross-user write | Write failure reverts/shows error | Seeker + listing |
| Listing detail | Connect/apply | Anonymous/seeker | Not self; active visible listing | Start, answer screening, submit | Auth/questionnaire/pending state | Connection + quota increment + owner notification | Quota, no duplicate/self, listing attribution | Quota/permission/inactive listing errors | Active listing, owner, quota user |
| Listing detail | Accept/reject incoming | Recipient | Pending inbound relation | Decide | Connected/rejected state | Connection plus accepted pairs; notification/chat as UI invokes | Recipient only | Unauthorized caller denied | Pending connection |
| Listing detail | Chat/contact | Accepted participants | Accepted relation | Open | Chat room/contact modal | Room may be created; contact read | Accepted relationship required | Unaccepted user sees locked state | Accepted pair/contact |
| Listing detail | Report | Active authenticated | Target not self | Select reason/description and submit | Success feedback | Pending report | Allowed reasons; ≤2000; reporter bound | Duplicate/self/invalid/denied error | Reporter + target/listing |
| Listing detail | View tracking | Visitor | Open detail | Load once/reload/session | View display/analytics updates once per session/day | Listing views + daily aggregate + event | Owner self-view excluded | Analytics failure non-fatal | Listing + owner/visitor |
| Listing detail | Similar cards | All | Valid listing | Open suggested listing | Correct detail | Reads only | Exclude current/hidden listings | Empty state | Same/different city listings |
| Listing guard | Hidden listing direct link | Non-owner vs owner | Pending/unverified/closed ID | Open | Non-owner sees unavailable; owner can manage/preview as designed | None | Discovery gates cannot be bypassed for interaction | Not found distinct from unavailable | Each lifecycle state |
| Listing editor | Form fields | Owner | `/edit-listing/new` or owned ID | Enter title/description/type/furnishing/location/rent/deposit/capacity/date/amenities/rules/preferences | Validation and preview | Create/update owned listing | Required/range validation; owner only | Invalid data; foreign listing denied | Owner, owned/foreign listing |
| Listing editor | Image add/remove/reorder | Owner | Editor | Upload/manage | Preview/progress/order | Storage objects + images array | File constraints and ownership | Partial upload failure recoverable | Image fixtures |
| Listing editor | Save/publish | Owner | Valid form | Submit | Dashboard/detail route and success | New pending/unverified listing or owned update | Cannot self-activate unverified listing | Rule/network error no false success | Verified/unverified owners |
| Listing editor | Pause/resume | Owner | Existing listing | Toggle | Badge/control state updates | Status update | Active only if verified | Pending listing cannot activate | Active/paused/pending listings |
| Listing editor | Delete/cancel | Owner | Existing/dirty form | Confirm/cancel | Return/modal behavior | Delete owned listing only | Destructive confirmation | Foreign/denied delete error | Owned listing |
| Owner dashboard | Overview/listings/applicants/seekers tabs | Owner | Onboarded | Switch/deep-link | Correct panel and URL | Reads/subscriptions | Owner-only route | Empty/loading/error per tab | Owner portfolio/applicants/seekers |
| Owner dashboard | Confirm availability | Owner | Verified non-pending listing | Activate | Freshness label/chart state updates | `status=active`, timestamps/event | Owner only; no unverified activation | Failure visible | Stale/expired/verified listing |
| Owner dashboard | Close/fill/delete listing | Owner | Owned listing | Confirm action | Listing leaves active areas | Status/delete write | Owner only | Confirmation and error recovery | Active listing |
| Applicant compare | Applicant selection/compare/choose | Owner | 2+ pending/accepted applicants | Select/compare/choose | Ranked comparison and chosen state | Listing filled + notification when choosing | Candidates belong to owner relationship/listing | Insufficient/foreign IDs rejected | Multiple attributed applicants |

## Connections, chat, notifications, profile, settings

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Connection | Send/duplicate/quota boundary | Active user | Eligible target | Send at 4/5, 5/5, premium | Pending or upgrade/error state | Connection + atomic counter | Limit 5 unless premium; no duplicate/self | Direct backend bypass denied | Boundary personas |
| Connection | Accept/reject/block/withdraw | Participant | Matching state/direction | Act | Live state updates both contexts | Connection/accepted-pair changes | Directional decision rules | Nonparticipant denied | Each connection state + third user |
| Chat | Conversation list/search/select | Participant | Chat rooms exist | Search/select | Correct counterpart, last message, unread state | Reads; selected incoming messages marked read | Only participant rooms | Empty/unauthorized room state | Empty/existing/unread chats |
| Chat | Text compose/send | Participant | Selected room | Type, send/Enter | Optimistic/real message appears in both contexts | Message + room last-message metadata | Non-empty; sender must be authentic | Empty, offline, denied send | Two independent users |
| Chat | Image attach/send/remove | Participant | Selected room | Choose/upload/send | Preview/progress/image message | Chat storage object + message URL | Image/size and participant access | Invalid/upload failure | Image fixture |
| Chat | Typing/read indicators | Two participants | Both contexts open | Type/read | Other context updates without reload | Room typing and message read fields | Participants only | Listener failure graceful | Live two-user chat |
| Chat | Phone-share request/accept | Accepted users with phones | Selected room | Request/accept | System message and revealed numbers | Room phoneSharing fields/messages | Mutually accepted relationship intended | Missing phone/unaccepted state locked | Accepted pair + contacts |
| Notifications | Filter/read/delete/open action | Recipient | Feed populated | Filter, mark one/all, delete, open | Counts/styles/navigation update live | Own notification update/delete | Recipient only | Empty/invalid action URL/error | Multiple types/read states |
| Notifications | Browser permission | Authenticated | Supported browser | Enable/deny | Permission feedback | Browser state only | No claim of remote push | Unsupported/denied states | Browser contexts |
| Profile | View/edit/preview links | Authenticated | Profile exists | Navigate | Correct own/public-safe data | Reads only until save | PII not rendered publicly | Missing profile/error state | Complete/incomplete profile |
| Profile | Edit identity/preferences/social/avatar | Owner of profile | Edit page | Change and save | Updated profile/trust completeness | Public-safe fields, private PII, storage | Protected trust fields immutable | Invalid URL/file/write errors | Seeker/owner |
| Profile | Save/skip/block/report another user | Active user | Target profile | Act | Card/detail state changes | Own arrays/report | No self/cross-user escalation | Restricted/duplicate target behavior | Candidate/blocked data |
| Profile | Reviews/vouches | Authenticated | Other profile | Rate/write | Review appears | New review | No self, one per reviewer target, 1–5 | Duplicate/invalid/denied | Reviewer/target/existing review |
| Preferences | Budget/location/lifestyle controls + save | Seeker | `/preferences` | Modify/save | Values persist after reload | Own preferences/profile update | Seeker route only | Validation/write error | Seeker |
| Settings | Account/privacy/notifications/appearance tabs | Authenticated | `/settings` | Switch | Correct panels | None | Role-neutral | Mobile layout/keyboard works | Seeker, owner |
| Settings | Toggle controls | Authenticated | Settings panel | Toggle visibility/messages/email/push/dark mode | Immediate UI, persisted reload | `users.settings` update | Own settings only | Write failure reverts/reports | User |
| Settings | Language selector | Authenticated | Appearance | Select language | Supported shared labels change | Settings language update | Fallback English for missing key | Unknown code safe | User |
| Settings | Switch role confirm/cancel | Authenticated | Account tab | Confirm/cancel | New role dashboard/onboarding expectation | `users.role` update | Does not grant admin/trust | Failure retains old role | Seeker and owner |
| Settings | Export data | Authenticated | Account tab | Download | JSON/archive download | Reads own allowed data | No other-user data | Partial query failure must not claim complete | Rich user dataset |
| Settings | Delete account confirm | Authenticated | Recent login; type DELETE | Confirm/cancel | Account gone or explicit reauth/error | Related Firestore/Auth/storage cleanup | No orphan/private leakage | Partial failure reported and recoverable | Disposable account with dependencies |

## Verification, moderation, admin

| Feature | Element | User role | Precondition | Action | Expected UI result | Expected data result | Expected business rule | Expected error / negative state | Required test data |
|---|---|---|---|---|---|---|---|---|---|
| Legacy verification | Document type/file/submit | Authenticated | Edit profile verification section | Submit | Pending item/status | Protected storage object + `verifications` doc | Self only | Invalid/upload/rule error | User + file |
| Owner verification | Document type/name/file/submit/resubmit | Owner | Not approved or rejected/resubmit | Submit | Status panel changes live | `ownerVerifications/{uid}` + storage URL | Owner can only set safe states | Approved self-write denied | Each verification state + file |
| Admin shell | Admin navigation/back/logout | Admin | `/admin` | Navigate | Correct admin page/badges | Reads metrics | Admin only | Non-admin redirected | Admin, non-admin |
| Admin dashboard | KPI cards/recent activity links | Admin | Seeded platform | Open/drill down | Counts/navigation match data | Reads collections | Admin only | Loading/error state | Mixed platform data |
| Admin users | Search/filter/paginate/detail/suspend/ban/reinstate/verify | Admin | Users exist | Act | Row/status updates | User/listing mutations | No self-escalation by non-admin | Confirm/error states | Active/suspended/banned users |
| Admin listings | Search/filter/paginate/status/delete | Admin | Listings exist | Act | Row/count updates | Listing update/delete | Allowed lifecycle only | Confirm/error states | All listing states |
| Admin reports | Search/filter/detail/resolve/dismiss/suspend/ban | Admin | Reports exist | Act | Queue/status updates | Report and optional user/listing updates + notification | Admin only | Missing target/duplicate decision | Pending/resolved/dismissed reports |
| Admin verifications | Filter/detail/begin review/approve/reject/resubmit | Admin | Verification records exist | Act | Queue/status/listing visibility updates | Verification, user, listings, notification | Admin only; note required where applicable | Missing docs/partial side effect surfaced | All verification states/listings |
| Admin notifications | Audience/title/message/action + send/history | Admin | Users exist | Broadcast | Success/history/count | `broadcasts` + recipient notifications | Admin only | Empty audience/partial fan-out | Seekers/owners |
| Admin marketplace | Date/filter/metric charts | Admin | Analytics events exist | Change filters | Aggregates update | Read only | Admin-only analytics | Empty/malformed event safe | Event fixtures |
| Admin settings | Admin registry add/remove/config | Admin | Registry exists | Manage | List/status updates | `admins` and config writes | Existing admin only; normalized email | Cannot silently lock out/invalid email | ≥2 admin identities |
| Admin settings | Clean seed data | Admin | Isolated test environment | Confirm | Progress/results | Only tagged deterministic test data removed | Never production/protected accounts | Hard fail outside isolated project | Test-tagged + protected docs |
| Admin settings | Nuclear wipe | Admin | Explicit isolated disposable environment and phrase | Confirm | Progress/logout | Scoped disposable data deletion | Never enabled against production | Hard fail without guard | Emulator-only dataset |

## Static states required on every data-bearing route

Each applicable route above must separately demonstrate:

| State element | Expected result | Required data/environment |
|---|---|---|
| Loading state | Stable skeleton/spinner with accessible status; no stale wrong-role content | Delayed request |
| Empty state | Accurate action-oriented message; no fabricated records | Valid empty dataset |
| Error state | Actionable error/retry or safe fallback; no false success | Denied/network/query failure |
| Success state | Visible acknowledgement tied to completed write | Successful mutation |
| Reload state | Server-backed state persists; transient modals/toasts do not fabricate persistence | Completed mutation |
| Second-user state | Only intended counterpart sees the transition, live where claimed | Independent browser contexts |

## Phase 1 exit status

- Production route and semantic interactive-control inventory: **mapped**.
- Expected UI/data/business/negative/test-data contracts: **mapped**.
- Runtime coverage: **not yet certified**; rows become covered only with evidence recorded in later phases.
