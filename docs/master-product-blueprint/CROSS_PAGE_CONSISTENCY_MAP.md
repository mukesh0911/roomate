# Cross-page consistency map

**Phase 1 — proposed product design, not implemented behavior.** Prepared 5 November 2026. Deliverables are confined to docs/master-product-blueprint/. The approved user-facing visual design is a constraint. Existing source, UI, Firebase schemas/rules/functions, dependencies and data are unchanged. “Target” describes the reviewed-to-be product contract; numeric, retention and rollout choices marked policy approval required are proposals, not existing promises.

## Event contract

A single domain event carries ID, actor, typed entity/version, effective time, required consumers and disclosure scope. Commit authoritative state first; deliver notifications/propagate projections through an idempotent outbox/job where the operation cannot be atomic. A consumer displays pending propagation explicitly rather than contradictory final states. Private cache keys include account UID and authorization version; sign-out/revocation invalidates them.

| Business event | Records changing | Pages that must update | Notification obligation | Availability/cache/refresh invariant |
| --- | --- | --- | --- | --- |
| Search/filter changes | No domain write; normalized URL/query version. | Landing/Explore query/filter controls and cursor. | No recipient event. | New results only for latest query; related detail return context retained. |
| Bookmark set/remove | Own typed bookmark/version. | Landing feature card, feed/detail save control, Saved. | None required. | Same desired saved state after reload; unavailable references remain removable. |
| Intent/disclosure edit | Private profile + projection/eligibility version. | Own profile/preferences, people detail, directory, publisher contextual profile. | Only necessary policy/security confirmation. | Revoke visibility promptly; existing authorized private contexts remain separately scoped. |
| Listing submitted/reviewed | Draft/review version + publication projection/job. | My listings/wizard, staff queue, public detail/feed, Saved. | Publisher review status and reviewer work queue. | No pending-as-active mapping or publication from identity approval alone. |
| Availability filled/expired/restricted | Availability + effective published projection. | Every discovery section, shared link, Saved, chat context, applicants and resident host eligibility. | Relevant applicant/publisher status without spam or false tenancy. | No new inquiry; honest history/tombstone; other independent personal intents survive. |
| Listing interest submitted | Application/answer snapshot + needed consent/usage event. | Applicant own status, publisher Applicants, Connections, person/property actions. | Publisher receives attributed interest/request. | Existing accepted pair reuses consent; questions/answers retained privately. |
| Consent accepted/declined/withdrawn | Pair request version + authorization mirror. | Cards/person/detail/Connections/Notifications/chat composer. | Other participant receives minimal current result. | Same enabled action everywhere; no property fill or applicant selection. |
| Message acknowledged/read | Message/summary + per-member read state. | Both room streams, room list, unread filter/badges, permitted notifications. | Actual delivery tracked separately. | Draft transitions to acknowledged by ID; read counts do not regress from stale snapshots. |
| Block/unblock | Directional block + effective pair access. | All pair contexts, existing/new chat, attachments, own restricted list and request controls. | Do not notify peer who blocked or why. | Restriction persists across IDs; removing own block does not auto-accept. |
| Applicant stage change | Listing-scoped application version/note. | Owner applicant/compare/detail and applicant status. | Relevant consideration update, not a tenancy contract. | No implicit request acceptance or filled listing. |
| ID decision | Exact submission decision + trust projection/version. | Owner verification/profile, publisher prerequisites, staff queue and public badge where applicable. | Owner sees true decision/reason. | No public evidence URL, government certification or property auto-activation. |
| Sanction/reinstatement | Account moderation + publication/send eligibility/job. | Member restriction/support, directory, properties, conversations, staff case. | Policy-appropriate member notice. | Server paths agree; reinstatement rechecks prerequisites, not blanket active. |
| Report resolution | Case outcome/note + required action job. | Staff queues/inspector, target state and safe reporter acknowledgement. | Actual case result, avoiding private staff/evidence disclosure. | Resolved only after required action applies or explicit no-action decision. |
| Outcome declared/corrected | Private outcome + explicitly chosen intent changes. | Own outcome/profile/search preferences; host prompt if relevant. | Optional follow-up only. | No peer occupancy or listing fill unless publisher separately confirms. |
| Export/deletion/broadcast | Job manifest and delivery/erasure progress. | Owner/staff job status, actual completed scope and relevant caches. | Only real acknowledgements/deliveries. | Retry resumes job ID; no fake success after partial failure. |

## Cross-page acceptance scenarios

- Send one request from a person card: the same target detail, listing context, Sent tab and recipient Incoming show one pending ID; duplicate/reverse requests do not create a second charge.
- Accept on recipient notification: sender profile/card offers Message; recipient application remains its own consideration stage; listing capacity is unchanged.
- Block inside an old room: new text/attachment commits and fresh-ID requests fail, every composer/action becomes restricted, permitted history remains truthful.
- Fill a listing outside the app: every public query/shared link shows the right state; have_room-only availability disappears; concurrent team_up may remain.
- Edit a bio after choosing three localities: unchanged locality preferences remain on all profile/preference/discovery views.
- Review an ID while another reviewer acts: a version conflict cannot approve an unseen new submission; staff/owner/public badge agree on the applied decision.
- Suspend a publisher: existing property cards and direct entry stop accepting new inquiries; the staff case is not marked completed before restriction propagation.
- Delete or lose access to a saved person: Saved shows a removable scoped unavailable item; it does not silently lose the bookmark or reveal private existence.

Each scenario must be checked after reload and from every involved actor’s independent session, not just with a local visual update.

Implementation requires the separate review requested by the user. Current-source comparisons and evidence limitations are in EXISTING_APPLICATION_GAP_ANALYSIS.md; target acceptance criteria must not be counted as executed tests.
