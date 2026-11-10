async function jobCall(name: string, data: Record<string, unknown>): Promise<any> {
  const [{ functions }, { httpsCallable }] = await Promise.all([import('./firebase'), import('firebase/functions')]);
  return (await httpsCallable(functions, name)(data)).data;
}
export const queueBroadcastBackend = (data: Record<string, unknown>) => BROADCAST_DELIVERY_AVAILABLE
  ? jobCall('queueBroadcast', data) : Promise.reject(new Error('Broadcast delivery is temporarily unavailable.'));
export async function prepareAccountExportBackend(): Promise<{ blob: Blob; fileName: string }> {
  if (!ACCOUNT_EXPORT_AVAILABLE) throw new Error('Data exports are temporarily unavailable.');
  let state = await jobCall('requestAccountExport', { action: 'start' });
  const until = Date.now() + 120000;
  while (['queued', 'processing'].includes(state.status) && Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    state = await jobCall('requestAccountExport', { action: 'status' });
  }
  if (state.status !== 'complete') throw new Error(state.status === 'failed'
    ? 'Export preparation failed. Request again to retry.' : 'Export is still preparing or cleaning up. Request again to check progress.');
  const ready = await jobCall('requestAccountExport', { action: 'download' });
  const [{ storage }, { ref, getBlob }] = await Promise.all([import('./firebase'), import('firebase/storage')]);
  return { blob: await getBlob(ref(storage, ready.objectPath), 100 * 1024 * 1024), fileName: ready.fileName };
}
// Enable a control only after its callable AND worker/storage lifecycle have
// been deployed and accepted in the target environment.
export const ACCOUNT_EXPORT_AVAILABLE = import.meta.env.VITE_ACCOUNT_EXPORT_ENABLED === 'true';
export const BROADCAST_DELIVERY_AVAILABLE = import.meta.env.VITE_BROADCASTS_ENABLED === 'true';
