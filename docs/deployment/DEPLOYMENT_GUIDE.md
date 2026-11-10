# Release process

Local verification is not deployment authorization. Production migrations, live inventory and deployment require separately reviewed scope.

1. Run frontend type/lint/source/build, Functions checks, independent-user workflow/browser acceptance and Firestore/Storage negative-access suites. Use the commands in the [testing guide](../testing/README.md).
2. Resolve or explicitly defer the remaining work in [acceptance status](../workflow-correction/ACCEPTANCE_STATUS.md). Keep unavailable controls honest and gated.
3. Stage trusted endpoints/shared modules, indexes, readers and invalidation/job triggers in a compatible order before restrictive production rules. Old-client support must not reopen private source reads.
4. Verify independent principals, real configured buckets/CORS, background/scheduled delivery, retries, telemetry and rollback behavior in staging. Local loopback dispatchers do not establish deployed event delivery.
5. Review any legacy migration separately with read-only inventory, reconciliation, backup and rollback. Do not migrate on login or invent new consent/allowance/publication policy.
6. Confirm accountable release/monitoring ownership and the actual remote CI result. A rollback must retain the privacy boundary.

Hosting CI calls `.github/workflows/rules-tests.yml`; inspect the workflow for the current gates. No production deployment, deletion activation or data reset is part of repository cleanup.

## Discovery endpoint repair - 8 November 2026

The current client calls `readDiscovery` and `getInteractionContext` in `us-central1`. An unauthenticated OPTIONS request with origin `http://localhost:3000` returned HTTP 404 for both configured project URLs on 8 November 2026. Those missing responses have no CORS headers, so the browser reports CORS/internal errors. This is not evidence that Firestore records were deleted. A region/project mismatch or absent deployment must be resolved before live discovery can work.

The existing callable source passes Functions syntax/shared-module checks and seven focused gateway/privacy tests. The user subsequently approved this exact deployment scope:

```powershell
cd app
firebase deploy --only "functions:readDiscovery,functions:getInteractionContext" --project nestmate-eb562
```

This scope updates the two discovery/context endpoints. Do not include rules, storage, hosting, other jobs or data migrations in this repair. Function inventory could not be listed through the current CLI session, so project access and deployment prerequisites still need confirmation during the approved operation. After deployment, verify OPTIONS responses include the localhost CORS origin and verify actual landing/Rooms/Roommates reads. Do not restore broad raw-profile/listing reads as a workaround.

Repair outcome: both functions deployed and are reachable. OPTIONS now returns 204 with `Access-Control-Allow-Origin: http://localhost:3000`; anonymous places returns HTTP 200 with listing data; anonymous member/context reads return 401. Firebase CLI returned exit 1 solely because regional artifact cleanup policy setup was not completed, after reporting successful function deployment. That separate maintenance policy was left unchanged. See [live deployment evidence](../maintenance/discovery-deployment-2026-11-08.json). Reload the local application to retry requests.
