function normalizeEdge(raw) {
  return {
    source: raw.source,
    target: raw.target,
    weight: Math.min(Math.max(raw.weight || 0.5, 0), 1),
    edgeType: raw.edgeType || "link",
  };
}

function validateEdge(edge, nodeIds) {
  return (
    edge &&
    typeof edge.source === "string" &&
    typeof edge.target === "string" &&
    nodeIds.has(edge.source) &&
    nodeIds.has(edge.target)
  );
}

module.exports = { normalizeEdge, validateEdge };
