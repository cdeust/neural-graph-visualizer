const { buildConfig } = require("./config-loader");
const { generateConfig } = require("./config-generator");
const { loadJsonGraph } = require("./data/json-loader");
const { loadFromSources } = require("./data/data-source-factory");
const { buildConnections, buildTemporalEdges } = require("./graph/connection-builder");
const { ensureIndexed, enrichNodes } = require("./index/brain-index");
const { createCategorizer } = require("./index/categorizer");
const { autoTag } = require("./index/tagger");

/**
 * Build a complete graph from a data file.
 * Resolves config from: inline _config → auto-generated from node types.
 *
 * @param {string} filePath — path to a JSON data file
 * @returns {{ graphData, config }}
 */
function buildGraphFromFile(filePath) {
  const { nodes, edges, inlineConfig } = loadJsonGraph(filePath);
  const rawConfig = inlineConfig || generateConfig(nodes);
  const config = buildConfig(rawConfig);
  return buildGraphData(nodes, edges, config);
}

/**
 * Build a complete graph from a config with dataSources.
 * Used by the MCP server where config drives which files to load.
 *
 * @param {object} config — normalized config (from loadConfig/buildConfig)
 * @returns {{ graphData, config }}
 */
function buildGraphFromConfig(config) {
  const { nodes, edges } = loadFromSources(config);
  return buildGraphData(nodes, edges, config);
}

/**
 * Core pipeline: connect → index → enrich → assemble.
 */
function buildGraphData(nodes, sourceEdges, config) {
  const autoEdges = buildConnections(nodes, config);
  const temporalEdges = buildTemporalEdges(nodes, config);
  const allEdges = [...sourceEdges, ...autoEdges, ...temporalEdges];

  const categorizer = createCategorizer(config);
  const index = ensureIndexed(nodes, categorizer, autoTag);
  const enriched = enrichNodes(nodes, index);

  // Cross-reference edges from brain index
  const nodeIdByKey = {};
  for (const n of nodes) nodeIdByKey[n.path || n.sessionId || n.id] = n.id;
  for (const [key, entry] of Object.entries(index.nodes)) {
    if (entry.crossRefs && nodeIdByKey[key]) {
      for (const ref of entry.crossRefs) {
        if (nodeIdByKey[ref]) {
          allEdges.push({ source: nodeIdByKey[key], target: nodeIdByKey[ref], weight: 1.0, edgeType: "cross-ref" });
        }
      }
    }
  }

  return {
    graphData: { nodes: enriched, edges: allEdges },
    config,
    stats: {
      nodes: enriched.length,
      sourceEdges: sourceEdges.length,
      autoEdges: autoEdges.length,
      temporalEdges: temporalEdges.length,
      totalEdges: allEdges.length,
    },
  };
}

module.exports = { buildGraphFromFile, buildGraphFromConfig, buildGraphData };
