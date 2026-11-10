# Page-by-page product specification

**Phase 1 — proposed product design, not implemented behavior.** Prepared 5 November 2026. Deliverables are confined to docs/master-product-blueprint/. The approved user-facing visual design is a constraint. Existing source, UI, Firebase schemas/rules/functions, dependencies and data are unchanged. “Target” describes the reviewed-to-be product contract; numeric, retention and rollout choices marked policy approval required are proposals, not existing promises.

## Current entry points and target view specifications

The existing app has eight concrete routes backed by three page implementations. The 22 target view specifications below include detail, contextual, account and staff subviews; they are not a claim that 22 pages currently exist. Proposed stable routes can render the approved existing layouts. No route/UI has been added here. Every action references the complete transition contract in COMPLETE_USER_EXPERIENCE_FLOW.md.

## P01 — Landing

**Identity:** /. Parent: Public entry. Intended user: Visitor/member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Supported service cities; actual featured listing projections and counts; informational content. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Location/budget/date/category form; city links; browse; sign in/register; Post; featured open/save; FAQ; honest trust/story/footer links.

**Action contracts:** T01, T03, T05. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** A chosen search or safe return action is carried intact to discovery/auth. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P02 — Authentication

**Identity:** Global modal + safe return query. Parent: Overlay on invoking page. Intended user: Visitor/member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Supported provider state, email/password inputs, safe internal return descriptor, generic auth errors. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Sign in, register, Google, reset password, switch modes, close/Escape. Demo entry only in verified emulator development mode.

**Action contracts:** T03. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Session is established; resume the intended action after its remaining prerequisites, without auto-sending it. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P03 — Shared onboarding

**Identity:** /onboarding?returnTo=…. Parent: Account/setup. Intended user: Active incomplete member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Name, city, primary locality; selected concurrent intents; explicit discoverability; progressive optional lifestyle/budget/host details. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Save step, back, skip optional fields, review disclosure, finish essentials, resume original context.

**Action contracts:** T04. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Essential profile and chosen intent state persist; optional skipped values remain unknown. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P04 — All physical discovery

**Identity:** /explore?tab=all. Parent: Explore. Intended user: Visitor/member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Published/available/active-publisher property cards, kind, price unit, city/locality, freshness and disclosed trust. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Search, city, supported filters, sort, grid/list, continuation, open, save, clear filters.

**Action contracts:** T01, T02, T05. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** A property detail opens by listingId while search/filter/cursor/scroll context is recoverable. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P05 — Rooms/flats discovery

**Identity:** /explore?tab=rooms. Parent: Explore. Intended user: Visitor/member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Physical room/shared-room/entire-flat listings; roomType, BHK and pricing unit are separate fields. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Supported room/flat filters; newest or unit-specific rent order; card open/save.

**Action contracts:** T01, T02, T05. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Appropriate physical listing is inspected; people are never substituted as room records. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P06 — People discovery

**Identity:** /explore?tab=roommates. Parent: Explore. Intended user: Authenticated authorized member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Minimal opted-in eligible team-up/resident cards; actual intent, consented preferences, evidence-qualified fit. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Complete own missing setup, filter, supported rank, open person, save, request/withdraw/respond/message according to relationship.

**Action contracts:** T01, T02, T05, T07. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Open /people/:uid; contextual relationship state remains consistent elsewhere. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P07 — PG/coliving discovery

**Identity:** /explore?tab=pg. Parent: Explore. Intended user: Visitor/member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Managed accommodation with explicit room/bed unit, actual capacity/options, fees and rules. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** PG filters, unit-specific rent order, open/save, continuation.

**Action contracts:** T01, T02, T05. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Open the same canonical property detail by listingId, with managed-accommodation fields. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P08 — Accommodation detail

**Identity:** /places/:listingId. Parent: Explore or shared/Saved link. Intended user: Visitor/authorized member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Published projection or authorized owner draft; publisher UID; declared resident linkage; photos; price/deposit/unit; availability; questions; review/freshness labels. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Gallery, save, share, publisher/resident profile, report, Express interest/Request to chat, edit/manage only for authorized publisher.

**Action contracts:** T02, T03, T05, T06, T17, T22. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Member can create a listing-attributed inquiry and consent request, or continue an already accepted conversation. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P09 — Person/publisher detail

**Identity:** /people/:uid?contextListing=…. Parent: Explore/Connections/Messages/place detail. Intended user: Authorized member; minimal public publisher subset where allowed.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Authorized profile projection, context scope, intent/residence evidence, availability, known/missing preferences, relationship state. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Save, report, request/withdraw/accept/decline/message, own block/unblock, related available place; publisher view omits unsupported roommate claims.

**Action contracts:** T02, T05, T07, T08, T09, T10, T11, T16, T17. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** The correct UID is resolved independently of feed position; no automatic PII disclosure. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P10 — Saved

**Identity:** /saved?tab=places|people. Parent: Member navigation. Intended user: Signed-in member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Typed own bookmarks plus batched authorized entity-by-ID results, unavailable tombstones and original entity kind. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Open, remove save, change entity tab, retry unavailable fetch.

**Action contracts:** T02, T05. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Saved IDs persist; unavailable items never masquerade as empty successful fetches. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P11 — Connections

**Identity:** /connections?tab=incoming|sent|accepted|closed. Parent: Member navigation. Intended user: Signed-in member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Own pair-request summaries with version, direction, listing context, counterpart projection and expiry/restriction reason scope. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Accept/decline, withdraw, open person/context listing, message if accepted, see own closed/reopened states.

**Action contracts:** T02, T08, T09, T10, T11. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Communication consent changes are authoritative and reflected for both users. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P12 — Messages

**Identity:** /messages and /messages/:conversationId. Parent: Member navigation. Intended user: Authorized participant.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Authorized room list, partner projection, per-member read state, paged messages and optional listing context cards. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Search list, unread filter, open conversation, text/send, attachment upload, retry failed draft, partner/context link, report/block, explicit contact-share request/response.

**Action contracts:** T02, T11, T12, T13, T14, T15, T16, T17. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Delivery is acknowledged by persisted message ID; read state and context survive reload. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P13 — Notifications

**Identity:** /notifications. Parent: Existing notification affordance. Intended user: Signed-in member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Recipient events with event ID, authorized target reference, unread/read state and action freshness. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Open target, mark one/all read, respond to a current consent request; stale targets explain unavailability.

**Action contracts:** T02, T08, T09, T14. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** The intended entity opens; opening never silently accepts an unrelated request. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P14 — My listings

**Identity:** /listings?status=…. Parent: Member navigation. Intended user: Authorized publisher.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** All own listing IDs and distinct publication/availability states, actual price, review note and fresh applicant count. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Create, resume draft, edit, open preview/detail, applicants, pause/reconfirm/fill/delete with proper prerequisites.

**Action contracts:** T18, T21, T22. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** A selected listing management journey opens by ID; status changes update discovery and related contexts. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P15 — Listing creation/edit

**Identity:** /listings/new or /listings/:id/edit. Parent: My listings/Post CTA. Intended user: Authorized publisher.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Owned draft version, typed kind/unit/capacity/location/rent/deposit/availability, photos, authorized/resident declarations, amenities/rules/questions. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Photo stage, property details, money/move-in, people/questions, preview, Save draft, Submit for review, Close/discard with unsaved-change decision.

**Action contracts:** T18, T19, T21. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Draft is recoverable; submission is pending review, never announced as published prematurely. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P16 — Applicants

**Identity:** /listings/:id/applicants. Parent: My listings. Intended user: Listing publisher/authorized staff.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Listing-attributed inquiries with answer snapshot, applicant disclosure, application stage and separate consent state. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Filter, open applicant, review answers, shortlist/decline, select candidate, accept communication explicitly, compare, record owner availability after actual decision.

**Action contracts:** T08, T11, T23, T24. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Consideration decisions persist without silently altering consent or occupancy. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P17 — Applicant comparison

**Identity:** /listings/:id/compare?applicants=…. Parent: Applicants. Intended user: Listing publisher.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Authorized selected application IDs, known/missing fit factors and actual answers for the same listing. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Add/remove up to configured comparison limit, return to filtered applicant list, explicit shortlist or communication action.

**Action contracts:** T02, T23. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Comparison informs a decision; comparison selection alone persists no tenant choice. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P18 — Account/profile/preferences

**Identity:** /profile?section=overview|edit|preferences. Parent: Member navigation. Intended user: Account owner.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Own private account, disclosed card, intent set, locality list, preference draft/version and completion state. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Edit name/bio/work description/city/areas, intent/discovery consent, avatar, budget/type/gender/move-in/lifestyle; preview own disclosure, Save/Discard.

**Action contracts:** T25. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Only confirmed edits persist; related discovery and private entity cache invalidate by UID/version. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P19 — Identity verification

**Identity:** /profile?section=verification. Parent: Account/trust prerequisite. Intended user: Account owner/authorized reviewer via staff view.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Latest and historical submission version/status, supported document types, consent text, declared name, review note and document reference. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Upload private supported evidence, submit, see pending status, correct and resubmit rejected evidence; cancel draft upload where permitted.

**Action contracts:** T26. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Owner sees a real decision; trust mirrors derive from the reviewed version, not a client success screen. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P20 — Security/privacy/data/outcomes

**Identity:** /profile?section=settings|privacy|data|outcome. Parent: Account. Intended user: Account owner.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Provider/security state, enforceable disclosure/notification prefs, own blocks, export/deletion jobs, per-intent private outcome declarations. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Reauthenticate/change credentials, logout, consent settings, unblock with warning, request/download export, confirmed deletion, declare housing outcome and choose remaining intents.

**Action contracts:** T16, T24, T27, T28, T29. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Each operation has a persisted result/job state or a clear unsupported status; no fake emails, erasure or tenancy. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P21 — Help/legal/support

**Identity:** /help, /safety, /privacy, /terms, /about, /how-it-works. Parent: Public/member context. Intended user: Visitor/member.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Reviewed published content, support channel availability, safe case reference, no fabricated service claims. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Read content, contact support/report with explicit privacy information, return to origin.

**Action contracts:** T02, T17. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** Requested information or an acknowledged support case is available; no wildcard redirect substitutes for content. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## P22 — Staff console

**Identity:** /admin?section=overview|users|listings|reports|verifications|marketplace|notifications|settings. Parent: Staff access. Intended user: Trusted capability-scoped staff.

**Entry/exit:** Direct authorized link, parent navigation, relevant typed notification/Saved/context reference or safe Auth return. Exit uses a stable related entity destination or restores the parent query/scroll context; browser Back/refresh follows INFORMATION_ARCHITECTURE.md.

**Required content and sources:** Capability map, true environment/project, authorized queues/aggregates and paged records; private evidence only for reviewer capability. Sources must be the field-allowlisted entities in DATA_SOURCE_OF_TRUTH_AND_MAPPING.md, not defaults invented in a renderer. Related IDs resolve under ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md.

**Visible actions, forms and inputs:** Scoped read/search/inspect; permitted moderation/review; real broadcast delivery job; explicit staff grants by administrator; audited history. No pretend purge/reset.

**Action contracts:** T20, T26, T30, T31, T32. Every input has a persisted or explicitly local-draft role. Presentation-only accordion/gallery/menu controls change no business state, keep focus/selection and return predictably.

**Conditions/dependencies:** Require only the action-specific Auth, intent, ownership, publication, consent, trust and capability checks defined by the linked commands. A hidden button is not authorization. A valid private reference must not require that the record appeared in discovery. Unknown/missing values remain distinct from valid zero/false.

**Loading:** Show an appropriate stable skeleton/status while reauthorizing and fetching. Preserve the prior authorized query context; never flash another account’s private content or confuse a loading shell with a successful empty result.

**Empty:** Explain which set is empty (no matching places, no own bookmarks/requests, no messages, no submitted draft/case, or no authorized evidence). Offer only a relevant supported next action. Empty does not substitute fabricated records or success.

**Error:** Distinguish validation, auth expiry, permission/unavailable, conflict, offline and service failure. Preserve safe unsaved input, surface retry and do not convert errors into a successful empty collection. Private existence details remain scoped.

**Completion/persistence:** A case/decision/job is acknowledged and cross-page results are consistent; failures retain unresolved state. All related-page updates follow CROSS_PAGE_CONSISTENCY_MAP.md; long-running operations show a job state, not a completed action toast.

**Acceptance:** Given the permitted actor and data, every enabled action reaches its specified acknowledged result and next destination. Given a restricted actor, missing entity, stale version or failed backend, no forbidden/false-success side effect occurs. Reload restores authoritative state and Back restores the permitted origin.

## Field-level form contract

| Form | Fields and meaning | Validation / ownership | Persistence and cancel |
| --- | --- | --- | --- |
| Auth | Provider; email; password; reset mode; safe return descriptor. | Auth service semantics; accessible labels/feedback; no insecure external redirect. | Never persist passwords in application drafts/URLs; closing returns without submitting. |
| Onboarding/profile | Name, city, locality list, profession/bio, concurrent intents, directory opt-in, optional lifestyle/age-band disclosure. | Shared essentials; stable city/locality semantics; user chooses disclosure; no self-editable trust/staff/status fields. | Save explicit diff with version; preserve undisplayed areas/preferences; optional unknown remains unknown. |
| Preferences | Currency/budget bounds, up to supported locality limit, move-in date/window, room/bed/property types, roommate preferences, known lifestyle responses. | One normalized contract; zero/missing distinction; budget min≤max; valid enums; no ignored weighting control. | One committed version; cancel preserves prior choices. |
| Property | Kind/roomType/BHK, locality/area, title/description, price/deposit/charges+unit, available capacity/date, photos, amenities/rules, questions, publisher authorization and explicit residence. | Required real facts; deposit zero allowed; no invented bed count; supported photo size/type; no residence inferred from ownership. | Private draft before photos; owned stable ID; Save draft distinct from Close; material edits follow review policy. |
| Listing interest | Listing ID/version; introduction and declared required answers. | Correct publisher/recipient; required questions; validated answer types; no public screening answers. | Application and needed pair request created idempotently; cancellation before acknowledgement submits nothing. |
| Chat | Nonempty bounded text; staged supported image; stable clientMessageId; optional explicit contact disclosure. | Live send eligibility; file validation under authorized room; no raw base64 fallback. | Acknowledged message versus local retry draft; cancel upload cleans staging under retention policy. |
| Manual ID | Supported type (masked ID where applicable), declared name, private evidence file and explicit purpose/retention consent. | Current MVP supported JPEG/PNG/WebP/PDF, max 5 MiB aligned across app/service/Storage; reject executable/unsupported legacy formats. | Private versioned submission; viewer uses authenticated bytes; object URL revoked when done; no bearer identity URL. |
| Staff | Typed target/version; reason/note; permitted decision; audience/job; grant versus invitation and exact capability set. | Authoritative capability and current environment; audited target; identity data only for reviewer. | Commit decision or track job; no failure-shaped success, unsupported reset or implicit broad membership grant. |
| Account data/outcome | Recent Auth; requested export scope; DELETE confirmation; private self-reported outcome/context and selected remaining intents. | Owner-only; approved retention/peer policy; mutual claim needs both actors. | Tracked export/deletion; correctable outcome; no invented email, lease, payment or peer occupancy. |

## Interaction/accessibility requirements

Preserve approved geometry and styling. All mounted responsive controls have unique IDs and correct labels; hidden duplicates are not focus targets. Modal/dialog focus is contained, Escape/back meaning is consistent, close restores focus and nested overlays do not leave scroll locked. Keyboard selection matches pointer actions; async statuses/errors are announced. Long names/localities/prices wrap or truncate accessibly without hiding essential meaning. Test mobile safe-area/keyboard, tablet tables, desktop drawers, 200% zoom and reduced motion. A table may scroll within its labelled container rather than forcing page overflow.

Implementation requires the separate review requested by the user. Current-source comparisons and evidence limitations are in EXISTING_APPLICATION_GAP_ANALYSIS.md; target acceptance criteria must not be counted as executed tests.

## View-specific acceptance and secondary action contracts

The following concrete cases supplement each page’s shared loading/error/access rules. Local presentation actions (gallery next/previous, grid/list, accordion, modal close, comparison selection and menu opening) change only view state, preserve keyboard/focus and never imply a domain commit. Read-marker and help/support actions are explicit secondary contracts below; they are not silently treated as consent or report sanctions.

| View | Control group | Given / action | Required result and cancellation boundary |
| --- | --- | --- | --- |
| P01 | Search, city and category CTA | Submit a supported city, budget and move-in. | The discovery URL and result scope preserve all supported choices; no synthetic inventory appears on zero/error. |
| P02 | Sign in/register/reset/provider and close | Enter from a protected saved or shared entity; close and reopen; then sign in. | Close creates no account/action. Successful Auth reauthorizes the exact return context; no request is auto-sent. Reset feedback follows actual provider response. |
| P03 | Step navigation, intent, opt-in and finish | Choose find_room + team_up, skip optional lifestyle and decline directory opt-in. | Private requests remain available once required essentials exist; no public directory card or invented answers. Back keeps the own draft; finish returns to intended action. |
| P04 | All, filters, sort, clear and continuation | Open All with both physical kinds and load another page. | Cards retain listing identity/kind/unit. Cursor reflects all predicates, no duplicate page or person substituted; clear filters resets cursor and query. |
| P05 | Rooms/flat controls | Choose an entire-flat price scope, BHK and area. | RoomType, BHK and price unit remain separate; unsupported combinations explain limits instead of silently ignoring a filter. |
| P06 | People card and fit controls | Browse as an authorized member without opting into own directory publication. | Only eligible opted-in candidates appear; find_room-only/commercial-only profiles do not masquerade as team-up/residents. Unknown fit is labelled, not a fabricated baseline. |
| P07 | PG options and gallery | Open a PG with actual bed/room options and return. | The detail preserves the same listingId, actual per-unit price/capacity/charges; missing option facts stay unknown, context and scroll return. |
| P08 | Gallery/save/share/publisher/resident/interest | Open a listing outside discovery; submit required answers while its version changes. | Loader authorizes by ID; related profiles use real UIDs and scopes. Stale required answers need review. Neither save nor share grants contact access. |
| P09 | Person relationship controls | Reach the person from chat, Saved and listing publisher link. | Same UID; fields/actions vary by authorization/context. A publisher is not labelled resident without declaration. State and actions agree with Connections. |
| P10 | Place/people tabs, remove and retry | Save a private/unavailable entity that is absent from the feed. | Show scoped unavailable tombstone and removable own reference. Network error offers retry, not a successful empty list or leaked private identity. |
| P11 | Incoming/sent/accepted/closed | Accept while sender withdraws; refresh both sessions. | One current result wins with version conflict handling. A listing application remains separately visible and its stage is not silently changed. |
| P12 | Room/search/unread/composer/photo/partner/context | Send once with lost acknowledgement, retry, then read on the other account. | One message, real date, atomic summary and independent read cursors. Partner opens by UID; failed image upload leaves a draft. Contact sharing requires a separate explicit grant. |
| P13 | Inbox/read/target action | Open a notification for a declined/expired or no-longer-authorized request. | Show current scoped target state; stale button cannot accept another request. Own read marker persists without mutating the pair. |
| P14 | New, status filter, draft/edit/applicants | Open a pending or filled own listing and refresh. | Actual canonical states/rent/unit and applicant count remain. Available actions follow current authorization; no draft-to-Active display fallback. |
| P15 | Wizard step/back/photos/preview/draft/submit/close | Save draft with staged photos, return later, edit and submit. | Recover same listing ID/version; upload failure does not publish. Close/discard is explicit; submit acknowledges review, never announces live publication early. |
| P16 | Applicant filters/detail/answers/stage/consent | Shortlist then select one application while communication is pending. | Stage persists per listing/application; consent still needs recipient action; owner separately confirms real availability. New inquiry updates count without unrelated listing write. |
| P17 | Comparison selection/return/shortlist | Compare selected applications for one listing with missing lifestyle answers. | Known and unknown factors remain truthful; no viewer default diet/smoking/move-in. Comparison alone commits no decision; return preserves applicant filter. |
| P18 | Profile/preferences/photo/intents/Save/Discard | Edit name and avatar with three saved localities; discard, then save a new explicit change. | Discard keeps prior profile/photo/localities. Save only intended changes; no collateral locality loss or self-granted trust/staff fields. |
| P19 | Private upload/type/name/consent/status/resubmit | Resubmit rejected evidence while an old reviewer tab is open. | Private new version and actual review note/type/name appear. Old version decision conflicts safely. No government-verification badge or automatic property activation. |
| P20 | Credentials/privacy/blocks/data/outcome | Exercise each supported operation under current provider and retention policy. | Unavailable operation is explicit. Own block removal never clears peer block/restores chat; export/download and deletion show real jobs. Outcome alters only chosen intents, never peer occupancy. |
| P21 | Content/help/support form/Back | Open each public help/legal route directly; submit a supported case. | Actual reviewed content loads. Topic/message plus explicitly disclosed contact fields are validated; acknowledge a persisted ticket ID or actual channel result, never an email promise. Close cancels unsent text; retain failed draft/retry. |
| P22 | Queue/filter/inspect/decide/reason/grants/broadcast | Use moderator, ID reviewer and administrator separately; force a sanction or delivery error. | Only scoped actions/data allowed on backend. Required action failure stays pending/partial; exact-version reviews, explicit grants, real counters/environment and tracked delivery replace misleading success. |

### Secondary read/support contracts

Notification mark-one/mark-all-read is owner-only and idempotent against the recipient event IDs or observed cursor; it changes no domain request/application state. New concurrent unread events remain unread if outside the marked observed scope. Error leaves a retryable pending read marker; refresh reconciles the owner record.

Support case submission is separate from a safety report against a marketplace entity. A visitor/member sees supported topics and the actual operating channel, enters a nonempty bounded message, chooses reply contact explicitly and reviews disclosure. A signed-in actor UID is checked against Auth; a public ticket cannot forge staff status or privileged fields. The service validates the supported schema/rate controls, persists an immutable initial case and returns its ID; staff processing follows the case lifecycle with safe reply access and real delivery acknowledgement. Field length/rate/provider parameters are deployment configuration to review, not invented current guarantees. If no supported channel is operational, show its real availability instead of claiming submission.

Copy/share waits for the browser result; if denied, retain selectable link text. Newsletter/social/language controls do not promise subscriptions, external destinations or translation without a real supported service and scope decision. Profile/contact controls show only the fields authorized for that context.
