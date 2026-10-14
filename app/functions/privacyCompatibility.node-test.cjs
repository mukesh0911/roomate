const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveCompatibilitySummary } = require('./privacyCompatibility');

test('returns only safe summary fields', () => {
  const result = deriveCompatibilitySummary(
    { city: 'Bengaluru', localities: ['Indiranagar'], quizAnswers: { smoking: 'never', food: 'veg', sleep: 'early', pets: 'ok', work: 'hybrid' } },
    { city: 'Bengaluru', localities: ['Indiranagar'], quizAnswers: { smoking: 'never', food: 'veg', sleep: 'early', pets: 'ok', work: 'hybrid' } },
  );
  assert.deepEqual(result, { scoreBand: 'high', reasonCodes: ['same_city', 'locality_overlap', 'lifestyle_alignment'] });
  assert.equal(Object.hasOwn(result, 'quizAnswers'), false);
});
