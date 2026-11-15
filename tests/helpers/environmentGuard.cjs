/**
 * NestMate Test Environment Isolation & Production Protection Guard
 *
 * HARD FAIL on any attempt to execute test seeding, reset, or wipe
 * operations against a production environment or production accounts.
 */

const PROTECTED_ACCOUNTS = new Set([
  'mukvr46@gmail.com',
  'mrmukeshram111@gmail.com',
  'mukesh@nestmate.in',
]);

const FORBIDDEN_PROJECTS = new Set([
  'nestmate-prod',
  'nestmate-production',
  'production',
]);

function assertTestEnvironment(contextName = 'operation') {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const nestEnv = (process.env.NEST_ENV || '').toLowerCase().trim();
  const gcloudProject = (process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || '').toLowerCase().trim();

  if (nodeEnv === 'production') {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: NODE_ENV is set to 'production'! Test scripts must NEVER run in production.`);
  }

  if (nestEnv === 'production') {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: NEST_ENV is set to 'production'!`);
  }

  if (FORBIDDEN_PROJECTS.has(gcloudProject)) {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: Detected production Firebase project '${gcloudProject}'!`);
  }

  return {
    isolated: true,
    nodeEnv: nodeEnv || 'test',
    project: gcloudProject || 'demo-nestmate',
    timestamp: new Date().toISOString(),
  };
}

function assertNotProtectedAccount(email, contextName = 'mutation') {
  if (!email || typeof email !== 'string') return;
  const normalized = email.toLowerCase().trim();
  if (PROTECTED_ACCOUNTS.has(normalized)) {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: Target account '${normalized}' is a protected production account (Zero-Touch Policy).`);
  }
}

module.exports = {
  assertTestEnvironment,
  assertNotProtectedAccount,
  PROTECTED_ACCOUNTS: Array.from(PROTECTED_ACCOUNTS),
  FORBIDDEN_PROJECTS: Array.from(FORBIDDEN_PROJECTS),
};
