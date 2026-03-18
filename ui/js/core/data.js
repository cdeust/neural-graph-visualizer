// Neural Graph Visualizer — Data Module
// Loads graph data, builds node/edge maps

window.NGV = window.NGV || {};

(function() {
  var ngvConfig = window.__NGV_CONFIG__ || {};
  var accentColor = ngvConfig.accentColor || '#00d2ff';
  var nodeTypeDefs = ngvConfig.nodeTypes || {};
  var categoryColors = ngvConfig.categoryColors || {};

  // Build runtime type colors from config
  var TYPE_COLORS = {};
  var TYPE_COLORS_RGB = {};
  for (var key in nodeTypeDefs) {
    var def = nodeTypeDefs[key];
    var hex = def.color || '#636e72';
    TYPE_COLORS[key] = new THREE.Color(hex);
    var c = TYPE_COLORS[key];
    TYPE_COLORS_RGB[key] = { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
  }
  TYPE_COLORS.unknown = new THREE.Color(0x636e72);
  TYPE_COLORS_RGB.unknown = { r: 99, g: 110, b: 114 };

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function hexOf(type) {
    var c = TYPE_COLORS_RGB[type] || TYPE_COLORS_RGB.unknown;
    return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  }

  function getTypeColor(node) {
    return TYPE_COLORS[node.type] || TYPE_COLORS[node.nodeType] || TYPE_COLORS.unknown;
  }

  // Data
  var data = window.__GRAPH_DATA__ || { nodes: [], edges: [] };
  var nodes = data.nodes.map(function(n) {
    return Object.assign({}, n, { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, vx: 0, vy: 0, vz: 0, connections: 0, visible: true });
  });
  var edges = data.edges;

  var nodeMap = {};
  nodes.forEach(function(n) { nodeMap[n.id] = n; });

  var nodeByKey = {};
  nodes.forEach(function(n) {
    if (n.path) nodeByKey[n.path] = n;
    if (n.sessionId) nodeByKey[n.sessionId] = n;
  });

  edges.forEach(function(e) {
    if (nodeMap[e.source]) nodeMap[e.source].connections++;
    if (nodeMap[e.target]) nodeMap[e.target].connections++;
  });

  var nodeEdgeMap = {};
  edges.forEach(function(e, i) {
    if (!nodeEdgeMap[e.source]) nodeEdgeMap[e.source] = [];
    if (!nodeEdgeMap[e.target]) nodeEdgeMap[e.target] = [];
    nodeEdgeMap[e.source].push(i);
    nodeEdgeMap[e.target].push(i);
  });

  // Density-based graph scaling
  var graphScale = Math.max(1.0, Math.sqrt(nodes.length / 100));

  // Export to global namespace
  NGV.config = ngvConfig;
  NGV.accentColor = accentColor;
  NGV.nodeTypeDefs = nodeTypeDefs;
  NGV.categoryColors = categoryColors;
  NGV.TYPE_COLORS = TYPE_COLORS;
  NGV.TYPE_COLORS_RGB = TYPE_COLORS_RGB;
  NGV.escapeHtml = escapeHtml;
  NGV.hexOf = hexOf;
  NGV.getTypeColor = getTypeColor;
  NGV.nodes = nodes;
  NGV.edges = edges;
  NGV.nodeMap = nodeMap;
  NGV.nodeByKey = nodeByKey;
  NGV.nodeEdgeMap = nodeEdgeMap;
  // Expanded accessible color palette (12 colors, colorblind-tested)
  NGV.PALETTE = [
    '#4488ff', // blue
    '#26de81', // green
    '#ff6b35', // orange
    '#a55eea', // purple
    '#ff4081', // pink
    '#00d2ff', // cyan
    '#ffdd00', // yellow
    '#ff8a65', // coral
    '#7c4dff', // indigo
    '#00bfa5', // teal
    '#ff5252', // red
    '#64dd17', // lime
  ];

  NGV.graphScale = graphScale;
})();
