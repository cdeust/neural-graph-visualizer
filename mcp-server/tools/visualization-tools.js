const { exec } = require("child_process");
const { buildGraphFromConfig } = require("../pipeline");

function createVisualizationTools(config, dataDeps) {
  const { startUIServer } = dataDeps.httpServer;

  return {
    open_visualization: {
      description: "Launches the interactive 3D graph visualization in a browser",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const { graphData, stats } = buildGraphFromConfig(config);
        const url = await startUIServer(graphData, config);

        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCmd} "${url}"`);

        return {
          url,
          message: `Visualization opened at ${url}`,
          totalNodes: stats.nodes,
          totalEdges: stats.totalEdges,
        };
      },
    },
  };
}

module.exports = { createVisualizationTools };
