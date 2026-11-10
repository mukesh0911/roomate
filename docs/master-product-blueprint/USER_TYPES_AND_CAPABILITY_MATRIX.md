# User types and capability matrix

**Phase 1 — proposed product design, not implemented behavior.** Prepared 5 November 2026. Deliverables are confined to docs/master-product-blueprint/. The approved user-facing visual design is a constraint. Existing source, UI, Firebase schemas/rules/functions, dependencies and data are unchanged. “Target” describes the reviewed-to-be product contract; numeric, retention and rollout choices marked policy approval required are proposals, not existing promises.

## User categories and purpose

| Category | Goal | Required information | Relevant surfaces | Restrictions |
| --- | --- | --- | --- | --- |
| Visitor | Evaluate the marketplace and an advertised place. | No account required for public accommodation. | Public accommodation cards/details; real help/privacy content. | No identifiable people directory, save/write, unsolicited chat or private evidence access. |
| Member with incomplete profile | Finish setup or resume an intended action. | Supported Auth identity; active account. | Browse, edit essentials, recover credentials, manage own data/support. | Marketplace writes require the relevant minimum setup; preserve the pending destination. |
| Available-room seeker | Find an existing place to live. | find_room; city/localities, budget/move-in if supplied, shared essentials before contacting. | Rooms/PGs; listing interest and explicit consent request; Saved. | Not automatically a team-up candidate or resident host. |
| Team-up seeker | Find compatible people to jointly seek a property. | team_up plus explicit directory opt-in and minimum public card. | Roommates, people detail, pair request/chat, later accommodation search. | No invented listing or available room; outcome requires both people’s acknowledgement if described as mutual. |
| Resident offering a room | Fill an actual spare room in their current home. | have_room; explicit residence declaration and associated available listing under authorized stewardship. | Publish/manage own place; resident card linked to it; applicants and communication. | Legal title is not inferred; losing the available room removes that host badge, not other active intents. |
| Nonresident landlord/property manager | Advertise and manage physical accommodation. | Publishing capability; authorized-to-advertise declaration, shared profile, configured publication trust requirements. | Own properties, applicant review, accepted conversations, availability management. | Never placed in Roommates solely because of property ownership or owner role. |
| PG/coliving operator | Advertise managed rooms/beds with clear pricing and capacity. | Publisher capability; explicit accommodation kind, available unit count and declared house conditions. | PG/Coliving and All physical discovery; listings and listing-context inquiries. | No synthetic one-bed fallback, resident compatibility or hotel reservations. |
| Multi-intent member | Pursue more than one valid housing goal. | Independent concurrent intent set and field-level disclosure. | Union of valid member capabilities with the same account/UID. | No automatic role flip or invalid display merely because another intent ends. |
| Content moderator | Investigate reported accounts/content and apply permitted sanctions. | Trusted staff grant with content/report/moderation capabilities. | Assigned safety queues and scoped history needed for a case. | No staff grants, unrestricted private ID/contact exports, database reset or permanent erasure. |
| Identity reviewer | Review consented private identity evidence. | Explicit identity-review capability; time/session policy; audit reason. | Assigned submission version and bounded review decisions. | No ability to grant staff or claim government/property certification. |
| Administrator | Manage staff capabilities and approved operational policies. | Verified trusted registry membership; capability checks and recent authentication for sensitive operations. | Scoped administration and reviewed jobs, with immutable audit. | No silent production migration or unchecked customer-data disclosure through generic UI. |
| Restricted/suspended member | Understand restrictions, preserve allowed account rights and appeal. | Authenticated owner of restricted account. | Read permitted history, manage security/data requests and support subject to policy. | No new requests, messages, public advertising or reinstating own moderation status. Banned publication is removed. |

## Capability matrix

| Capability | Visitor | Incomplete member | find_room | team_up | Resident have_room | Nonresident/PG publisher | Staff | Restricted account |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public accommodation browse/detail | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Member people directory | No identifiable cards | After eligible access; own publication optional | Resident hosts; team-up only if relevant intent chosen | Other opted-in team-up profiles | Eligible team-up/resident profiles | No commercial prospecting privilege | Capability needed for moderation access | Restricted according to own data/appeal policy |
| Create a listing draft | Sign in first | Complete essentials first | If separately authorized publisher | If separately authorized publisher | Yes, explicit residence declaration | Yes, declared authorization/kind | No staff impersonation by default | No new advertisements |
| Publish property | No | No | Publisher prerequisites | Publisher prerequisites | Separate content + identity prerequisites | Same separate publisher prerequisites | Only scoped review/approval command | No; existing public inventory restricted |
| Appear as a human roommate | No | Complete intentional opt-in first | Not from find_room alone | Yes, opt-in/minimum card | Only with valid available linked home | Not from commercial role alone | No staff listing merely from membership | No new directory visibility |
| Apply/request communication | No | Finish action-specific essentials | Yes | Yes | Yes | Yes for relevant housing context | Ordinary member identity requires ordinary consent | No new requests |
| Send a message | No | No unsolicited chat | Accepted active pair only | Accepted active pair only | Accepted active pair only | Accepted active pair only | No unrestricted staff messaging identity | Existing history as allowed; no sending |
| Read contacts/precise address | No | Own private data | Own data or explicit scoped peer grant | Same | Same | Same | Specific case/capability only | Own permitted data; no new disclosure grants |
| Manage applications | No | No | Own submitted inquiry | Own submitted inquiry | Own listing’s applications | Own listing’s applications | Explicit scoped case capability | Read permitted history; no new publisher decisions |
| Review private ID evidence | No | Own submission only | Own submission only | Own submission only | Own submission only | Own submission only | Identity-review capability, not Moderator alone | Own submission/history as allowed |
| Grant staff membership | No | No | No | No | No | No | Administrator capability only | Never self-grant/reinstate |
| Export/delete/account appeal | No account data | Own identity with required reauth | Own account | Own account | Own account | Own account | No mass export from ordinary moderation role | Own account/support subject to approved retention policy |

## Viewer-to-candidate rules

A find_room member primarily sees physical places and the resident/publisher linked to a place. They can be a private applicant without appearing in the public people directory. A team_up member sees other eligible team-up people; resident hosts are relevant when find_room is also active. A resident host can review applicants and eligible disclosed people, but does not gain a raw directory of every pure room seeker. A commercial/PG publisher gets listing-specific applicant disclosures, not a general right to harvest member profiles. An individual who also holds team_up retains that ordinary personal capability independently of publishing. A member need not publish themselves to the directory merely to browse; sending a request explicitly discloses the necessary request/profile subset to the recipient.

## Minimum setup is action-specific

Browse: none. Bookmark: Auth identity. Send/request/application: active Auth plus shared essentials and the minimal recipient introduction disclosure. People publication: explicit opt-in, supported city/locality, declared eligible intent and a minimum reviewed display card; optional answers remain unknown and affect fit confidence, not fabricated defaults. Publishing: shared essentials, authorization-to-advertise declaration, complete property facts and the configured trust/review requirements. have_room badge: explicit residence + authorized listing link + actual available published capacity. Staff: trusted registry grant outside self-editable customer fields.

## Multi-intent examples

A renter may seek a replacement home (find_room) while considering a future co-renter (team_up). A resident with one spare room may also team up for a later move; filling the room should remove the currently available have_room result, not erase team_up. A landlord may separately be a team-up seeker; only their personal opted-in intent produces a human roommate card. A resident advertising a leased room is the publisher/steward, not automatically the legal property owner. Valid authority/permission wording needs product review; no legal-title claim is inferred.

## Staff and account status

Content moderation, identity review and staff administration are capability sets. Capabilities are enforced by authoritative services/rules and audited, not by hiding a button. A restricted account may still need security, support, export and erasure access; moderation must not accidentally remove all means to appeal or manage private data. Reinstatement re-evaluates current publication/consent prerequisites.

Implementation requires the separate review requested by the user. Current-source comparisons and evidence limitations are in EXISTING_APPLICATION_GAP_ANALYSIS.md; target acceptance criteria must not be counted as executed tests.
