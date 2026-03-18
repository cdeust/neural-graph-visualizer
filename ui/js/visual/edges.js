// Neural Graph Visualizer — Edge Visual Module
// Edge lines, fiber tracts, click-to-reveal, flow particles

(function() {
  var edges = NGV.edges;
  var nodes = NGV.nodes;
  var nodeMap = NGV.nodeMap;
  var getTypeColor = NGV.getTypeColor;
  var TYPE_COLORS = NGV.TYPE_COLORS;
  var scene = NGV.scene;
  var graphScale = NGV.graphScale;

  // ─── Edge lines ───
  var edgePositions = new Float32Array(edges.length * 6);
  var edgeColors = new Float32Array(edges.length * 6);
  var edgeBaseAlphas = new Float32Array(edges.length);

  var edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));

  var edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.25,
    blending: THREE.NormalBlending, depthWrite: false,
  });

  var edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  scene.add(edgeLines);

  // Edge type color modifiers
  var INHIBIT_TYPES = ['inhibition'];
  var PROXIMITY_TYPES = ['binding', 'expression', 'synergy', 'measured_by', 'relates_to', 'participates_in'];

  edges.forEach(function(e, i) {
    var srcNode = nodeMap[e.source];
    var color = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
    // Weight-mapped opacity: heavier edges are more visible
    var dim = 0.06 + (e.weight || 0.1) * 0.18;

    // Edge type color modifiers
    var r = color.r, g = color.g, b = color.b;
    if (e.edgeType && INHIBIT_TYPES.indexOf(e.edgeType) >= 0) {
      r = 0.9; g = 0.15; b = 0.15; // Red for inhibition
    } else if (e.edgeType && PROXIMITY_TYPES.indexOf(e.edgeType) >= 0) {
      // Softer color for proximity edges
      dim *= 0.7;
    }

    edgeColors[i*6]   = r * dim; edgeColors[i*6+1] = g * dim; edgeColors[i*6+2] = b * dim;
    edgeColors[i*6+3] = r * dim; edgeColors[i*6+4] = g * dim; edgeColors[i*6+5] = b * dim;
    edgeBaseAlphas[i] = dim;
  });

  // ─── Fiber tracts (curved tubes for top connections) ───
  var fiberTracts = new THREE.Group();
  scene.add(fiberTracts);
  var fiberEdgeIndices = [];

  function buildFiberTracts() {
    while (fiberTracts.children.length) fiberTracts.remove(fiberTracts.children[0]);
    fiberEdgeIndices = [];
    if (edges.length === 0) return;

    var sortedWeights = edges.map(function(e) { return e.weight || 0; }).sort(function(a,b) { return b - a; });
    var topIdx = Math.max(1, Math.floor(sortedWeights.length * 0.1));
    var weightThreshold = sortedWeights[Math.min(topIdx, sortedWeights.length - 1)];

    edges.forEach(function(e, i) {
      if ((e.weight || 0) < weightThreshold) return;
      var srcNode = nodeMap[e.source], tgtNode = nodeMap[e.target];
      if (!srcNode || !tgtNode) return;

      fiberEdgeIndices.push(i);
      var start = new THREE.Vector3(srcNode.x, srcNode.y, srcNode.z);
      var end = new THREE.Vector3(tgtNode.x, tgtNode.y, tgtNode.z);
      var mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      var dist = start.distanceTo(end);
      var dir = new THREE.Vector3().subVectors(end, start).normalize();
      var up = new THREE.Vector3(0, 1, 0);
      var perp = new THREE.Vector3().crossVectors(dir, up).normalize();
      if (perp.length() < 0.01) perp.set(1, 0, 0);
      mid.add(perp.multiplyScalar(dist * 0.15));
      mid.y += dist * 0.1;

      var curve = new THREE.CatmullRomCurve3([start, mid, end]);
      var tubeRadius = 0.3 + (e.weight || 0.5) * 0.8;
      var tubeGeo = new THREE.TubeGeometry(curve, 16, tubeRadius, 6, false);
      var color = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
      var tubeMat = new THREE.MeshStandardMaterial({
        color: color, emissive: color, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.4, roughness: 0.6, metalness: 0.2,
      });
      var tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.userData = { edgeIdx: i };
      fiberTracts.add(tube);
    });

    fiberEdgeIndices.forEach(function(i) {
      edgeColors[i*6] *= 0.3; edgeColors[i*6+1] *= 0.3; edgeColors[i*6+2] *= 0.3;
      edgeColors[i*6+3] *= 0.3; edgeColors[i*6+4] *= 0.3; edgeColors[i*6+5] *= 0.3;
    });
    edgeGeometry.attributes.color.needsUpdate = true;
  }

  function updateFiberTracts() {
    fiberTracts.children.forEach(function(tube) {
      var i = tube.userData.edgeIdx;
      var e = edges[i];
      var srcNode = nodeMap[e.source], tgtNode = nodeMap[e.target];
      if (!srcNode || !tgtNode || !srcNode.visible || !tgtNode.visible) {
        tube.visible = false;
        return;
      }
      tube.visible = true;
      var start = new THREE.Vector3(srcNode.x, srcNode.y, srcNode.z);
      var end = new THREE.Vector3(tgtNode.x, tgtNode.y, tgtNode.z);
      var mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      var dist = start.distanceTo(end);
      var dir = new THREE.Vector3().subVectors(end, start).normalize();
      var up = new THREE.Vector3(0, 1, 0);
      var perp = new THREE.Vector3().crossVectors(dir, up).normalize();
      if (perp.length() < 0.01) perp.set(1, 0, 0);
      mid.add(perp.multiplyScalar(dist * 0.15));
      mid.y += dist * 0.1;

      var curve = new THREE.CatmullRomCurve3([start, mid, end]);
      var points = curve.getPoints(16);
      var positions = tube.geometry.attributes.position.array;
      var segCount = 17;
      var radialCount = 6;
      for (var s = 0; s < segCount && s < points.length; s++) {
        var oldCenter = new THREE.Vector3(0, 0, 0);
        for (var rr = 0; rr <= radialCount; rr++) {
          var ii = (s * (radialCount + 1) + rr) * 3;
          if (ii + 2 < positions.length) {
            oldCenter.x += positions[ii]; oldCenter.y += positions[ii+1]; oldCenter.z += positions[ii+2];
          }
        }
        oldCenter.divideScalar(radialCount + 1);
        var offset = new THREE.Vector3().subVectors(points[s], oldCenter);
        for (var rr2 = 0; rr2 <= radialCount; rr2++) {
          var ii2 = (s * (radialCount + 1) + rr2) * 3;
          if (ii2 + 2 < positions.length) {
            positions[ii2] += offset.x; positions[ii2+1] += offset.y; positions[ii2+2] += offset.z;
          }
        }
      }
      tube.geometry.attributes.position.needsUpdate = true;
    });
  }

  // ─── Click-to-reveal ───
  var defaultEdgeVisibility = [];
  var revealedNodeId = null;

  function computeDefaultEdgeVisibility() {
    defaultEdgeVisibility = [];
    if (edges.length === 0) return;
    var sortedWeights = edges.map(function(e) { return e.weight || 0; }).sort(function(a,b) { return b - a; });
    var topIdx = Math.max(1, Math.floor(sortedWeights.length * 0.1));
    var weightThreshold = sortedWeights[Math.min(topIdx, sortedWeights.length - 1)];
    edges.forEach(function(e) {
      var isTop = (e.weight || 0) >= weightThreshold;
      var isStructural = !!e.edgeType && e.edgeType !== 'auto' && e.edgeType !== 'temporal';
      defaultEdgeVisibility.push(isTop || isStructural);
    });
    applyEdgeVisibility();
  }

  function applyEdgeVisibility() {
    edges.forEach(function(e, i) {
      var show = defaultEdgeVisibility[i];
      if (revealedNodeId && (e.source === revealedNodeId || e.target === revealedNodeId)) {
        show = true;
      }
      var srcNode = nodeMap[e.source];
      var color = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
      if (!show) {
        edgeColors[i*6] = 0; edgeColors[i*6+1] = 0; edgeColors[i*6+2] = 0;
        edgeColors[i*6+3] = 0; edgeColors[i*6+4] = 0; edgeColors[i*6+5] = 0;
      } else {
        var dim = edgeBaseAlphas[i];
        if (revealedNodeId && (e.source === revealedNodeId || e.target === revealedNodeId)) {
          dim = Math.min(dim * 3, 1.0);
        }
        edgeColors[i*6] = color.r*dim; edgeColors[i*6+1] = color.g*dim; edgeColors[i*6+2] = color.b*dim;
        edgeColors[i*6+3] = color.r*dim; edgeColors[i*6+4] = color.g*dim; edgeColors[i*6+5] = color.b*dim;
      }
    });
    edgeGeometry.attributes.color.needsUpdate = true;
  }

  function setRevealedNode(nodeId) {
    revealedNodeId = nodeId;
    applyEdgeVisibility();
  }

  // ─── Flow particles ───
  var NUM_FLOW_PARTICLES = 3000;
  var flowParticleData = [];
  var flowPositions = new Float32Array(NUM_FLOW_PARTICLES * 3);
  var flowColors = new Float32Array(NUM_FLOW_PARTICLES * 3);
  var flowSizes = new Float32Array(NUM_FLOW_PARTICLES);

  for (var fi = 0; fi < NUM_FLOW_PARTICLES; fi++) {
    var ei = edges.length > 0 ? Math.floor(Math.random() * edges.length) : 0;
    flowParticleData.push({ edgeIdx: ei, progress: Math.random(), speed: 0.002 + Math.random() * 0.006 });
    flowPositions[fi*3] = 9999; flowPositions[fi*3+1] = 9999; flowPositions[fi*3+2] = 9999;
    if (edges.length > 0) {
      var srcNode = nodeMap[edges[ei].source];
      var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
      flowColors[fi*3] = c.r; flowColors[fi*3+1] = c.g; flowColors[fi*3+2] = c.b;
    }
    flowSizes[fi] = 1.5 + Math.random() * 1.5;
  }

  var flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPositions, 3));
  flowGeo.setAttribute('color', new THREE.BufferAttribute(flowColors, 3));
  flowGeo.setAttribute('size', new THREE.BufferAttribute(flowSizes, 1));

  var flowMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: {},
    vertexShader: [
      'attribute float size;',
      'attribute vec3 color;',
      'varying vec3 vColor;',
      'void main() {',
      '  vColor = color;',
      '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = size * (200.0 / -mvPos.z);',
      '  gl_Position = projectionMatrix * mvPos;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vColor;',
      'void main() {',
      '  float d = length(gl_PointCoord - 0.5);',
      '  if (d > 0.5) discard;',
      '  float alpha = smoothstep(0.5, 0.0, d) * 0.7;',
      '  gl_FragColor = vec4(vColor, alpha);',
      '}',
    ].join('\n'),
  });

  var flowPoints = new THREE.Points(flowGeo, flowMat);
  scene.add(flowPoints);

  // Update functions
  function updateEdgePositions() {
    var pos = edgeGeometry.attributes.position.array;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b || !a.visible || !b.visible) {
        pos[i*6]=9999; pos[i*6+1]=9999; pos[i*6+2]=9999;
        pos[i*6+3]=9999; pos[i*6+4]=9999; pos[i*6+5]=9999;
        continue;
      }
      pos[i*6]=a.x; pos[i*6+1]=a.y; pos[i*6+2]=a.z;
      pos[i*6+3]=b.x; pos[i*6+4]=b.y; pos[i*6+5]=b.z;
    }
    edgeGeometry.attributes.position.needsUpdate = true;
  }

  function updateFlowParticles() {
    if (edges.length === 0) return;
    var pos = flowGeo.attributes.position.array;
    var cols = flowGeo.attributes.color.array;

    for (var i = 0; i < NUM_FLOW_PARTICLES; i++) {
      var p = flowParticleData[i];
      p.progress += p.speed;
      if (p.progress > 1) {
        p.edgeIdx = Math.floor(Math.random() * edges.length);
        p.progress = 0;
        var srcNode = nodeMap[edges[p.edgeIdx].source];
        var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
        cols[i*3] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
      }
      var e = edges[p.edgeIdx];
      var a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b || !a.visible || !b.visible) {
        pos[i*3]=9999; pos[i*3+1]=9999; pos[i*3+2]=9999;
        continue;
      }
      var t = p.progress;
      pos[i*3] = a.x + (b.x - a.x) * t;
      pos[i*3+1] = a.y + (b.y - a.y) * t;
      pos[i*3+2] = a.z + (b.z - a.z) * t;
    }
    flowGeo.attributes.position.needsUpdate = true;
    flowGeo.attributes.color.needsUpdate = true;
  }

  function highlightEdges(nodeId) {
    edges.forEach(function(e, i) {
      var srcNode = nodeMap[e.source];
      var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
      var dim = edgeBaseAlphas[i];
      edgeColors[i*6] = c.r*dim; edgeColors[i*6+1] = c.g*dim; edgeColors[i*6+2] = c.b*dim;
      edgeColors[i*6+3] = c.r*dim; edgeColors[i*6+4] = c.g*dim; edgeColors[i*6+5] = c.b*dim;
    });
    var nodeEdgeMap = NGV.nodeEdgeMap;
    if (nodeId && nodeEdgeMap[nodeId]) {
      for (var j = 0; j < nodeEdgeMap[nodeId].length; j++) {
        var ei = nodeEdgeMap[nodeId][j];
        var e = edges[ei];
        var srcNode = nodeMap[e.source];
        var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
        edgeColors[ei*6] = c.r; edgeColors[ei*6+1] = c.g; edgeColors[ei*6+2] = c.b;
        edgeColors[ei*6+3] = c.r; edgeColors[ei*6+4] = c.g; edgeColors[ei*6+5] = c.b;
      }
    }
    edgeGeometry.attributes.color.needsUpdate = true;
  }

  // Export
  NGV.edgeGeometry = edgeGeometry;
  NGV.edgeBaseAlphas = edgeBaseAlphas;
  NGV.buildFiberTracts = buildFiberTracts;
  NGV.updateFiberTracts = updateFiberTracts;
  NGV.computeDefaultEdgeVisibility = computeDefaultEdgeVisibility;
  NGV.applyEdgeVisibility = applyEdgeVisibility;
  NGV.setRevealedNode = setRevealedNode;
  NGV.updateEdgePositions = updateEdgePositions;
  NGV.updateFlowParticles = updateFlowParticles;
  NGV.highlightEdges = highlightEdges;
  NGV.flowPoints = flowPoints;
})();
