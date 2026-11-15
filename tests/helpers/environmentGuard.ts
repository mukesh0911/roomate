/**
 * NestMate Test Environment Isolation & Production Protection Guard (TypeScript)
 */

export const PROTECTED_ACCOUNTS = [
  'mukvr46@gmail.com',
  'mrmukeshram111@gmail.com',
  'mukesh@nestmate.in',
] as const;

export const FORBIDDEN_PROJECTS = [
  'nestmate-prod',
  'nestmate-production',
  'production',
] as const;

export interface EnvGuardResult {
  isolated: boolean;
  nodeEnv: string;
  project: string;
  timestamp: string;
}

export function assertTestEnvironment(contextName = 'operation'): EnvGuardResult {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const nestEnv = (process.env.NEST_ENV || '').toLowerCase().trim();
  const gcloudProject = (process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || '').toLowerCase().trim();

  if (nodeEnv === 'production') {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: NODE_ENV is 'production'! Test scripts must NEVER run in production.`);
  }

  if (nestEnv === 'production') {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: NEST_ENV is 'production'!`);
  }

  if (FORBIDDEN_PROJECTS.includes(gcloudProject as any)) {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: Detected production Firebase project '${gcloudProject}'!`);
  }

  return {
    isolated: true,
    nodeEnv: nodeEnv || 'test',
    project: gcloudProject || 'demo-nestmate',
    timestamp: new Date().toISOString(),
  };
}

export function assertNotProtectedAccount(email?: string | null, contextName = 'mutation'): void {
  if (!email || typeof email !== 'string') return;
  const normalized = email.toLowerCase().trim();
  if (PROTECTED_ACCOUNTS.includes(normalized as any)) {
    throw new Error(`[CRITICAL SECURITY VIOLATION] Aborting ${contextName}: Target account '${normalized}' is a protected production account (Zero-Touch Policy).`);
  }
}
