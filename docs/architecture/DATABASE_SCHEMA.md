# Database and asset boundaries

Current ownership map, 8 November 2026. Consult `app/firestore.rules`, `app/storage.rules`, the domain adapters and trusted workers for exact field validation. Legacy records require explicit compatibility review; this document does not authorize migration.

| Record | Responsibility / access boundary |
| --- | --- |
| `users/{uid}` | Private source account, intent and preferences; owner/full administrator access. Never a public discovery feed. |
| `privateUserData/{uid}` | Owner contact data; private reads. |
| `listings/{id}` | Owner inventory source; allowlisted callable projection for discovery. Publication and availability are separate concepts. |
| `publicProfiles`, `publicListings` | Legacy/projection compatibility records; do not bypass current opt-in or source privacy boundaries. |
| `connections`, pair/consent locks | Directional requests, decisions, scoped consent and duplicate/quota protection. |
| `applications` | Independent applicant/owner state, question/answer snapshots and listing context. Selection does not allocate capacity. |
| `chatRooms/{id}/messages` | Shared participant history; stable send identifiers and private attachment references. Room metadata tracks participant read state. |
| `notifications/{id}` | Recipient inbox records. Delivery means a record was written, not that it was read or emailed. |
| `supportTickets/{id}` | Narrow create-only member requests; administrative reads. The UI acknowledges only a stored ticket. |
| `verifications`, `ownerVerifications` | Private identity-review compatibility and exact-version decisions; approval does not automatically publish inventory. |
| `admins/{email}` | Trusted, scoped staff membership. Editable account fields cannot grant staff access. |
| `accountExports/{uid}` | Trusted export generation/status/lease/expiry. Owner download requires current authorization and recent authentication. |
| `broadcasts/{id}` | Server-only fan-out job with stable recipients, cursor, actual count, lease and retry state. |
| `accountDeletionJobs/{uid}` | Trusted deletion manifest/progress. Availability remains disabled. |
| `discoverySignals/global` | Non-private invalidation signal written by trusted services. |

Storage separates profile/listing assets, identity evidence, participant media and private exports. Export paths include owner, generation and per-attempt object name; current job state and expiry control reads. Identity-document and conversation paths are governed by their dedicated rules. Bucket/path coverage still requires review before deletion activation.

Legacy fields are read through explicit adapters. Keep stable UID/listing/application/pair/room identifiers. Never infer missing rent/status, transform cumulative counters into monthly periods, migrate on login, or reinterpret listing consent as an application.
