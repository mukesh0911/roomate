/**
 * Runs the Storage rules emulator test suite with RUN_STORAGE_RULES_TESTS=1.
 * Invoked inside `firebase emulators:exec` by the root `test:storage-rules` script.
 * Executes vitest inside the `app` directory where dependencies and vite config reside.
 */
process.env.RUN_STORAGE_RULES_TESTS = '1';

const path = require('path');
const { spawnSync } = require('child_process');

const appDir = path.join(__dirname, '..', 'app');
const testFile = 'storage.rules.test.ts';

const result = spawnSync(
    'npx',
    ['vitest', 'run', testFile],
    {
        stdio: 'inherit',
        shell: true,
        cwd: appDir,
        env: {
            ...process.env,
            RUN_STORAGE_RULES_TESTS: '1',
            FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199',
            FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
            GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'demo-nestmate',
        },
    }
);
process.exit(result.status == null ? 1 : result.status);
