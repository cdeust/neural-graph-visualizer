function createVisualizationTools(config, dataDeps) {
  const { loadFromSources } = dataDeps.dataSourceFactory;
  const { buildConnections, buildTemporalEdges } = dataDeps.connectionBuilder;
  const { ensureIndexed, enrichNodes } = dataDeps.brainIndex;
  const { startUIServer } = dataDeps.httpServer;
  const { createCategorizer } = dataDeps.categorizer;
  const { autoTag } = dataDeps.tagger;
  const categorizer = createCategorizer(config);

  return {
    open_visualization: {
      description: "Launches the interactive 3D graph visualization in a browser",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const { nodes, edges: sourceEdges } = loadFromSources(config);
        const autoEdges = buildConnections(nodes, config);
        const temporalEdges = buildTemporalEdges(nodes, config);
        const allEdges = [...sourceEdges, ...autoEdges, ...temporalEdges];

        const index = ensureIndexed(nodes, categorizer, autoTag);
        const enriched = enrichNodes(nodes, index);

        // Cross-reference edges
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

        const graphData = { nodes: enriched, edges: allEdges };
        const url = await startUIServer(graphData, config);

        const { exec } = require("child_process");
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCmd} "${url}"`);

        return {
          url,
          message: `Visualization opened at ${url}`,
          totalNodes: enriched.length,
          totalEdges: allEdges.length,
        };
      },
    },
  };
}

module.exports = { createVisualizationTools };
