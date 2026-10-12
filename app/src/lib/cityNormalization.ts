/**
 * City normalization helpers — handles common Indian city name aliases
 * so that discovery queries don't silently return zero results due to
 * minor spelling / naming variations (e.g. Bengaluru vs Bangalore).
 *
 * This is NOT a hardcoded city list — it only maps well-known aliases
 * for cities where dual names are in common use. Unknown cities pass
 * through unchanged.
 */

/** Bidirectional alias map: each pair maps both directions. */
const CITY_ALIASES: ReadonlyMap<string, string> = new Map([
  ['bengaluru', 'bangalore'],
  ['bangalore', 'bengaluru'],
  ['mumbai', 'bombay'],
  ['bombay', 'mumbai'],
  ['chennai', 'madras'],
  ['madras', 'chennai'],
  ['kolkata', 'calcutta'],
  ['calcutta', 'kolkata'],
  ['pune', 'poona'],
  ['poona', 'pune'],
  ['kochi', 'cochin'],
  ['cochin', 'kochi'],
  ['thiruvananthapuram', 'trivandrum'],
  ['trivandrum', 'thiruvananthapuram'],
]);

/**
 * Returns the canonical alias for a city, or the city itself if no alias exists.
 * Input is expected to be lowercase-trimmed already.
 */
export function getCityAlias(city: string): string | null {
  return CITY_ALIASES.get(city) || null;
}

/**
 * True when two city names refer to the same city (exact match or alias).
 * Both inputs should be lowercase-trimmed.
 */
export function areSameCityAlias(a: string, b: string): boolean {
  if (a === b) return true;
  return CITY_ALIASES.get(a) === b;
}

/** Exact Firestore values worth querying for a user-entered city name. */
export function getCityQueryValues(city: string): string[] {
  const trimmed = city.trim();
  if (!trimmed) return [];
  const normalized = trimmed.toLowerCase();
  const alias = getCityAlias(normalized);
  const titleCase = (value: string) => value.replace(/\b\w/g, char => char.toUpperCase());
  return Array.from(new Set([
    trimmed,
    normalized,
    titleCase(normalized),
    ...(alias ? [alias, titleCase(alias)] : []),
  ]));
}
