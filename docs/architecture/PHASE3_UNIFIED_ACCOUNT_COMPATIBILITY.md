# Phase 3 unified-account compatibility notes

## Contract

NestMate has one authenticated member account. `users.role` remains readable
legacy metadata during the transition, but it no longer determines navigation,
listing eligibility, shared-profile completion, or roommate-directory access.

## Legacy account handling

- Existing completed profiles remain completed; no bulk rewrite is required.
- Existing seeker profiles with five or more compatibility answers remain visible
  in roommate discovery when `roommateDiscoveryEnabled` is absent. This treats
  their previous seeker setup as their historical opt-in.
- Existing owner profiles are not put into roommate discovery solely because
  they own listings. They can opt in explicitly in a later profile edit.
- New profile completion requires name, city, and one to three localities; it
  does not write or require `role`.
- Existing listings, `ownerId`, verification state, and approval lifecycle are
  unchanged. Listing ownership remains the security boundary.

## Chat and phone-sharing compatibility

New mutual phone shares write `phoneSharing.participantPhones.<uid>` while
continuing to write the legacy `ownerPhone` and `seekerPhone` fields. Current
clients read the participant map first and fall back to the legacy fields.
No bulk chat-data rewrite is required. The existing accepted-pair Firestore
authorization requirement remains unchanged.

## Follow-up risks

- `users` documents are publicly readable, so roommate discoverability is a
  marketplace inclusion rule, not a document-level privacy control.
- Legacy role-based code in retired dashboard/onboarding pages and selected
  admin analytics remains intentionally untouched until deep-link and reporting
  regression coverage is expanded.
- A future cleanup should remove the unreachable legacy listing-owner injection
  path in `useMatches` after all legacy dashboard dependencies are retired.
