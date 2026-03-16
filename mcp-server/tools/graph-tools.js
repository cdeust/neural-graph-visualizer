const { buildGraphFromConfig } = require("../pipeline");
const { loadFromSources } = require("../data/data-source-factory");
const { ensureIndexed } = require("../index/brain-index");
const { createCategorizer } = require("../index/categorizer");
const { autoTag } = require("../index/tagger");

function createGraphTools(config) {
  const categorizer = createCategorizer(config);

  return {
    get_graph: {
      description: "Returns nodes and edges as a graph for visualization",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", description: "Data source path override" },
        },
        required: [],
      },
      handler: async () => {
        const { graphData, stats } = buildGraphFromConfig(config);
        return {
          nodes: graphData.nodes.map(({ body, _filePath, ...rest }) => rest),
          edges: graphData.edges,
          totalNodes: stats.nodes,
          totalEdges: stats.totalEdges,
        };
      },
    },

    get_stats: {
      description: "Returns summary statistics: counts by type, project, and recency",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const { nodes } = loadFromSources(config);
        const byType = {};
        const byProject = {};
        const now = Date.now();
        let recent7d = 0;
        let recent30d = 0;

        for (const n of nodes) {
          byType[n.type] = (byType[n.type] || 0) + 1;
          byProject[n.project] = (byProject[n.project] || 0) + 1;
          const age = now - new Date(n.modifiedAt).getTime();
          if (age < 7 * 86400000) recent7d++;
          if (age < 30 * 86400000) recent30d++;
        }

        return { total: nodes.length, byType, byProject, recent7d, recent30d };
      },
    },

    search: {
      description: "Full-text search across all nodes with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          type: { type: "string", description: "Filter by node type" },
          project: { type: "string", description: "Filter by project" },
          category: { type: "string", description: "Filter by category" },
        },
        required: ["query"],
      },
      handler: async ({ query, type, project, category }) => {
        const { nodes } = loadFromSources(config);
        const index = ensureIndexed(nodes, categorizer, autoTag);
        const q = query.toLowerCase();

        let results = nodes.filter((n) => {
          const match = (n.name || "").toLowerCase().includes(q) ||
            (n.description || "").toLowerCase().includes(q) ||
            (n.body || "").toLowerCase().includes(q);
          if (!match) return false;
          if (type && n.type !== type) return false;
          if (project && !n.project.toLowerCase().includes(project.toLowerCase())) return false;
          if (category) {
            const key = n.path || n.sessionId || n.id;
            const entry = index.nodes[key];
            if (!entry || entry.category !== category) return false;
          }
          return true;
        });

        return { results: results.map(({ body, ...rest }) => rest), count: results.length };
      },
    },
  };
}

module.exports = { createGraphTools };
