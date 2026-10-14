import { describe, expect, it } from 'vitest';
import { mergePreferredLocalities } from './profileLocalities';

describe('mergePreferredLocalities', () => {
  it('keeps onboarding selections when the primary locality changes', () => {
    expect(mergePreferredLocalities(['Koramangala', 'HSR Layout', 'Indiranagar'], 'Whitefield'))
      .toEqual(['Whitefield', 'Koramangala', 'HSR Layout']);
  });

  it('does not erase existing preferred localities when the single editor field is empty', () => {
    expect(mergePreferredLocalities(['Koramangala', 'HSR Layout'], ''))
      .toEqual(['Koramangala', 'HSR Layout']);
  });

  it('normalizes duplicate values and removes invalid entries', () => {
    expect(mergePreferredLocalities([' HSR Layout ', '', 'hsr layout', 42], 'HSR Layout'))
      .toEqual(['HSR Layout']);
  });
});
