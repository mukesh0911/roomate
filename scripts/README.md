# Maintained scripts

| Entry point | Purpose |
| --- | --- |
| `build-functions-shared.cjs` | Generate/check trusted shared matching and intent modules. |
| `run-workflow-emulators.cjs` | Launch isolated current workflow, browser or rules verification. |
| `run-rules-tests.cjs`, `run-storage-rules-tests.cjs` | Real security-rule suite entry points. |
| `run-emulator-tests.cmd` | Windows security-suite convenience wrapper. |
| `test-workflow-emulator.cjs` | Independent-principal backend contract harness. |
| `test-workflow-browser-only.cjs`, `test-workflow-browser.cjs` | Current real-browser workflows and layout checks. |
| `test-workflow-rule-regressions.cjs` | Dedicated Firestore/Storage regressions. |
| `test-callable-server.cjs` | Loopback-only actual SDK callable wrapper and local job dispatcher. |
| `test-account-jobs.cjs`, `test-deletion-worker.cjs` | Isolated trusted-job integration checks. |

These are development tools, not production operations. Tests retain their fixture helpers under `tests/`. Do not add one-off source-rewriting, live account inspection, screenshot comparison or production-reset utilities here. See [testing](../docs/testing/README.md).
