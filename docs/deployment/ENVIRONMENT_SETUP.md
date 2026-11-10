# Local environment setup

Use Node.js 22 and npm. The isolated workflow suite additionally requires Java 21+, Firebase CLI 15.15.0 and Playwright Chromium.

From the repository root:

```powershell
npm.cmd ci
npm.cmd --prefix app ci
npm.cmd --prefix app/functions ci
npm.cmd --prefix app run dev
```

Put development Firebase configuration in the ignored `app/.env.local`. Required keys are `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` and `VITE_FIREBASE_APP_ID`. Use the actual project/bucket configuration. Never commit credentials or substitute a guessed bucket name.

The Vite server runs on port 3000. The workflow runner supplies its own demo configuration and dedicated emulator ports; it does not require production access. See [testing](../testing/README.md). Do not run live reset or migration commands for local setup.

Account exports and staff broadcasts are disabled by default. Enable `VITE_ACCOUNT_EXPORT_ENABLED=true` or `VITE_BROADCASTS_ENABLED=true` only after the corresponding callable, background worker, scheduler and private Storage lifecycle have been deployed and accepted in that environment. These are build-time Vite flags; rebuild after changing them. A flag does not deploy a service or grant access. The isolated workflow runner enables both explicitly to test the real local implementations.
