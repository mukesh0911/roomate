# Failure and recovery workflows

**Phase 1 — proposed product design, not implemented behavior.** Prepared 5 November 2026. Deliverables are confined to docs/master-product-blueprint/. The approved user-facing visual design is a constraint. Existing source, UI, Firebase schemas/rules/functions, dependencies and data are unchanged. “Target” describes the reviewed-to-be product contract; numeric, retention and rollout choices marked policy approval required are proposals, not existing promises.

## Recovery contract

Every read distinguishes loading, known empty, forbidden/unavailable and failure. Every write distinguishes local draft, pending/queued, acknowledged, conflict and failed/partially failed. An optimistic visual change is never the sole proof of success. Sensitive commands carry actor, idempotency key and expected version; secondary operations use tracked jobs/events. No recovery path bypasses authorization or silently changes another lifecycle.

| Failure / edge case | Trigger/precondition | Expected behavior | Recovery / durable result |
| --- | --- | --- | --- |
| Cancel/Back/Close | UI draft or committed state known. | Before commit, no successful business event. Save draft and Discard are explicit alternatives. After commit, reverse through a separate domain command. | Preserve safe origin context; clear sensitive transient bytes; do not publish an avatar from an abandoned edit. |
| Refresh/direct link | Typed ID/query and authorized scope exist. | Re-fetch current entity/version independently; resume only owned safe drafts/jobs. | Unknown target and network failure are distinct; never rely on previously loaded cards. |
| Session expiry/account switch | Auth token expired or another UID signs in. | Freeze writes; clear/rekey private cache; preserve only scoped nonsensitive intended action. | Reauthenticate then reauthorize/review before resubmitting; never auto-send another user’s draft. |
| Offline/backend failure | Command not acknowledged or outcome ambiguous. | Maintain failed/pending local draft, not success; show network state. | Reconcile by idempotency key before retry; do not duplicate requests, charges, messages or jobs. |
| Double click/retry | Same logical command may arrive more than once. | Disable accidental duplicate UI submission and enforce server idempotency. | Same command ID returns same result; UI mutex alone is insufficient. |
| Simultaneous accept/withdraw/block | Expected version no longer current. | Atomic version/precondition check chooses valid current transition; block overrides sends. | Refresh actual state and explain conflict; never last-write-wins consent against a block. |
| Concurrent listing/profile edit | Another actor/version changed relevant fields. | Compare explicit diff/current version; do not overwrite undisplayed fields or approval. | Offer reload/merge owned edits; material changes require review policy. |
| Listing fills/pauses while viewed | A formerly available place changes. | Read current effective availability before inquiry commit; invalidate relevant context/actions. | Preserve draft answers but require review of changed listing; provide another search, not fake success. |
| Account suspended/banned | Member or counterpart becomes restricted. | Enforce publication/send/request denial on server, including already-open views. | Show scoped restriction/support; keep approved data-rights/history access separate. |
| Upload fails/cancels | Owned staging object/draft exists. | No final reference or message success without validated object; no base64 bypass. | Retry same upload/command; clean orphans by manifest/expiry with safe retry. |
| Verification rejected/raced | A submission has actual reason/version or another reviewer changes it. | Owner sees real type/name/note; resubmits a new version. Reviewer may only decide inspected version. | No user self-approval; retain/revoke/clean evidence per approved schedule. |
| Related record missing/private/deleted | Entity resolver returns scoped unavailable or service error. | Use an honest unavailable projection/tombstone, not invented owner, rent, location or identity. | Allow safe removal/retry/back; preserve authorized context without leaking private existence. |
| Notification delivery fails | Domain commit already succeeded. | Keep domain result; queue/retry delivery independently with idempotent recipient events. | Display sent/queued/delivered states honestly; no compensating deletion of a committed request. |
| Partial sanction/erasure/broadcast | Only some manifest work succeeded. | Track applying/partially failed and exact completed scope; avoid final resolved/deleted/delivered claim. | Resume trusted job; retain necessary identity/authorization until retry is safe; honor retention exceptions explicitly. |
| Quota exceeded/renewed | Period/usage policy returned by server. | Show actual remaining/renewal or supported recovery; no absent upgrade link. | No silent refunds, reset, old-counter reinterpretation or duplicate consumption; migration separately reviewed. |
| Legacy ID/data shape | Old paths/fields differ from the target. | Use a reviewed explicit adapter or request supported resubmission; never open arbitrary active content. | Do not migrate on read/login; inventory/dry-run/backup/approval precedes legacy changes. |
| Permission/clipboard/provider denial | Browser/API refuses a secondary operation. | No success before its actual promise/result; preserve primary domain state. | Offer copyable text, provider-specific recovery or clear unsupported message; do not swallow async rejection. |

## Failure sequence

```mermaid
sequenceDiagram
  participant U as User
  participant UI as View/draft
  participant S as Authorized service
  participant DB as State store
  U->>UI: Submit explicit command
  UI->>S: Actor + commandId + expectedVersion
  S->>DB: Authorize and commit if current
  DB-->>S: Result or conflict
  S--xUI: Response lost
  UI-->>U: Outcome unknown; draft retained
  U->>UI: Retry
  UI->>S: Reconcile same commandId
  S->>DB: Read prior command result
  DB-->>S: Existing acknowledged result
  S-->>UI: Same entity/version, no duplicate charge
  UI-->>U: Confirmed result + valid next action
```

## Required resilience acceptance

For each T01–T32 command, test cancellation before/after acknowledgement, reload, stale response, repeat command, auth switch, offline/permission failure and any relevant competing actor. Test model actions on independent sessions and inspect authoritative writes, not just toasts. Explicitly test source-created-but-not-yet-uploaded drafts, successful upload but failed reference commit, ID rejection/resubmission while review is open, existing chat after block, saved records outside discovery, and case resolution when its sanction fails.

Never broaden Firestore/Storage rules to hide a client error. Never restore old permissive behavior during rollback without a reviewed compatibility/security decision. A missing provider or unapproved product policy is marked blocked/unavailable with a clear next step, not invented implementation.

Implementation requires the separate review requested by the user. Current-source comparisons and evidence limitations are in EXISTING_APPLICATION_GAP_ANALYSIS.md; target acceptance criteria must not be counted as executed tests.
