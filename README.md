# NestMate

Room and roommate discovery with consent-based messaging and independent listing applications.

Implementation is in progress. [Current acceptance and remaining work](docs/workflow-correction/ACCEPTANCE_STATUS.md) is the release-status source of truth. Local verification does not authorize deployment or production migrations.

## Project layout

| Location | Responsibility |
| --- | --- |
| `app/src/` | React routes, components, hooks, domain helpers and Firebase client adapters. |
| `app/functions/` | Trusted discovery, account jobs and gated deletion services. |
| `app/public/` | Referenced application assets and public metadata. |
| `app/firestore.rules`, `app/storage.rules` | Database and file authorization. |
| `tests/` | Independent-user integration fixtures, API and browser suites. |
| `scripts/` | Maintained build and isolated verification runners. |
| `docs/` | Architecture, setup, product contracts and current acceptance. |
| `.github/workflows/` | Validation and deployment gates. |

See the [documentation index](docs/README.md), [system architecture](docs/architecture/SYSTEM_ARCHITECTURE.md), and [testing guide](docs/testing/README.md).

## Develop

Use Node.js 22. Install the three package boundaries from the repository root:

```powershell
npm.cmd ci
npm.cmd --prefix app ci
npm.cmd --prefix app/functions ci
npm.cmd --prefix app run dev
```

Follow [environment setup](docs/deployment/ENVIRONMENT_SETUP.md). Keep real credentials outside version control.

## Verify

```powershell
npm.cmd --prefix app run check
npm.cmd --prefix app run lint
npm.cmd --prefix app test -- src --maxWorkers=1
npm.cmd --prefix app run build
npm.cmd --prefix app/functions run check
node scripts/run-workflow-emulators.cjs
node scripts/run-workflow-emulators.cjs --regressions
```

The workflow suite uses local demo emulators. Firebase CLI 15.15.0, Java 21+ and Playwright Chromium are required. Run reset-capable suites sequentially. See the testing guide for Functions tests and evidence boundaries.

Account deletion remains disabled pending coverage and operational acceptance. Application selection never reserves or fills a listing. Person consent, listing consent and applications remain separate.

Private and proprietary. NestMate Team, 2026.
