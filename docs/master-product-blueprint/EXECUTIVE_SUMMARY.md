# Executive summary

> Current implementation: the later workflow-correction brief authorized application changes after this Phase 1 proposal. See [current acceptance and remaining work](../workflow-correction/ACCEPTANCE_STATUS.md). The original blueprint and its historical approval boundary below are preserved; deployment and production migrations remain separate.


Phase 1 • Product blueprint and source comparison • 5 November 2026

## Result and scope

NestMate should support the full long-term housing journey: discover an actual place or eligible potential roommate, inspect the right entity, express listing-specific interest or request a connection, obtain communication consent, discuss fit, manage applicant consideration, and record a private housing/team-up outcome. It is not a booking, payment, lease-certification or hotel product. The approved visual design remains the presentation baseline.

The complete Phase 1 blueprint contains 16 required documents, 12 user categories, 22 logical view specifications, 32 detailed navigation/command contracts, 22 product decisions, 14 entity state diagrams, 15 cross-page event contracts and 17 failure/recovery cases. Target acceptance criteria are specifications, not executed tests. All deliverables and read-only generation/traceability artifacts are under this folder. No implementation, schema/rule/dependency/data/migration/deployment work was performed.

## Core product decisions

One account supports concurrent find-room, team-up and have-room intents. Publishing permission, residence, legal ownership and staff power are separate concepts. All listings contains physical accommodation; Roommates contains opted-in eligible people. Anonymous visitors can browse public properties; identifiable people and private relationship data have stricter access.

Use stable IDs and authorized loaders for property, person, application and conversation details. Discovery pagination must not decide whether a saved item or shared link exists. Preserve query/back/scroll context while keeping the current interface.

One pair consent controls communication; each listing inquiry separately retains its listing/version/answers and applicant stage. Acceptance does not select a tenant, fill a property or disclose private contacts. Shortlisting, publication approval, availability, identity review and housing outcomes remain independent. Either person's block restricts all communication contexts; unblocking does not silently restore acceptance.

Manual identity review is not Aadhaar/UIDAI certification, legal ownership proof or safety assurance. The proposed new-publication policy requires identity and explicit content approval; existing published records need a separately reviewed compatibility decision. User/staff feedback must describe acknowledged actions, real data and actual delivery/job state.

## What differs in the current application

Comparison covers 8 concrete routes plus wildcard behavior, all 81 catalogued capability groups, all 32 target transitions and 52 inherited findings with rechecked source anchors. A supplementary index records 400 literal interactive source occurrences; these are not unique rendered controls and their exact runtime branches remain unverified. Prior runtime evidence is bounded to the audit described in the gap report; no production-wide behavior or security certification is claimed.

The largest structural gaps are disconnected listing inquiry intake/applicant context, array-based detail identity, search handoff loss, inconsistent rent/publication/ID field mapping, incomplete unread/attachment contracts, broad source-document/staff access boundaries, and unfulfilled account-data/admin delivery operations. Target outcome follow-up, explicit private-contact sharing and policy-backed request renewal are product proposals, not mislabeled confirmed defects.

Historical validation remains mixed: 430 source assertions passed in 38 files, 3 additional source test files failed imports, 4 Functions stub tests passed, and lint reported 552 errors/2 warnings. These were not rerun in this documentation phase; no current release-readiness pass is asserted.

## Review and next phase

Review D05 request allowance/legacy counters, D09 publication/legacy eligibility, D14 matching scope/read budget, D17 retention/export/peer history and D19 freshness/expiry. Assign policy owners and approve or defer optional map/reviews/push/translation/signing. These decisions are explicit because silently choosing them in code would create undocumented product policy.

The recommended next phase is a separately approved implementation slice from the dependency-aware roadmap: canonical records/adapters and privacy/capability foundations, then stable query/entity navigation, consent/applications, reliable messaging, publication/ID/applicants, account completion and truthful staff jobs. Mandatory isolated acceptance/security/compatibility gates precede rollout. No application implementation should begin solely on the strength of this document's existence.

## Deliverable index

| Order | Document | What to review |
| --- | --- | --- |
| 01 | [PRODUCT VISION AND DOMAIN MODEL](PRODUCT_VISION_AND_DOMAIN_MODEL.md) | Purpose, domain entities and outcome boundary. |
| 02 | [USER TYPES AND CAPABILITY MATRIX](USER_TYPES_AND_CAPABILITY_MATRIX.md) | User categories, concurrent intents and access. |
| 03 | [COMPLETE USER EXPERIENCE FLOW](COMPLETE_USER_EXPERIENCE_FLOW.md) | First visit through completion; T01–T32. |
| 04 | [INFORMATION ARCHITECTURE](INFORMATION_ARCHITECTURE.md) | Stable routes, navigation, deep links and Back. |
| 05 | [DISCOVERY AND LISTING WORKFLOW](DISCOVERY_AND_LISTING_WORKFLOW.md) | Categories/cards/query/pagination and publishing. |
| 06 | [ENTITY AND DETAIL PAGE RELATIONSHIPS](ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS.md) | Entity identity and authorized relationships. |
| 07 | [INTERACTION AND COMMUNICATION MODEL](INTERACTION_AND_COMMUNICATION_MODEL.md) | Consent, inquiry, applicant and chat boundaries. |
| 08 | [FEATURE LIFECYCLE AND STATE DIAGRAMS](FEATURE_LIFECYCLE_AND_STATE_DIAGRAMS.md) | Fourteen independent state machines and invariants. |
| 09 | [PAGE BY PAGE PRODUCT SPECIFICATION](PAGE_BY_PAGE_PRODUCT_SPECIFICATION.md) | P01–P22 data/actions/forms/states/acceptance. |
| 10 | [DATA SOURCE OF TRUTH AND MAPPING](DATA_SOURCE_OF_TRUTH_AND_MAPPING.md) | Target authorities and exact actual-source appendix. |
| 11 | [CROSS PAGE CONSISTENCY MAP](CROSS_PAGE_CONSISTENCY_MAP.md) | Event writes, affected views, cache and other-user effects. |
| 12 | [FAILURE AND RECOVERY WORKFLOWS](FAILURE_AND_RECOVERY_WORKFLOWS.md) | Cancellation/network/conflict/restriction and partial jobs. |
| 13 | [EXISTING APPLICATION GAP ANALYSIS](EXISTING_APPLICATION_GAP_ANALYSIS.md) | Routes/features/transitions/findings and element source index. |
| 14 | [PRODUCT LOGIC AND ARCHITECTURE DECISIONS](PRODUCT_LOGIC_AND_ARCHITECTURE_DECISIONS.md) | D01–D22, capability disposition and policy review. |
| 15 | [MASTER IMPLEMENTATION ROADMAP](MASTER_IMPLEMENTATION_ROADMAP.md) | R01–R10 dependencies, acceptance and release gates. |
| 16 | [EXECUTIVE SUMMARY](EXECUTIVE_SUMMARY.md) | Scope, key decisions and review handoff. |

Machine-readable supporting artifacts: [target pages](target-pages.json), [target transitions](target-transitions.json), [target decisions](target-decisions.json), [feature target map](feature-target-map.json), [transition gaps](transition-gap-map.json), [element index](element-traceability.json), [finding anchor validation](finding-anchor-validation.json), [source integrity](source-integrity.json). These preserve evidence and do not execute application code.

