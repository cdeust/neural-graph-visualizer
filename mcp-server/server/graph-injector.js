function injectGraphData(html, graphData, config) {
  // Strip heavy fields from client payload
  const clientNodes = graphData.nodes.map((n) => {
    const { _filePath, body, firstMessage, summary, ...rest } = n;
    return rest;
  });

  const clientData = { nodes: clientNodes, edges: graphData.edges };

  const configPayload = {
    name: config.name,
    accentColor: config.accentColor,
    nodeTypes: config.nodeTypes,
    categoryColors: config.categoryColors || {},
    typeColors: config.typeColors || {},
  };

  html = html.replace(
    "/*__GRAPH_DATA__*/",
    `window.__GRAPH_DATA__ = ${JSON.stringify(clientData)};`
  );

  html = html.replace(
    "/*__NGV_CONFIG__*/",
    `window.__NGV_CONFIG__ = ${JSON.stringify(configPayload)};`
  );

  return html;
}

module.exports = { injectGraphData };
