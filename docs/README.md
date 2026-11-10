# Documentation

Start here instead of historical audit reports.

| Document | Purpose |
| --- | --- |
| [System architecture](architecture/SYSTEM_ARCHITECTURE.md) | Current code boundaries, data flow and source locations. |
| [Database boundaries](architecture/DATABASE_SCHEMA.md) | Current collections, ownership and authorization responsibilities. |
| [Environment setup](deployment/ENVIRONMENT_SETUP.md) | Local setup without embedded credentials. |
| [Release process](deployment/DEPLOYMENT_GUIDE.md) | Validation, staging and deployment prerequisites. |
| [Testing](testing/README.md) | Maintained commands, fixtures and output policy. |
| [Acceptance status](workflow-correction/ACCEPTANCE_STATUS.md) | Verified behavior and remaining release work. |
| [Finding traceability](workflow-correction/AUDIT_FINDING_STATUS.md) | A01-A52 implementation history; use acceptance for current results. |
| [Private discovery cutover](workflow-correction/PRIVATE_DISCOVERY_CUTOVER.md) | Compatibility and privacy rollout boundary. |
| [Implementation history](workflow-correction/IMPLEMENTATION_PROGRESS.md) | Historical checkpoints, not a current release pass. |
| [Product decisions](master-product-blueprint/PRODUCT_LOGIC_AND_ARCHITECTURE_DECISIONS.md) | Reviewed and unresolved domain contracts. |
| [Master roadmap](master-product-blueprint/MASTER_IMPLEMENTATION_ROADMAP.md) | Historical package proposal with current-status link. |

The master product blueprint is retained because it defines contracts and decisions. The single historical [production readiness report](production-readiness/PRODUCTION_READINESS_REPORT.md) is retained for context; its earlier results are not current verification.

Generated screenshots, logs and failed-run dumps do not belong beside source files. Historical audits, one-off scripts and unused reference images were moved to the local cleanup backup outside the repository. The cleanup summary is in `maintenance/cleanup-2026-11-08.json`.
