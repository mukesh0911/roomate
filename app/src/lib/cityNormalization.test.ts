import { describe, it, expect } from 'vitest';
import { areSameCityAlias, getCityAlias, getCityQueryValues } from './cityNormalization';

describe('cityNormalization', () => {
  it('correctly maps common Indian city aliases', () => {
    expect(areSameCityAlias('bengaluru', 'bangalore')).toBe(true);
    expect(areSameCityAlias('bangalore', 'bengaluru')).toBe(true);
    expect(areSameCityAlias('mumbai', 'bombay')).toBe(true);
    expect(areSameCityAlias('bombay', 'mumbai')).toBe(true);
    expect(areSameCityAlias('chennai', 'madras')).toBe(true);
    expect(areSameCityAlias('madras', 'chennai')).toBe(true);
    expect(areSameCityAlias('kolkata', 'calcutta')).toBe(true);
    expect(areSameCityAlias('calcutta', 'kolkata')).toBe(true);
    expect(areSameCityAlias('pune', 'poona')).toBe(true);
    expect(areSameCityAlias('poona', 'pune')).toBe(true);
  });

  it('matches identical city names', () => {
    expect(areSameCityAlias('delhi', 'delhi')).toBe(true);
    expect(areSameCityAlias('hyderabad', 'hyderabad')).toBe(true);
  });

  it('returns false for different, non-aliased cities', () => {
    expect(areSameCityAlias('bengaluru', 'mumbai')).toBe(false);
    expect(areSameCityAlias('delhi', 'mumbai')).toBe(false);
    expect(areSameCityAlias('chennai', 'kolkata')).toBe(false);
  });

  it('getCityAlias returns canonical alias or null', () => {
    expect(getCityAlias('bengaluru')).toBe('bangalore');
    expect(getCityAlias('bangalore')).toBe('bengaluru');
    expect(getCityAlias('delhi')).toBeNull();
  });

  it('builds case-tolerant Firestore query values including aliases', () => {
    expect(getCityQueryValues(' Bengaluru ')).toEqual([
      'Bengaluru', 'bengaluru', 'bangalore', 'Bangalore',
    ]);
    expect(getCityQueryValues('DELHI')).toEqual(['DELHI', 'delhi', 'Delhi']);
    expect(getCityQueryValues('   ')).toEqual([]);
  });
});
