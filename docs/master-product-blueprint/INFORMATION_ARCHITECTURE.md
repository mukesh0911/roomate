# Information architecture

**Phase 1 — proposed product design, not implemented behavior.** Prepared 5 November 2026. Deliverables are confined to docs/master-product-blueprint/. The approved user-facing visual design is a constraint. Existing source, UI, Firebase schemas/rules/functions, dependencies and data are unchanged. “Target” describes the reviewed-to-be product contract; numeric, retention and rollout choices marked policy approval required are proposals, not existing promises.

## Navigation principles

Retain the existing visible navigation and responsive treatment: Explore, Saved, Post, Messages, account/profile and contextual Connections/My listings/Notifications. Keep staff tools separate. Stable routes make current detail/overlay sections addressable without changing their visual layout. Do not build a new dashboard for every housing intent. Contextual deep routes open the same approved detail, wizard, table and drawer designs.

```mermaid
flowchart LR
  Home[/Landing/] --> Explore[Explore: All places / Rooms / Roommates / PG]
  Explore --> Place[/places/:listingId]
  Explore --> Person[/people/:uid]
  Saved[Saved: Places / People] --> Place
  Saved --> Person
  Place --> Inquiry[Listing inquiry]
  Person --> Consent[Pair request]
  Inquiry --> Connections[Connections]
  Consent --> Connections
  Connections --> Messages[Messages/:conversationId]
  Messages --> Place
  Messages --> Person
  Post[Post] --> Wizard[Listings/new or edit]
  Listings[My listings] --> Wizard
  Listings --> Applicants[Listings/:id/applicants]
  Applicants --> Compare[Listing comparison]
  Applicants --> Messages
  Account[Profile] --> Prefs[Preferences + disclosure]
  Account --> Identity[Manual verification]
  Account --> Settings[Security / privacy / data / outcomes]
  Staff[Admin] --> Queues[Scoped moderation/review/jobs]
```

## Route and context contract

| View | Target durable location | Preserved state |
| --- | --- | --- |
| Explore categories | /explore?tab=all / rooms / roommates / pg&city=…&… | Typed city/localities/filter/sort; opaque continuation cursor; scroll restoration. |
| Place/person detail | /places/:listingId; /people/:uid?contextListing=… | Entity kind/ID + safe authorized return descriptor; no raw sensitive criteria in URL. |
| Member resume views | /saved?tab=…; /connections?tab=…; /notifications | Entity tab/status filters; own scope; target references by ID. |
| Conversation | /messages/:conversationId | Paged history/read cursor and context references; draft account-scoped. |
| Publisher work | /listings; /listings/new; /listings/:id/edit / applicants / compare | Owned draft/review/application IDs and version; no comparison by unstable indices. |
| Shared setup/account | /onboarding?returnTo=…; /profile?section=… | Saved progress; safe return ID; explicit public/private preview scope. |
| Staff | /admin?section=…&recordType=…&record=… | Capability-authorized selected record and pagination; no sensitive document URL in query. |
| Informational destinations | /help /safety /privacy /terms /about /how-it-works | Actual reviewed content and origin context; no wildcard substitution. |

## Back, refresh and aliases

Opening a detail pushes history and retains an allowlisted origin query/scroll descriptor; closing returns there, not a guessed default. Switching a filter replaces the current query and invalidates only its cursor; explicit section navigation pushes a new entry. Browser Back closes a URL-addressed overlay/detail before leaving its parent. Refresh loads the target by ID without the old feed. Sensitive forms retain only account-owned safe drafts; credentials/ID bytes/precise addresses are not stored in URLs or shared browser storage.

Existing /explore?room=id links receive a compatible stable-detail resolution. Current eight routes remain valid entry points. Absent legacy /login, /chat and /owner-dashboard need explicit reviewed redirects only where their meaning is unambiguous; unknown paths show a useful not-found state rather than disguising an error as home. Auth redirects reject external/unsafe return destinations. No active request is automatically replayed after authentication.

## Consolidation and reachability

Keep one visible staff console and one canonical service contract; merge the embedded legacy Explore admin surface only after parity is characterized. Preserve distinct Saved entity tabs, listing applicants and pair Connections because their purposes differ. Informational/consent content belongs near the action as well as at its real destination. Incomplete optional controls are explicitly disabled or omitted until a complete lifecycle exists, not made clickable merely to produce a toast.

Implementation requires the separate review requested by the user. Current-source comparisons and evidence limitations are in EXISTING_APPLICATION_GAP_ANALYSIS.md; target acceptance criteria must not be counted as executed tests.
