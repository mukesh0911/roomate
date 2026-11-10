# Discovery and listing workflow

**Phase 1 — proposed product design, not implemented behavior.** Prepared 5 November 2026. Deliverables are confined to docs/master-product-blueprint/. The approved user-facing visual design is a constraint. Existing source, UI, Firebase schemas/rules/functions, dependencies and data are unchanged. “Target” describes the reviewed-to-be product contract; numeric, retention and rollout choices marked policy approval required are proposals, not existing promises.

## Section contracts

| Section | Belongs here | Must not appear | Card evidence | Filters/sort | Detail/return |
| --- | --- | --- | --- | --- | --- |
| All listings | Published available physical room/flat/managed inventory. | Human profiles, drafts/rejected/filled/expired or restricted-publisher records. | Discriminated listingId/kind, locality, honest photo state, price+unit, availability, scoped trust and freshness. | Supported city/locality/type/unit/rent/availability filters; newest or unit-scoped rent order. | /places/:listingId; context retained on return. |
| Rooms and flats | Private/shared rooms and entire flats, with BHK separate from room type. | People, fabricated spare rooms, PG beds hidden as an ordinary full flat. | Actual offered unit and share; declared included charges/deposit; resident relationship only when explicit. | Room type, BHK, furnishing, supported amenities/rules and move-in; query-backed predicates. | Same canonical place detail; related publisher/resident UID resolved separately. |
| Roommates | Opted-in team_up people and genuine available have_room resident profiles. | find_room-only members, nonresident commercial advertisers, staff-only identities, restricted/inactive/opted-out or invalid-host-only cards. | UID, explicit active intent badge, consented area/budget/lifestyle, evidence/unknown fit, related available listing only if valid. | Supported geography/preferences; discoverable cohort; no invented compatibility for incomplete viewers. | /people/:uid; public card and relationship projection use explicit access scopes. |
| PG and coliving | Managed accommodation with real per-bed/per-room options and declared available capacity. | Synthetic one-bed options, implied nightly bookings or fabricated owner-roommate fit. | Kind, monthly price/unit, actual deposit/fees, managed amenities/rules, availability and publisher trust meaning. | City/locality, managed type, pricing unit, capacity and supported house conditions. | /places/:listingId renders managed fields without inventing separate entity identity. |

## Search and pagination

Landing, city cards and in-app filters serialize one typed query: supported city ID, locality IDs/text contract, entity kind, pricing unit/currency, optional rent bounds, move-in constraint and supported property/member predicates. City never becomes an unlabelled locality substring. Define exact/prefix/token semantics and unsupported-query feedback. Apply supported predicates before cursor pagination; arbitrary loaded-card filtering is not advertised as a complete market search. Server query scope and result completeness are displayed truthfully.

Use stable order plus ID tie-breaker and opaque cursor carrying query/ranking version. A filter/sort/city change creates a new query key and invalidates the old cursor; late responses cannot replace it. Budget exhaustion during sparse eligibility scanning must preserve a valid continuation, not claim the database is empty. Supporting resident-listing lookups must fit the whole-operation read budget. Deduplicate by entity kind+ID. Live head changes signal new/changed results without reordering the user’s current scroll unexpectedly.

Newest and same-unit rent orders have a dataset-wide contract over the supported query. Best match is not a synonym for arbitrary loaded sorting. Under D14 a bounded suggestion cohort is labelled explicitly, with its ranking model/version, known factors and missing evidence; it must not claim a global optimum. Missing preference is unknown, and a genuine computed zero remains zero. Do not replace it with an attractive baseline.

## Empty/error states

Distinguish no inventory in a supported city, no results for current valid filters, incomplete viewer setup for personalized suggestions, directory opt-out/no eligible candidate, temporary permission/network failure and exhausted versus continuation-available scan. Offer relevant clear-filter/change-city/complete-setup/retry actions. Never substitute verified stock listings after an empty or failed request. No “seen everything” statement unless the authoritative query is exhausted.

## Property listing lifecycle journey

Publisher Post → action-specific auth/setup → existing/new private draft → supported photos → kind/location → price/deposit/unit/capacity/move-in → explicit publisher/residence declarations → amenities/rules/questions → preview → Save draft or Submit for review. “Close” and “Save draft” have different persistence contracts. Required questions are validated before listing-specific inquiry submission; answers are private to applicant/publisher/scoped moderation, not public listing fields.

Submit acknowledges a review submission, never a public booking/publication. Content review and identity review are separate. Approved eligible availability produces the public version. Material edits create a new review version; the previous public version is preserved or paused under an explicit field-change policy. Owner pause/filled/reconfirm are separate availability commands. Filled/offline-arranged inventory can be reopened only after current publication, authorization, account and freshness checks. Shared links show the real inactive state where disclosure is allowed.

## Public information and privacy

Public detail shows actual locality/approximate area, actual price/deposit/charges/unit, declared amenities/conditions, photos with functional missing/error fallback, current capacity/available date, update/freshness context, publisher identity subset and narrowly worded trust labels. Exact unit address and contact details remain private until explicitly shared. Approximate coordinates, if a map is later retained, must be labelled approximate; a UID-derived offset is not a real property location.

Implementation requires the separate review requested by the user. Current-source comparisons and evidence limitations are in EXISTING_APPLICATION_GAP_ANALYSIS.md; target acceptance criteria must not be counted as executed tests.
