const STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
]);

function autoTag(text) {
  const tokens = text.split(/[\s,;:!?()\[\]{}"'`]+/).filter(Boolean);
  const freq = {};
  const technical = new Set();

  for (const raw of tokens) {
    const lower = raw.toLowerCase();
    if (STOPWORDS.has(lower) || lower.length < 2) continue;
    if (/[A-Z][a-z]+[A-Z]/.test(raw)) {
      const parts = raw.split(/(?=[A-Z])/).map((p) => p.toLowerCase());
      for (const p of parts) {
        if (p.length >= 2 && !STOPWORDS.has(p)) technical.add(p);
      }
    }
    if (raw.includes("-") && raw.length > 3) technical.add(lower);
    if (raw.includes(".") && raw.length > 3) technical.add(lower);
    freq[lower] = (freq[lower] || 0) + 1;
  }

  const candidates = new Set();
  for (const [word, count] of Object.entries(freq)) {
    if (count >= 2 || word.length > 8) candidates.add(word);
  }
  for (const t of technical) candidates.add(t);

  const sorted = [...candidates].sort((a, b) => (freq[b] || 0) - (freq[a] || 0)).slice(0, 5);
  return sorted.map((t) => t.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).filter((t) => t.length > 0).slice(0, 8);
}

module.exports = { autoTag };
