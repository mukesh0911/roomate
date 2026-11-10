/** Existing persisted aliases, in the same order on member and staff views. */
export function listingRent(data: Record<string, unknown>): number | null {
  for (const key of ['partnerShare', 'totalRent', 'monthlyRent', 'rent']) {
    const value = data[key];
    if (value === '' || value == null) continue;
    const amount = Number(value);
    if (Number.isFinite(amount) && amount >= 0) return amount;
  }
  return null;
}

export function listingStatusLabel(status: unknown): string {
  const labels: Record<string, string> = {
    active: 'Active', draft: 'Draft', pending: 'Pending', pending_verification: 'Pending verification',
    rejected: 'Rejected', paused: 'Paused', filled: 'Filled', expired: 'Expired',
    flagged: 'Flagged', removed: 'Removed', deleted: 'Deleted',
  };
  return typeof status === 'string' ? labels[status.toLowerCase()] || 'Unknown' : 'Unknown';
}

export function pairIsBlocked(a: { blockedUserIds?: string[] }, b: { blockedUserIds?: string[] }, aId: string, bId: string) {
  return (a.blockedUserIds || []).includes(bId) || (b.blockedUserIds || []).includes(aId);
}

export function consentIsCurrent(a: any, b: any, connection: any): boolean {
  const millis = (value: any) => value?.toMillis?.() || 0;
  const created = millis(connection.createdAt);
  return created >= millis(a.communicationRevokedAt?.[connection.toUserId])
    && created >= millis(b.communicationRevokedAt?.[connection.fromUserId])
    && (Boolean(connection.listingId) || (created >= millis(a.personCommunicationRevokedAt?.[connection.toUserId])
      && created >= millis(b.personCommunicationRevokedAt?.[connection.fromUserId])));
}
