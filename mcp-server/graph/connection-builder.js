function buildConnections(nodes, config) {
  const rules = config.connectionRules || {};
  const edges = [];
  const sameProjectW = rules.sameProject || 0.3;
  const sameTypeW = rules.sameType || 0.2;
  const nameRefW = rules.nameReference || 0.8;
  const kwOverlapW = rules.keywordOverlap || 0.1;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let weight = 0;

      if (a.project === b.project) weight += sameProjectW;
      if (a.type === b.type) weight += sameTypeW;

      const aBody = (a.body || "").toLowerCase();
      const bBody = (b.body || "").toLowerCase();
      if (aBody.includes(b.name.toLowerCase()) || bBody.includes(a.name.toLowerCase())) {
        weight += nameRefW;
      }

      const wordsA = new Set(aBody.split(/\W+/).filter((w) => w.length > 6));
      const wordsB = new Set(bBody.split(/\W+/).filter((w) => w.length > 6));
      let shared = 0;
      for (const w of wordsA) if (wordsB.has(w)) shared++;
      weight += Math.min(shared * kwOverlapW, 0.5);

      if (weight >= 0.2) {
        edges.push({
          source: a.id,
          target: b.id,
          weight: Math.min(weight, 1),
          edgeType: "auto",
        });
      }
    }
  }

  return edges;
}

function buildTemporalEdges(nodes, config) {
  const edges = [];
  const windowMs = parseTemporalWindow(config.connectionRules?.temporalWindow || "24h");

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.project !== b.project) continue;

      const aTime = a.endedAt || a.modifiedAt;
      const bTime = b.startedAt || b.modifiedAt;
      if (!aTime || !bTime) continue;

      const gap = Math.abs(new Date(aTime).getTime() - new Date(bTime).getTime());
      if (gap < windowMs) {
        edges.push({
          source: a.id,
          target: b.id,
          weight: Math.min(0.4, 0.15 + 0.25 * (1 - gap / windowMs)),
          edgeType: "temporal",
        });
      }
    }
  }

  return edges;
}

function parseTemporalWindow(val) {
  const match = String(val).match(/^(\d+)(h|m|d)$/);
  if (!match) return 86400000;
  const n = parseInt(match[1]);
  switch (match[2]) {
    case "h": return n * 3600000;
    case "m": return n * 60000;
    case "d": return n * 86400000;
    default: return 86400000;
  }
}

module.exports = { buildConnections, buildTemporalEdges };
