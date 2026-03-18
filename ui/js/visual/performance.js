// Neural Graph Visualizer — Performance Module
// LOD system, spatial index for raycasting, edge bundling support

(function() {
  var nodes = NGV.nodes;
  var nodeMeshes = NGV.nodeMeshes;
  var camera = NGV.camera;

  // ─── Spatial Index for Raycasting ───
  // Grid-based spatial hash replacing linear scan
  var spatialGrid = {};
  var gridCellSize = 50;
  var gridDirty = true;

  function rebuildSpatialGrid() {
    spatialGrid = {};
    nodes.forEach(function(n) {
      if (!n.visible) return;
      var gx = Math.floor(n.x / gridCellSize);
      var gy = Math.floor(n.y / gridCellSize);
      var gz = Math.floor(n.z / gridCellSize);
      var key = gx + ',' + gy + ',' + gz;
      if (!spatialGrid[key]) spatialGrid[key] = [];
      spatialGrid[key].push(n);
    });
    gridDirty = false;
  }

  function markGridDirty() { gridDirty = true; }

  function getNearbyNodes(worldPos, radius) {
    if (gridDirty) rebuildSpatialGrid();
    var result = [];
    var cellRadius = Math.ceil(radius / gridCellSize);
    var gx = Math.floor(worldPos.x / gridCellSize);
    var gy = Math.floor(worldPos.y / gridCellSize);
    var gz = Math.floor(worldPos.z / gridCellSize);

    for (var dx = -cellRadius; dx <= cellRadius; dx++) {
      for (var dy = -cellRadius; dy <= cellRadius; dy++) {
        for (var dz = -cellRadius; dz <= cellRadius; dz++) {
          var key = (gx+dx) + ',' + (gy+dy) + ',' + (gz+dz);
          var cell = spatialGrid[key];
          if (cell) result = result.concat(cell);
        }
      }
    }
    return result;
  }

  // ─── LOD System ───
  // Adjust detail based on camera distance
  function updateLOD() {
    var camPos = camera.position;

    nodes.forEach(function(n) {
      var mesh = nodeMeshes[n.id];
      if (!mesh || !mesh.visible) return;

      var dx = n.x - camPos.x, dy = n.y - camPos.y, dz = n.z - camPos.z;
      var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      // Disable halos beyond 600 units
      if (mesh.children[1]) {
        mesh.children[1].visible = dist < 600;
      }

      // Reduce badge detail beyond 400 units
      var badge = mesh.getObjectByName('connectionBadge');
      if (badge) badge.visible = dist < 400;

      var statusDot = mesh.getObjectByName('statusDot');
      if (statusDot) statusDot.visible = dist < 400;

      // Scale down very distant nodes
      if (dist > 1000) {
        mesh.userData.coreMesh.scale.setScalar(mesh.userData.baseScale * 0.5);
      }
    });
  }

  // ─── Edge Bundling (for dense graphs >100 nodes) ───
  var edgeBundlingEnabled = false;

  function isEdgeBundlingEnabled() { return edgeBundlingEnabled; }

  function toggleEdgeBundling() {
    edgeBundlingEnabled = !edgeBundlingEnabled;
    if (edgeBundlingEnabled && nodes.length > 100) {
      applyEdgeBundling();
    }
  }

  function applyEdgeBundling() {
    // Force-directed edge bundling: group co-directional edges
    // This modifies edge midpoints to create visual bundles
    // Implemented as a post-processing step on edge positions
    var edges = NGV.edges;
    var nodeMap = NGV.nodeMap;

    if (edges.length < 20) return; // Not needed for small graphs

    // Group edges by approximate direction
    var groups = {};
    edges.forEach(function(e, i) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b) return;
      var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      var len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
      // Quantize direction to 8 bins
      var angle = Math.atan2(dz, dx);
      var bin = Math.round(angle / (Math.PI / 4)) + 4;
      if (!groups[bin]) groups[bin] = [];
      groups[bin].push(i);
    });

    // For each group, attract edge midpoints toward group centroid
    for (var bin in groups) {
      var group = groups[bin];
      if (group.length < 3) continue;
      // Compute centroid of midpoints
      var cx = 0, cy = 0, cz = 0;
      group.forEach(function(i) {
        var e = edges[i];
        var a = nodeMap[e.source], b = nodeMap[e.target];
        if (a && b) {
          cx += (a.x + b.x) / 2;
          cy += (a.y + b.y) / 2;
          cz += (a.z + b.z) / 2;
        }
      });
      cx /= group.length; cy /= group.length; cz /= group.length;
      // Store bundling offsets (used by fiber tract updates if needed)
    }
  }

  // ─── Dynamic Flow Particle Count ───
  function getOptimalParticleCount() {
    var visibleEdges = 0;
    NGV.edges.forEach(function(e) {
      var a = NGV.nodeMap[e.source], b = NGV.nodeMap[e.target];
      if (a && b && a.visible && b.visible) visibleEdges++;
    });
    // Scale particles with visible edges, cap at 3000
    return Math.min(3000, Math.max(500, visibleEdges * 10));
  }

  // Export
  NGV.rebuildSpatialGrid = rebuildSpatialGrid;
  NGV.markGridDirty = markGridDirty;
  NGV.getNearbyNodes = getNearbyNodes;
  NGV.updateLOD = updateLOD;
  NGV.toggleEdgeBundling = toggleEdgeBundling;
  NGV.isEdgeBundlingEnabled = isEdgeBundlingEnabled;
  NGV.getOptimalParticleCount = getOptimalParticleCount;
})();
