const PALETTE = [
  "#ff6b35", "#26de81", "#ff4081", "#45aaf2", "#a55eea",
  "#ffaa00", "#2bcbba", "#fd79a8", "#00cec9", "#6c5ce7",
];

const SHAPES = ["sphere", "hex"];

function generateConfig(nodes) {
  const types = [...new Set(nodes.map((n) => n.type || "entity"))];
  const nodeTypes = {};

  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    nodeTypes[t] = {
      color: PALETTE[i % PALETTE.length],
      shape: SHAPES[i % SHAPES.length],
      label: t.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }

  return {
    name: "Auto-generated Config",
    accentColor: "#00d2ff",
    nodeTypes,
    categoryRules: {},
    connectionRules: {
      sameProject: 0.3,
      sameType: 0.2,
      nameReference: 0.8,
      keywordOverlap: 0.1,
      temporalWindow: "24h",
    },
    dataSources: [],
  };
}

module.exports = { generateConfig };
