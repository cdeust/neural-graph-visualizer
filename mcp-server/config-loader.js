const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  name: "Research Graph",
  accentColor: "#00d2ff",
  connectionRules: {
    sameProject: 0.3,
    sameType: 0.2,
    nameReference: 0.8,
    keywordOverlap: 0.1,
    temporalWindow: "24h",
  },
  categoryRules: {},
  dataSources: [],
};

const CATEGORY_PALETTE = [
  "#ff4444", "#44ff44", "#44aaff", "#ffaa00", "#888888",
  "#aaddff", "#ff8800", "#aa44ff", "#00ddaa", "#ffdd00",
];

/**
 * Normalize any raw config object into a complete, usable config.
 * Accepts inline _config from JSON files, preset files, or auto-generated configs.
 */
function buildConfig(raw) {
  const config = { ...DEFAULTS, ...raw };
  config.connectionRules = { ...DEFAULTS.connectionRules, ...(raw.connectionRules || {}) };
  config.nodeTypes = config.nodeTypes || {};
  config.categoryRules = config.categoryRules || {};
  config.layout = raw._layout || raw.layout || null;

  // Build type color map
  config.typeColors = {};
  for (const [key, def] of Object.entries(config.nodeTypes)) {
    config.typeColors[key] = def.color || "#636e72";
  }

  // Build category color map
  if (!config.categoryColors) {
    config.categoryColors = { general: "#666666" };
    const cats = Object.keys(config.categoryRules);
    cats.forEach((cat, i) => {
      config.categoryColors[cat] = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    });
  }

  return Object.freeze(config);
}

/**
 * Load config from a JSON file on disk and normalize it.
 */
function loadConfigFile(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
    return buildConfig(raw);
  } catch (e) {
    process.stderr.write(`[ngv] Failed to load config from ${resolved}: ${e.message}\n`);
    process.exit(1);
  }
}

/**
 * Load config from NGV_CONFIG env var or fall back to default preset.
 */
function loadConfig() {
  const configPath = process.env.NGV_CONFIG || path.join(__dirname, "..", "config", "default.json");
  return loadConfigFile(configPath);
}

module.exports = { buildConfig, loadConfigFile, loadConfig };
