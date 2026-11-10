# Product logic and architecture decisions

Phase 1 • Product blueprint and source comparison • 5 November 2026

## Decision authority

This is a reviewable proposal. D01 and D21 record the user's fixed constraints. Other Proposed target decisions are reasoned design choices awaiting blueprint review; Policy approval required entries additionally need named product/operations/security decisions before dependent implementation. None is represented as deployed behavior. Source defects do not automatically authorize data migration or a redesign.

| ID | Status | Topic | Proposed decision / fixed constraint | Reason |
| --- | --- | --- | --- | --- |
| D01 | Fixed constraint | Marketplace purpose | Roommate/accommodation discovery, consensual communication and housing follow-up. No hotel booking, payment capture, reservation or legal lease execution is introduced. | Keeps the completion model relevant to long-term housing. |
| D02 | Proposed target | Shared account with concurrent intents | One person may hold find_room, team_up and have_room concurrently. Publishing capability, staff membership, listing stewardship and actual residence are independent. | Avoids forced owner/seeker account switching and inferred occupancy. |
| D03 | Proposed target | Anonymous versus member discovery | Anyone can browse public accommodation. Identifiable roommate discovery requires sign-in plus eligible disclosed profile access; messaging requires active membership and accepted consent. | Provides low-friction property discovery while limiting exposure of personal profiles. |
| D04 | Proposed target | Category boundaries | All listings combines physical Rooms/Flats and PG/Coliving with explicit kind and price unit. People live in Roommates; a person is never recast as a property. | The existing tab layout can remain while record identities become unambiguous. |
| D05 | Policy approval required | Request allowance | The request service exposes configurable allowance/period/remaining/renewal. Proposed MVP default: five distinct new outbound pair requests per UTC calendar month, displayed with the exact local renewal time. Duplicate/reverse pending requests do not consume another unit; withdrawal does not refund automatically. No Pro upsell without a real purchase path. | Replaces an unexplained permanent cap with a measurable anti-spam policy. Numeric allowance/period and legacy-counter conversion need explicit approval before implementation. |
| D06 | Proposed target | One communication consent per pair | Person connection and listing inquiry share one pair consent lifecycle. An inquiry/application keeps its own listing context and stage; acceptance opens communication, not tenancy. | Prevents repeated approval gates and conflation of applicant, connection and occupancy states. |
| D07 | Proposed target | Messaging and external contact | No direct unsolicited chat. Accepted active pairs may message; an existing accepted pair can discuss another listing without re-requesting consent. Phone/address sharing requires separate explicit disclosure and never follows automatically from acceptance. | Protects members from unsolicited contact and silent PII release. |
| D08 | Proposed target | Roommate eligibility | team_up opt-ins may appear as people. have_room requires an available published listing, publisher/resident linkage and explicit residence declaration; find_room alone and commercial publishing alone do not imply roommate discovery. Multiple intents remain independent. | Retains a meaningful distinction between a future co-renter, a resident host and a landlord. |
| D09 | Policy approval required | Publication and trust | Proposed MVP: a new property needs an authorized publisher, complete listing, manual publisher identity approval and explicit listing content approval before public availability. ID approval alone does not activate the property. Existing published records require a reviewed compatibility policy, not automatic removal. | Aligns trust promises with reviewed evidence without requiring ID for ordinary browsing or communication. |
| D10 | Proposed target | Identity is not property ownership | Manual ID review means a supported document was reviewed for the declared person. It is not Aadhaar/UIDAI certification, legal ownership proof, occupancy proof or a guarantee of safety. | Prevents misleading trust badges and wrong lifecycle side effects. |
| D11 | Proposed target | Independent lifecycle dimensions | Publication, availability, account moderation, applicant consideration, communication consent and actual housing outcome have separate authoritative states. | An accepted chat or selected candidate cannot fill a listing or verify residence. |
| D12 | Proposed target | Stable entity navigation | Use persisted IDs, an authorized entity loader and durable route/query state. Feed cursors/tuple positions are never entity identity. | Saved records, chats, notifications and shared links work beyond the first discovery page. |
| D13 | Proposed target | Truthful discovery | Supported city/locality/type/rent/availability filters run against the full supported query scope before pagination. Unknown data stays unknown. Global price order never mixes room/bed/property units without explicit scope. | Prevents misleading loaded-page search and invented property facts. |
| D14 | Policy approval required | Compatibility scope | One versioned evidence model returns score plus known/missing factors. Anonymous/incomplete users get no fabricated match. MVP global orders are Newest and supported unit-specific Rent; any Best match order must state its bounded candidate cohort and ranking version until global ranking is demonstrated. | Makes ranking honest and implementable without silently promising a full-database personalized sort. Candidate-window/read budget is a reviewed cost parameter, not an undocumented constant. |
| D15 | Proposed target | Public/private disclosure | Public listing projection, opted-in member card, private account/contact/preferences and staff-only identity evidence are separate logical records. Accepted access grants only the specified relationship profile, not raw account data. | Firestore cannot hide fields within a readable source document. |
| D16 | Proposed target | Staff capabilities | Separate content moderation, identity review and administrator membership/operations. A Moderator cannot grant staff or read ID documents unless separately authorized as a reviewer. | Enforces the purpose of staff distinctions at the authoritative boundary. |
| D17 | Policy approval required | Retention and account erasure | Approve a record-class retention schedule, peer-history treatment, moderation-evidence exceptions and deletion retry/progress model before enabling erasure. Export is an authenticated private download, not an unfulfilled email promise. | Avoids both incomplete erasure and unexplained deletion of another participant’s records. No legal duration is invented here. |
| D18 | Proposed target | Unblock and re-request | Each person controls only their own directional block. Any remaining block restricts all pair contexts. Removing a block never restores accepted messaging; new explicit consent is required. A declined requester cannot repeatedly reopen requests; the recipient may explicitly reopen or initiate. | Prevents harassment and accidental restoration of access. |
| D19 | Policy approval required | Expiry and freshness | Return explicit expiresAt/reconfirmAt values from reviewed policy. Expired listings leave new discovery; owners can reconfirm only while authorized and otherwise publishable. Pending requests expose their configured expiry; no hidden timer or arbitrary period is assumed. | Users understand unavailable inventory and request closure. Durations require operations/product review. |
| D20 | Proposed target | Housing completion | Members may privately declare team-up agreed, housing found or moved in, with confidence/source labels. Hosts independently confirm availability/filled status. Offer a one-time optional follow-up and update only the intents the member chooses. | Closes the real journey without claiming a booking, lease, payment or automatic occupancy. |
| D21 | Fixed constraint | Approved visual design | Preserve current styling, cards, navigation placements, form rhythm and responsive layout. Change labels, state availability, destinations and feedback only when justified by a workflow defect. | This is a behavior and information architecture blueprint, not a visual redesign. |
| D22 | Proposed target | Optional/dormant capabilities | Map, push, translation, reviews and agreement signing require independent need/readiness decisions. Hide or clearly disable incomplete promises; do not build them solely because code/dependencies exist. Purge/reset no-op controls and fabricated live inventory have no place in member/staff flows. | Keeps the core product coherent and limits unnecessary implementation. |

## Consequences and alternatives

D02/D08 require identity, intent, advertising permission and residence to be modeled independently. A single exclusive owner/seeker role is simpler initially but prevents valid concurrent journeys and mislabels commercial advertisers. Preserve existing role fields only through a reviewed compatibility adapter; do not silently infer new consent from legacy flags.

D06/D11 separate application stage from pair consent and availability. A new inquiry reuses accepted communication while retaining its own listing version and answers. Creating one request per listing would multiply consent gates; using only a pair record loses applicant context. No selected candidate becomes a tenant automatically.

D12 replaces array identity with stable entity lookup and recoverable route state. Retaining the Explore visual shell is compatible with route-backed subviews. A complete visual/router rewrite is unnecessary. Entity loaders must apply privacy checks independently; a URL or query parameter is never an access grant.

D13/D14 require typed money units, missingness and query-scope labels. One global mixture of rent units and invented default lifestyle values is unacceptable. A bounded personalized suggestion list is a proposed MVP tradeoff; its window and read budget need review before Best match is promised globally.

D15/D16 favor restricted projections and authoritative capability checks because readable documents expose their fields and hidden controls do not restrict backend access. Browser Firebase SDK commands may remain where rules and atomic transactions enforce the contract. Trusted aggregation, staff grants, fan-out, retention jobs and privileged decisions need a reviewed server boundary. This does not mandate replacing Firebase or introducing an unrelated server framework.

D09/D10 propose manual publisher identity plus content approval for new public properties. Separate identity from legal ownership. The dormant auto-publish/Aadhaar path is not a valid alternative to an explicit policy. Review existing published records and versioned edits before any rollout; no blanket automatic unpublishing is approved.

D17 preserves deliberate retention decisions and peer rights. The alternatives of deleting every shared room or retaining everything indefinitely each cause avoidable harm. Record-class policy and service coverage must be approved; no jurisdictional legal conclusion or retention duration is invented here.

D18 makes unblocking removal of one's own restriction, not automatic restoration of another person's consent. D20 makes outcome declarations private and self-reported unless independently acknowledged. They cannot prove a lease or trigger an availability change without the publisher.

## Capability disposition register

Retain the approved presentation and justified purpose; apply the target behavior even where the older catalog said KEEP. MODIFY fixes a behavior/contract, MERGE unifies authority, REPLACE changes a deficient mechanism, REMOVE retires a false/unjustified affordance, INVESTIGATE FURTHER defers optional scope, and INTRODUCE SUPPORTING FUNCTIONALITY completes a justified journey. No removals occur in this phase.

| Feature | Disposition | Reason / target consequence | Contract / evidence |
| --- | --- | --- | --- |
| F01 Landing navigation | KEEP | Preserve a simple entry point; distinguish in-page sections from route destinations. | D04 D13 D21 D22; A22 |
| F02 City selection | MODIFY | City choice must become a real supported query, not locality text. | D04 D13 D21 D22; A02 |
| F03 Hero location search | MODIFY | Carry the chosen search into the actual discovery query/state. | D04 D13 D21 D22; A01 A45 |
| F04 Hero move-in selector | MODIFY | The selected date currently remains component state. | D04 D13 D21 D22; A03 |
| F05 Hero budget selector | MODIFY | Explore must consume the budget or the selector must clearly defer filtering. | D04 D13 D21 D22; A01 |
| F06 Living-option cards | MODIFY | Accommodation type and BHK are different dimensions; preserve the chosen category. | D04 D13 D21 D22; A03 |
| F07 Featured listings | MODIFY | Show real inventory or an explicit empty/error state; separate illustrative inventory. | D04 D13 D21 D22; A04 |
| F08 Landing favorites | MERGE | Use the same bookmark contract as Explore; local heart state is not a saved record. | D04 D13 D21 D22; A05 |
| F09 Marketplace counts | KEEP | Retain truthful aggregate labels; define demo and moderation exclusions. | D04 D13 D21 D22; A39 |
| F10 Trust explanation | MODIFY | Claims must describe the actual manual identity/property policy. | D04 D13 D21 D22; A50 |
| F11 Illustrative community stories | KEEP | Clearly labelled illustration is distinct from a real testimonial or metric. | D04 D13 D21 D22; Target acceptance unverified |
| F12 How it works | KEEP | Keep synchronized with actual consent and publication steps. | D04 D13 D21 D22; Target acceptance unverified |
| F13 Rental FAQ | KEEP | Accordion solves a distinct information need. | D04 D13 D21 D22; Target acceptance unverified |
| F14 Newsletter signup | REMOVE | Remove the active submission affordance until a subscription service exists; keep honest availability copy. | D04 D13 D21 D22; A38 |
| F15 Footer policy/help links | INTRODUCE SUPPORTING FUNCTIONALITY | Important destinations need actual content and registered routes. | D04 D13 D21 D22; A23 A51 |
| F16 Footer social links | MODIFY | Generic social home pages do not identify NestMate support or community. | D04 D13 D21 D22; A23 |
| F17 Email/password sign-in | KEEP | Supported real Firebase authentication with surfaced failure. | D02; Target acceptance unverified |
| F18 Email registration | KEEP | Retain explicit profile setup and discovery opt-in after identity creation. | D02; Target acceptance unverified |
| F19 Password reset | KEEP | Real email delivery/configuration still needs environment verification. | D02; Target acceptance unverified |
| F20 Google sign-in | KEEP | Provider setup and popup restrictions require staging verification. | D02; Target acceptance unverified |
| F21 Emulator demo login | KEEP | Keep strictly gated to DEV plus explicit emulator mode. | D02; Target acceptance unverified |
| F22 Category browsing | KEEP | These are discovery views, not permanent account modes. | D04 D08 D13 D14; A36 |
| F23 Discovery continuation | MODIFY | Preserve cursor fixes; bound supporting reads and define sparse-page behavior. | D04 D08 D13 D14; A20 A21 |
| F24 Explore search and filters | MODIFY | Loaded-only scope must be prominent; global search needs a supported query model. | D04 D08 D13 D14; A01 A02 A36 |
| F25 Compatibility and sort | MERGE | Consolidate multiple score/explanation implementations after characterizing behavior. | D04 D08 D13 D14; A25 A37 |
| F26 Grid/list presentation | KEEP | Presentation choice serves a distinct browsing need. | D04 D08 D13 D14; Target acceptance unverified |
| F27 Room details and gallery | KEEP | Keep real record facts and neutral missing states; fetch detail by ID. | D10 D12 D15; A21 |
| F28 Room sharing | MODIFY | Stable ID links must resolve independently of the first discovery page. | D10 D12 D15; A21 A24 |
| F29 PG details and room options | MODIFY | Do not infer bed availability or room options absent source evidence. | D10 D12 D15; A10 A21 |
| F30 Roommate profile details | MODIFY | Use real viewer answers and evidence-qualified explanations. | D10 D12 D15; A06 A20 |
| F31 Listing bookmarks | KEEP | Authoritative saved IDs are appropriate; add independent hydration. | D12 D15; Target acceptance unverified |
| F32 Profile bookmarks | KEEP | Distinct entity type is justified; preserve stable UID and privacy checks. | D12 D15; Target acceptance unverified |
| F33 Saved destination | MODIFY | Referenced records must load independently of discovery pagination. | D12 D15; A20 |
| F34 Connection request and quota | MODIFY | Atomic request/quota is sound; define cumulative limit and an honest next step at exhaustion. | D05 D06 D18 D19; A28 A49 |
| F35 Accept/decline/withdraw | KEEP | Keep participant-bound backend transitions distinct from tenancy/applicant stage. | D05 D06 D18 D19; A18 |
| F36 Notification inbox and decisions | MODIFY | Preserve connection IDs and recover missing/outdated referenced records. | D05 D06 D18 D19; A14 A22 |
| F37 Authorized conversation creation | KEEP | Deterministic room transaction and existing legacy-room reuse are valuable. | D06 D07 D12 D15; Target acceptance unverified |
| F38 Text messaging | MODIFY | Keep atomic send; add bounded history, read state and robust composer continuity. | D06 D07 D12 D15; A09 |
| F39 Chat photo attachments | REPLACE | Use authorized Storage uploads and explicit validation rather than raw base64 in message documents. | D06 D07 D12 D15; A07 |
| F40 Chat profile navigation | MODIFY | Resolve UID to entity rather than coercing it to a numeric array index. | D06 D07 D12 D15; A06 |
| F41 Unread messages filter | MODIFY | Establish per-member unread/read semantics and persist read receipts. | D06 D07 D12 D15; A08 |
| F42 Report listing/person/chat | KEEP | Persisted moderation reports are justified; ensure target and review linkage. | D15 D16 D18; Target acceptance unverified |
| F43 Blocking | KEEP | Retain server live-pair enforcement and block-list transaction; review historic compatibility. | D15 D16 D18; A38 |
| F44 Restricted list/unblock | INTRODUCE SUPPORTING FUNCTIONALITY | Unblocking needs an explicit mutual-consent policy; no automatic restoration of accepted access. | D15 D16 D18; A38 |
| F45 Owner listing dashboard | MODIFY | Show all publication states explicitly and keep applicants current. | D09 D10 D11 D19; A10 A11 A19 |
| F46 New listing wizard | KEEP | Keep explicit residence declaration and draft-before-photo authorization. | D09 D10 D11 D19; Target acceptance unverified |
| F47 Listing edit and photo replacement | MODIFY | Add orphan cleanup and a clear policy for edits to already active listings. | D09 D10 D11 D19; A36 |
| F48 Availability lifecycle | MODIFY | Separate publication approval, trust and actual availability confirmation. | D09 D10 D11 D19; A11 A13 A36 |
| F49 Screening questions | MODIFY | Questions need a reachable answer/submission journey with listing attribution. | D09 D10 D11 D19; A49 |
| F50 Applicant review | MODIFY | Persist applicant decisions separately and react to connection changes. | D06 D11 D14; A18 A19 A49 |
| F51 Applicant comparison | KEEP | Comparison differs from acceptance; avoid arbitrary/default evidence. | D06 D11 D14; A25 A37 |
| F52 Shortlisting and selection | INTRODUCE SUPPORTING FUNCTIONALITY | Disabled controls truthfully expose a missing owner-scoped stage model. | D06 D11 D14; A18 A49 |
| F53 Profile onboarding | MODIFY | Keep multi-intent consent; preserve multiple localities on unrelated edits. | D02 D08 D14 D15; A46 |
| F54 Avatar editing | MODIFY | Uploading currently persists immediately, so cancel/discard semantics need clarification. | D02 D08 D14 D15; A27 |
| F55 Matching preferences | MODIFY | Supported choices persist; weights and canonical/legacy normalization need one policy. | D02 D08 D14 D15; A26 A37 A46 |
| F56 Manual ID submission | KEEP | Private path, consent and manual review are sound; retain minimal data. | D09 D10 D15; A12 A32 A33 |
| F57 Password/email change | KEEP | Retain reauthentication and real verification email; cover provider-specific accounts. | D15 D17 D18 D20; Target acceptance unverified |
| F58 Privacy and notification settings | REPLACE | Unsupported toggles need honest disabled affordances until enforceable persistence exists. | D15 D17 D18 D20; A38 |
| F59 Logout | KEEP | Clear shared state and protect against stale hydration. | D15 D17 D18 D20; Target acceptance unverified |
| F60 Account export UI | INTRODUCE SUPPORTING FUNCTIONALITY | Provide a scoped, authenticated export workflow; current screen is unavailable. | D15 D17 D18 D20; A38 |
| F61 Account deletion UI | INTRODUCE SUPPORTING FUNCTIONALITY | Connect a reviewed retention/deletion service only after defining peer-data effects. | D15 D17 D18 D20; A34 A35 A38 |
| F62 Admin dashboard | MODIFY | Counts are capped samples and an all-zero signup series is replaced by synthetic growth; show true scope and zero states. | D09 D10 D16; A39 A52 |
| F63 User moderation | MODIFY | Enforce and explain resulting listing visibility consistently. | D09 D10 D16; A13 A30 |
| F64 Listing moderation | MODIFY | Use canonical rent/status/trust fields and explicit publication policy. | D09 D10 D16; A10 A11 A30 |
| F65 Report moderation | MODIFY | Persist reasons/outcomes and avoid resolving before a required sanction succeeds. | D09 D10 D16; A17 |
| F66 Admin ID review | MODIFY | Correct document metadata, add version-aware review and retention workflow. | D09 D10 D16; A12 A30 A32 A50 |
| F67 Marketplace admin analysis | MODIFY | Use truthful sample scope and measured signals, not inferred analytics. | D09 D10 D16; A39 |
| F68 Broadcasting | INTRODUCE SUPPORTING FUNCTIONALITY | An auditable recipient delivery job is missing; do not claim delivery from a saved record. | D09 D10 D16; A14 |
| F69 Admin membership | MODIFY | Separate invitation from authorization; enforce staff-management privilege in rules. | D09 D10 D16; A15 A30 |
| F70 Purge/factory reset controls | REMOVE | No-op destructive-looking controls create false confidence and do not serve users. | D22; A16 |
| F71 Map/geocoding code | INVESTIGATE FURTHER | Dormant hook and dependencies are not a shipped map journey. | D13 D14 D15 D22; A40 A44 |
| F72 Public discovery projections | INTRODUCE SUPPORTING FUNCTIONALITY | Complete the read/write migration before treating raw source documents as private. | D13 D14 D15 D22; A29 |
| F73 Compatibility callable prototype | INVESTIGATE FURTHER | Useful privacy direction; currently disconnected from active matching and needs abuse/policy review. | D13 D14 D15 D22; A37 A40 |
| F74 Account deletion callable | MODIFY | Define retained reports/peer history, fix field/path/bucket coverage and prove retry behavior. | D17; A34 A35 |
| F75 Review/vouch code | INVESTIGATE FURTHER | Dormant feature requires eligibility and abuse decisions before exposure. | D15 D22; A40 |
| F76 Activity tracking code | INVESTIGATE FURTHER | Inactive hook must not justify live activity claims. | D15 D22; A40 |
| F77 Analytics event code | INVESTIGATE FURTHER | Validated helper exists but active user journeys do not invoke it. | D15 D22; A40 |
| F78 Push notification code | INVESTIGATE FURTHER | Permission/local notification is distinct from subscribed server push. | D15 D22; A47 |
| F79 Localization selector/code | MODIFY | Displayed language changes locally; translation hook is dormant and UI text stays English. | D15 D22; A47 |
| F80 Support-ticket backend contract | INTRODUCE SUPPORTING FUNCTIONALITY | Define a reachable, truthful support journey and abuse controls. | D12 D15 D22; A48 |
| F81 Search-engine discovery metadata | MODIFY | The sitemap should advertise real public destinations; current entries include removed routes. | D12 D15 D22; A51 |

## Review decisions still required

| Decision | Review owner to assign | Concrete answer required | Dependent implementation |
| --- | --- | --- | --- |
| D05 | Product + abuse operations | Confirm allowance/period/renewal, duplicate/refund/reopen semantics and treatment of existing lifetime counters. | Requests/quota UX, transaction/rules, migration. |
| D09 | Product + trust operations | Approve new-publication prerequisites, existing-record compatibility, material-edit review and staffing capacity. | Publish/ID/content workflow and discovery eligibility. |
| D14 | Product + data/engineering | Approve bounded cohort, supported factors/weights, minimum evidence and query/read budget. | Matching contract and any Best match label. |
| D17 | Privacy/security + operations | Approve record-class retention, export scope, peer-message/evidence treatment, provider buckets and retry ownership. | Export/deletion availability; any data migration or cleanup. |
| D19 | Product + operations | Approve listing reconfirm/expiry and request expiry durations, reminders and grace handling. | Freshness filters, scheduled jobs, request labels. |
| D22 | Product | Decide whether map/reviews/push/translation/signing/newsletter/marketing claims have a justified supported scope. | Optional features remain deferred; remove or label unfulfilled promises only in approved implementation. |

Any legal text, policy duration, paid plan or identity-document promise needs its actual responsible owner; this document supplies product contracts, not legal approval. A later implementation approval should name the package, acceptance gate and any policy prerequisites. It must not be interpreted as permission to migrate live records or deploy automatically.

