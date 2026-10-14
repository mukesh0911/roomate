function normalizedSet(value) {
  return new Set(Array.isArray(value)
    ? value.filter(item => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(Boolean)
    : []);
}

/** Returns only reviewed, non-sensitive compatibility output. */
function deriveCompatibilitySummary(viewer, candidate) {
  const reasons = [];
  let score = 0;
  if (viewer.city && candidate.city && viewer.city.trim().toLowerCase() === candidate.city.trim().toLowerCase()) {
    score += 35;
    reasons.push('same_city');
  }
  const viewerLocalities = normalizedSet(viewer.localities);
  const candidateLocalities = normalizedSet(candidate.localities);
  if ([...viewerLocalities].some(locality => candidateLocalities.has(locality))) {
    score += 15;
    reasons.push('locality_overlap');
  }
  const viewerAnswers = viewer.quizAnswers && typeof viewer.quizAnswers === 'object' ? viewer.quizAnswers : {};
  const candidateAnswers = candidate.quizAnswers && typeof candidate.quizAnswers === 'object' ? candidate.quizAnswers : {};
  const shared = Object.keys(viewerAnswers).filter(key => typeof viewerAnswers[key] === 'string' && candidateAnswers[key] === viewerAnswers[key]);
  if (shared.length >= 5) {
    score += 50;
    reasons.push('lifestyle_alignment');
  } else if (shared.length >= 2) {
    score += 25;
    reasons.push('some_lifestyle_alignment');
  }
  const band = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { scoreBand: band, reasonCodes: reasons };
}

module.exports = { deriveCompatibilitySummary };
