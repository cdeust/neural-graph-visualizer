const { buildGraphFromFile } = require("../pipeline");
const { loadNodesCsv, loadEdgesCsv } = require("../data/csv-loader");
const { buildGraphData } = require("../pipeline");

function createImportTools(config) {
  return {
    import_json: {
      description: "Import a graph from a JSON file with { nodes: [...], edges: [...] }",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to JSON file" },
          merge: { type: "boolean", description: "Merge with existing data (default: false)" },
        },
        required: ["path"],
      },
      handler: async ({ path: filePath }) => {
        const { stats } = buildGraphFromFile(filePath);
        if (stats.nodes === 0) {
          return { error: "No nodes found in file", path: filePath };
        }
        return {
          imported: true,
          nodes: stats.nodes,
          edges: stats.totalEdges,
          path: filePath,
        };
      },
    },

    import_csv: {
      description: "Import nodes and edges from CSV files",
      inputSchema: {
        type: "object",
        properties: {
          nodes_path: { type: "string", description: "Path to nodes CSV file" },
          edges_path: { type: "string", description: "Path to edges CSV file (optional)" },
        },
        required: ["nodes_path"],
      },
      handler: async ({ nodes_path, edges_path }) => {
        const nodes = loadNodesCsv(nodes_path);
        const edges = edges_path ? loadEdgesCsv(edges_path) : [];

        if (nodes.length === 0) {
          return { error: "No nodes found in CSV", path: nodes_path };
        }

        const { stats } = buildGraphData(nodes, edges, config);

        return {
          imported: true,
          nodes: stats.nodes,
          edges: stats.totalEdges,
          nodesPath: nodes_path,
          edgesPath: edges_path || null,
        };
      },
    },
  };
}

module.exports = { createImportTools };
