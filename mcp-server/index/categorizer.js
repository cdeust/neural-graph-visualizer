function createCategorizer(config) {
  const rules = config.categoryRules || {};

  function categorize(text) {
    const lower = text.toLowerCase();
    const scores = {};

    for (const [category, signals] of Object.entries(rules)) {
      let score = 0;
      for (const signal of signals) {
        if (signal.includes(" ")) {
          if (lower.includes(signal)) score += 1.5;
        } else {
          const regex = new RegExp(`\\b${signal}\\b`, "i");
          if (regex.test(lower)) score += 1.0;
        }
      }
      if (score > 0) scores[category] = score;
    }

    let best = "general";
    let bestScore = 0;
    for (const [cat, sc] of Object.entries(scores)) {
      if (sc > bestScore) { bestScore = sc; best = cat; }
    }
    return best;
  }

  return { categorize };
}

module.exports = { createCategorizer };
