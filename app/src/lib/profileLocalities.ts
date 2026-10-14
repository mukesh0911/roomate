export const MAX_PREFERRED_LOCALITIES = 3;

/**
 * The profile editor exposes one primary locality, while onboarding can save
 * up to three. Keep the other selections when that primary value is edited.
 */
export function mergePreferredLocalities(existing: unknown, primary: string): string[] {
  const values = Array.isArray(existing) ? existing : [];
  const candidates = [primary, ...values];
  const seen = new Set<string>();

  return candidates.reduce<string[]>((result, value) => {
    if (typeof value !== 'string') return result;
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key) || result.length >= MAX_PREFERRED_LOCALITIES) return result;
    seen.add(key);
    result.push(trimmed);
    return result;
  }, []);
}
