const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  accentColor: "#00d2ff",
  connectionRules: {
    sameProject: 0.3,
    sameType: 0.2,
    nameReference: 0.8,
    keywordOverlap: 0.1,
    temporalWindow: "24h",
  },
  dataSources: [],
};

function loadConfig() {
  const configPath = process.env.NGV_CONFIG || path.join(__dirname, "..", "config", "default.json");
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.resolve(configPath), "utf-8"));
  } catch (e) {
    process.stderr.write(`[ngv] Failed to load config from ${configPath}: ${e.message}\n`);
    process.exit(1);
  }

  if (!raw.nodeTypes || typeof raw.nodeTypes !== "object") {
    process.stderr.write("[ngv] Config error: nodeTypes is required\n");
    process.exit(1);
  }
  if (!raw.categoryRules || typeof raw.categoryRules !== "object") {
    process.stderr.write("[ngv] Config error: categoryRules is required\n");
    process.exit(1);
  }

  const config = { ...DEFAULTS, ...raw };

  // Build type color map from nodeTypes
  config.typeColors = {};
  for (const [key, def] of Object.entries(config.nodeTypes)) {
    config.typeColors[key] = def.color || "#636e72";
  }

  // Build category color map (auto-generate if not provided)
  if (!config.categoryColors) {
    const palette = ["#ff4444", "#44ff44", "#44aaff", "#ffaa00", "#888888", "#aaddff", "#ff8800", "#aa44ff", "#00ddaa", "#ffdd00"];
    config.categoryColors = { general: "#666666" };
    const cats = Object.keys(config.categoryRules);
    cats.forEach((cat, i) => {
      config.categoryColors[cat] = palette[i % palette.length];
    });
  }

  return Object.freeze(config);
}

module.exports = { loadConfig };
