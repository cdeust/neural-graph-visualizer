// Neural Graph Visualizer — Mode Manager Module
// Mode detection, switching, and per-mode configuration
// Modes: generic, bibliography, pathway, concept-map

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;

  var currentMode = 'generic';
  var originalNodeStyles = {}; // Store original styles for mode reset

  function detectMode() {
    var hasDoi = nodes.some(function(n) { return n.doi || n.pmid; });
    var hasCitations = nodes.some(function(n) { return n.citationCount !== undefined; });
    if (hasDoi || hasCitations) return 'bibliography';

    var hasFlow = edges.some(function(e) {
      return e.edgeType && NGV.FLOW_EDGE_TYPES && NGV.FLOW_EDGE_TYPES.indexOf(e.edgeType) >= 0;
    });
    if (hasFlow) return 'pathway';

    var hasMastery = nodes.some(function(n) { return n.mastery !== undefined || n.prerequisite !== undefined; });
    if (hasMastery) return 'concept-map';

    return 'generic';
  }

  // Save original node visual state (call once after initial setup)
  function saveOriginalStyles() {
    nodes.forEach(function(n) {
      var mesh = NGV.nodeMeshes[n.id];
      if (!mesh) return;
      var core = mesh.userData.coreMesh;
      originalNodeStyles[n.id] = {
        baseScale: mesh.userData.baseScale,
        emissiveIntensity: core.material.emissiveIntensity,
        emissiveColor: core.material.emissive.clone(),
        color: core.material.color.clone(),
        haloColor: mesh.children[1] ? mesh.children[1].material.color.clone() : null,
      };
    });
  }

  // Restore original styles
  function restoreOriginalStyles() {
    nodes.forEach(function(n) {
      var mesh = NGV.nodeMeshes[n.id];
      var orig = originalNodeStyles[n.id];
      if (!mesh || !orig) return;
      var core = mesh.userData.coreMesh;
      mesh.userData.baseScale = orig.baseScale;
      core.scale.setScalar(orig.baseScale);
      core.material.emissiveIntensity = orig.emissiveIntensity;
      core.material.emissive.copy(orig.emissiveColor);
      core.material.color.copy(orig.color);
      if (mesh.children[1] && orig.haloColor) {
        mesh.children[1].material.color.copy(orig.haloColor);
        mesh.children[1].scale.setScalar(orig.baseScale * 5);
      }
    });
  }

  function setMode(mode) {
    currentMode = mode;

    // Restore defaults first
    restoreOriginalStyles();

    // Apply mode-specific layout + styles
    applyModeConfig(mode);

    // Rebuild fibers after layout change
    if (NGV.buildFiberTracts) NGV.buildFiberTracts();
    if (NGV.computeDefaultEdgeVisibility) NGV.computeDefaultEdgeVisibility();
  }

  function getMode() { return currentMode; }

  function applyModeConfig(mode) {
    if (mode === 'generic') {
      // Standard force layout
      NGV.initPositions3D();
      NGV.runForceLayout3D(200);
      resetCamera();
    } else if (mode === 'bibliography') {
      applyBibliographyLayout();
      applyBibliographyStyles();
      resetCamera();
    } else if (mode === 'pathway') {
      NGV.applyPathwayLayout3D();
      applyPathwayStyles();
      resetCamera();
    } else if (mode === 'concept-map') {
      NGV.applyPathwayLayout3D();
      applyConceptMapStyles();
      resetCamera();
    }
  }

  function resetCamera() {
    // Compute bounding box of all nodes and frame the camera
    var minX = Infinity, maxX = -Infinity;
    var minY = Infinity, maxY = -Infinity;
    var minZ = Infinity, maxZ = -Infinity;
    nodes.forEach(function(n) {
      if (!n.visible) return;
      var x = n.tx !== undefined ? n.tx : n.x;
      var y = n.ty !== undefined ? n.ty : n.y;
      var z = n.tz !== undefined ? n.tz : n.z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    });

    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var cz = (minZ + maxZ) / 2;
    var span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 100);
    var dist = span * 1.2;

    NGV.controls.target.set(cx, cy, cz);
    NGV.camera.position.set(cx, cy + dist * 0.3, cz + dist);
  }

  function applyBibliographyLayout() {
    // X = publication year, Y = citation count (Litmaps-style)
    var minYear = Infinity, maxYear = -Infinity;
    var maxCitations = 1;
    var hasCitationData = false;

    nodes.forEach(function(n) {
      var year = n.year || (n.modifiedAt ? new Date(n.modifiedAt).getFullYear() : 2024);
      n._year = year;
      if (year < minYear) minYear = year;
      if (year > maxYear) maxYear = year;
      var citations = n.citationCount || 0;
      if (citations > 0) hasCitationData = true;
      if (citations > maxCitations) maxCitations = citations;
    });

    // If no year spread, create artificial spread from node order
    if (maxYear - minYear < 1) {
      minYear = 2020;
      maxYear = 2020 + nodes.length;
      nodes.forEach(function(n, i) { n._year = minYear + i; });
    }

    var yearRange = (maxYear - minYear) || 1;

    // If no citation data, use connections as a proxy
    if (!hasCitationData) {
      var maxConn = 1;
      nodes.forEach(function(n) { if (n.connections > maxConn) maxConn = n.connections; });
      nodes.forEach(function(n) {
        var yearNorm = (n._year - minYear) / yearRange;
        var connNorm = n.connections / maxConn;
        n.tx = (yearNorm - 0.5) * 500;
        n.ty = connNorm * 200 - 50;
        n.tz = (Math.random() - 0.5) * 60;
      });
    } else {
      nodes.forEach(function(n) {
        var yearNorm = (n._year - minYear) / yearRange;
        var citations = n.citationCount || 0;
        var citNorm = Math.log(citations + 1) / Math.log(maxCitations + 1);
        n.tx = (yearNorm - 0.5) * 500;
        n.ty = citNorm * 250 - 50;
        n.tz = (Math.random() - 0.5) * 60;
      });
    }

    nodes.forEach(function(n) { n.x = n.tx; n.y = n.ty; n.z = n.tz; });
  }

  function applyBibliographyStyles() {
    var maxConn = 1;
    nodes.forEach(function(n) { if (n.connections > maxConn) maxConn = n.connections; });
    var medianYear = nodes.reduce(function(s, n) { return s + (n._year || 2024); }, 0) / (nodes.length || 1);

    nodes.forEach(function(n) {
      var mesh = NGV.nodeMeshes[n.id];
      if (!mesh) return;
      var connRatio = n.connections / maxConn;
      var isOld = (n._year || 2024) < medianYear;
      var isHighlyConnected = connRatio > 0.5;

      if (isHighlyConnected && isOld) {
        mesh.children[1].material.color.set(0xffd700);
        mesh.userData.coreMesh.material.emissiveIntensity = 3.5;
      } else if (isHighlyConnected && !isOld) {
        mesh.children[1].material.color.set(0x4488ff);
        mesh.userData.coreMesh.material.emissiveIntensity = 3.0;
      }

      // Scale by citations or connections
      var citations = n.citationCount || n.connections || 1;
      var citScale = 2 + Math.log(citations + 1) * 0.6;
      citScale = Math.max(2, Math.min(6, citScale));
      mesh.userData.baseScale = citScale;
      mesh.userData.coreMesh.scale.setScalar(citScale);
      mesh.children[1].scale.setScalar(citScale * 5);
    });
  }

  function applyConceptMapStyles() {
    nodes.forEach(function(n) {
      var mesh = NGV.nodeMeshes[n.id];
      if (!mesh || n.mastery === undefined) return;
      var m = Math.max(0, Math.min(1, n.mastery));
      var r = m < 0.5 ? 1 : 1 - (m - 0.5) * 2;
      var g = m < 0.5 ? m * 2 : 1;
      var color = new THREE.Color(r, g, 0.1);
      mesh.userData.coreMesh.material.emissive = color;
      mesh.userData.coreMesh.material.color = color.clone().multiplyScalar(0.15);
      mesh.children[1].material.color = color;
    });
  }

  function applyPathwayStyles() {
    edges.forEach(function(e, i) {
      if (!e.edgeType) return;
      var isInhibit = NGV.INHIBIT_EDGE_TYPES && NGV.INHIBIT_EDGE_TYPES.indexOf(e.edgeType) >= 0;
      if (isInhibit) {
        var edgeColors = NGV.edgeGeometry.attributes.color.array;
        edgeColors[i*6] = 0.8; edgeColors[i*6+1] = 0.1; edgeColors[i*6+2] = 0.1;
        edgeColors[i*6+3] = 0.8; edgeColors[i*6+4] = 0.1; edgeColors[i*6+5] = 0.1;
      }
    });
    if (NGV.edgeGeometry) NGV.edgeGeometry.attributes.color.needsUpdate = true;
  }

  // Auto-detect on load
  currentMode = detectMode();

  NGV.detectMode = detectMode;
  NGV.setMode = setMode;
  NGV.getMode = getMode;
  NGV.applyModeConfig = applyModeConfig;
  NGV.saveOriginalStyles = saveOriginalStyles;
  NGV.resetModeCamera = resetCamera;
})();
