// Neural Graph Visualizer — Pathway Layout Module
// Cascade, pipeline, radial, auto-detect layouts

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;
  var nodeMap = NGV.nodeMap;
  var ngvConfig = NGV.config;

  var FLOW_EDGE_TYPES = ['activation', 'production', 'differentiation', 'proceeds_to', 'validates',
    'recruitment', 'amplification', 'transcription', 'intracellular_signaling', 'causes'];
  var INHIBIT_EDGE_TYPES = ['inhibition'];
  var PROXIMITY_EDGE_TYPES = ['binding', 'expression', 'synergy', 'measured_by', 'relates_to', 'participates_in'];

  function detectLayoutStrategy(edges) {
    var typed = edges.filter(function(e) { return !!e.edgeType; });
    if (!typed.length) return 'force';
    var flowCount = 0, pipelineCount = 0;
    for (var i = 0; i < typed.length; i++) {
      var et = typed[i].edgeType;
      if (FLOW_EDGE_TYPES.indexOf(et) >= 0) flowCount++;
      if (et === 'proceeds_to') pipelineCount++;
    }
    var flowRatio = flowCount / typed.length;
    if (pipelineCount > 0 && pipelineCount >= typed.length * 0.15) return 'pipeline';
    if (flowRatio > 0.4) return 'cascade';
    return 'force';
  }

  function computeTopologicalRanks() {
    var adj = {};
    var inDeg = {};
    var outDeg = {};
    var inhibitTargets = {};
    var flowEdges = [];

    nodes.forEach(function(n) {
      adj[n.id] = [];
      inDeg[n.id] = 0;
      outDeg[n.id] = 0;
    });

    edges.forEach(function(e) {
      var et = e.edgeType || '';
      if (!et) return;
      if (FLOW_EDGE_TYPES.indexOf(et) >= 0) {
        if (adj[e.source]) adj[e.source].push(e.target);
        inDeg[e.target] = (inDeg[e.target] || 0) + 1;
        outDeg[e.source] = (outDeg[e.source] || 0) + 1;
        flowEdges.push(e);
      }
      if (INHIBIT_EDGE_TYPES.indexOf(et) >= 0) {
        if (!inhibitTargets[e.source]) inhibitTargets[e.source] = [];
        inhibitTargets[e.source].push(e.target);
      }
    });

    var roots = [];
    nodes.forEach(function(n) {
      if ((inDeg[n.id] || 0) === 0 && (outDeg[n.id] || 0) > 0) roots.push(n.id);
    });

    // Pass 1: BFS shortest path
    var prelim = {};
    var bfsQueue = [];
    roots.forEach(function(id) { prelim[id] = 0; bfsQueue.push(id); });
    while (bfsQueue.length > 0) {
      var current = bfsQueue.shift();
      var neighbors = adj[current] || [];
      for (var i = 0; i < neighbors.length; i++) {
        var next = neighbors[i];
        if (prelim[next] === undefined) {
          prelim[next] = prelim[current] + 1;
          bfsQueue.push(next);
        }
      }
    }

    // Pass 2: DAG longest path
    var dagAdj = {};
    nodes.forEach(function(n) { dagAdj[n.id] = []; });
    for (var fi = 0; fi < flowEdges.length; fi++) {
      var fe = flowEdges[fi];
      var srcRank = prelim[fe.source];
      var tgtRank = prelim[fe.target];
      if (srcRank !== undefined && tgtRank !== undefined && srcRank < tgtRank) {
        dagAdj[fe.source].push(fe.target);
      } else if (srcRank === undefined || tgtRank === undefined) {
        dagAdj[fe.source].push(fe.target);
      }
    }

    var rank = {};
    var queue = [];
    roots.forEach(function(id) { rank[id] = 0; queue.push(id); });
    var maxIter = nodes.length * nodes.length;
    var iterations = 0;
    while (queue.length > 0 && iterations < maxIter) {
      var current = queue.shift();
      var neighbors = dagAdj[current] || [];
      for (var i = 0; i < neighbors.length; i++) {
        var next = neighbors[i];
        var newRank = (rank[current] || 0) + 1;
        if (rank[next] === undefined || newRank > rank[next]) {
          rank[next] = newRank;
          queue.push(next);
        }
      }
      iterations++;
    }

    // Drug/inhibitor nodes
    for (var drugId in inhibitTargets) {
      if (rank[drugId] !== undefined) continue;
      var targets = inhibitTargets[drugId];
      var targetRanks = targets.map(function(t) { return rank[t]; }).filter(function(r) { return r !== undefined; });
      if (targetRanks.length > 0) {
        rank[drugId] = Math.round(targetRanks.reduce(function(a,b) { return a+b; }, 0) / targetRanks.length);
      }
    }

    // Orphans
    var assigned = [];
    for (var id in rank) { if (rank[id] !== undefined) assigned.push(rank[id]); }
    assigned.sort(function(a,b) { return a-b; });
    var medianRank = assigned.length > 0 ? assigned[Math.floor(assigned.length/2)] : 0;
    nodes.forEach(function(n) {
      if (rank[n.id] === undefined) rank[n.id] = medianRank;
    });

    // Node-level rank override
    nodes.forEach(function(n) {
      if (n.rank !== undefined && n.rank !== null) rank[n.id] = n.rank;
    });

    return { rank: rank, inhibitTargets: inhibitTargets };
  }

  function applyCascadeLayout3D(rankData) {
    var rank = rankData.rank;
    var inhibitTargets = rankData.inhibitTargets;
    var maxRank = 0;
    for (var id in rank) { if (rank[id] > maxRank) maxRank = rank[id]; }
    if (maxRank === 0) maxRank = 1;

    var layers = {};
    nodes.forEach(function(n) {
      var r = rank[n.id] || 0;
      if (!layers[r]) layers[r] = [];
      layers[r].push(n);
    });

    var layerGap = Math.min(80, 500 / maxRank);
    var totalHeight = maxRank * layerGap;

    for (var r in layers) {
      var layer = layers[r];
      var y = (totalHeight / 2) - r * layerGap;
      var flowNodes = [];
      var drugNodes = [];
      layer.forEach(function(n) {
        if (inhibitTargets[n.id]) drugNodes.push(n);
        else flowNodes.push(n);
      });

      var radius = flowNodes.length <= 1 ? 0 : Math.max(25, flowNodes.length * 18);
      flowNodes.forEach(function(n, i) {
        if (flowNodes.length === 1) {
          n.tx = 0; n.ty = y; n.tz = 0;
        } else {
          var angle = (i / flowNodes.length) * Math.PI * 2;
          n.tx = Math.cos(angle) * radius;
          n.ty = y;
          n.tz = Math.sin(angle) * radius;
        }
      });

      drugNodes.forEach(function(n) {
        n.ty = y;
        n._pendingDrug = true;
      });
    }

    nodes.forEach(function(n, ni) {
      if (!n._pendingDrug) return;
      delete n._pendingDrug;
      var targets = inhibitTargets[n.id] || [];
      var avgX = 0, avgZ = 0, tCount = 0;
      targets.forEach(function(tid) {
        var tn = nodeMap[tid];
        if (tn) { avgX += tn.tx; avgZ += tn.tz; tCount++; }
      });
      if (tCount > 0) {
        avgX /= tCount; avgZ /= tCount;
        var baseAngle = Math.atan2(avgZ, avgX);
        var offsetAngle = baseAngle + Math.PI * 0.5 + (ni * 0.6);
        var offsetDist = 45 + (ni % 4) * 18;
        n.tx = avgX + Math.cos(offsetAngle) * offsetDist;
        n.tz = avgZ + Math.sin(offsetAngle) * offsetDist;
      } else {
        n.tx = (Math.random() - 0.5) * 80;
        n.tz = (Math.random() - 0.5) * 80;
      }
    });
  }

  function applyPipelineLayout3D(rankData) {
    var rank = rankData.rank;
    var inhibitTargets = rankData.inhibitTargets;
    var maxRank = 0;
    for (var id in rank) { if (rank[id] > maxRank) maxRank = rank[id]; }
    if (maxRank === 0) maxRank = 1;

    var layers = {};
    nodes.forEach(function(n) {
      var r = rank[n.id] || 0;
      if (!layers[r]) layers[r] = [];
      layers[r].push(n);
    });

    var xSpan = 600;
    var yzSpread = 60;

    for (var r in layers) {
      var layer = layers[r];
      var x = (r - maxRank / 2) * (xSpan / maxRank);
      var flowNodes = [];
      var drugNodes = [];
      layer.forEach(function(n) {
        if (inhibitTargets[n.id]) drugNodes.push(n);
        else flowNodes.push(n);
      });

      flowNodes.forEach(function(n, i) {
        var offset = (i - (flowNodes.length - 1) / 2) * yzSpread;
        n.tx = x;
        n.ty = offset * 0.5;
        n.tz = offset;
      });

      drugNodes.forEach(function(n, i) {
        var targets = inhibitTargets[n.id] || [];
        var avgY = 0, avgZ = 0, tCount = 0;
        targets.forEach(function(tid) {
          var tn = nodeMap[tid];
          if (tn && tn.tx !== undefined) {
            avgY += tn.ty; avgZ += tn.tz; tCount++;
          }
        });
        if (tCount > 0) {
          n.tx = x;
          n.ty = avgY / tCount + 30 + i * 20;
          n.tz = avgZ / tCount + 30;
        } else {
          n.tx = x;
          n.ty = (flowNodes.length + i) * yzSpread * 0.5;
          n.tz = (flowNodes.length + i) * yzSpread;
        }
      });
    }
  }

  function applyRadialLayout3D(rankData) {
    var rank = rankData.rank;
    var maxRank = 0;
    for (var id in rank) { if (rank[id] > maxRank) maxRank = rank[id]; }
    if (maxRank === 0) maxRank = 1;

    var layers = {};
    nodes.forEach(function(n) {
      var r = rank[n.id] || 0;
      if (!layers[r]) layers[r] = [];
      layers[r].push(n);
    });

    var ringSpacing = 80;
    for (var r in layers) {
      var layer = layers[r];
      var ringRadius = r * ringSpacing + 30;
      layer.forEach(function(n, i) {
        var angle = (i / layer.length) * Math.PI * 2;
        var yJitter = (Math.random() - 0.5) * 30;
        n.tx = Math.cos(angle) * ringRadius;
        n.ty = yJitter;
        n.tz = Math.sin(angle) * ringRadius;
      });
    }
  }

  function runConstrainedSettling(iterations) {
    var N = nodes.length;
    if (N === 0) return;
    var k = 40;
    for (var iter = 0; iter < iterations; iter++) {
      var temp = 1 - iter / iterations;
      var cooling = temp * 2;
      for (var i = 0; i < N; i++) { nodes[i].vx = 0; nodes[i].vy = 0; nodes[i].vz = 0; }
      for (var i = 0; i < N; i++) {
        for (var j = i + 1; j < N; j++) {
          var dx = nodes[i].tx - nodes[j].tx;
          var dz = nodes[i].tz - nodes[j].tz;
          var dist = Math.sqrt(dx*dx + dz*dz) || 1;
          if (dist > k * 4) continue;
          var force = (k * k) / dist * 0.05;
          var fx = (dx/dist) * force, fz = (dz/dist) * force;
          nodes[i].vx += fx; nodes[i].vz += fz;
          nodes[j].vx -= fx; nodes[j].vz -= fz;
        }
      }
      for (var i = 0; i < N; i++) {
        nodes[i].tx += nodes[i].vx * cooling;
        nodes[i].tz += nodes[i].vz * cooling;
        nodes[i].ty += nodes[i].vy * cooling * 0.05;
      }
    }
  }

  function applyPathwayLayout3D() {
    var layoutConfig = ngvConfig.layout || {};
    var strategy = layoutConfig.strategy || 'auto';

    if (strategy === 'auto') {
      strategy = detectLayoutStrategy(edges);
    }

    if (strategy === 'force') {
      NGV.initPositions3D();
      NGV.runForceLayout3D(200);
      return;
    }

    var rankData = computeTopologicalRanks();

    if (strategy === 'cascade') {
      applyCascadeLayout3D(rankData);
    } else if (strategy === 'pipeline') {
      applyPipelineLayout3D(rankData);
    } else if (strategy === 'radial') {
      applyRadialLayout3D(rankData);
    } else {
      NGV.initPositions3D();
      NGV.runForceLayout3D(200);
      return;
    }

    runConstrainedSettling(20);
    nodes.forEach(function(n) { n.x = n.tx; n.y = n.ty; n.z = n.tz; });
  }

  // Export
  NGV.FLOW_EDGE_TYPES = FLOW_EDGE_TYPES;
  NGV.INHIBIT_EDGE_TYPES = INHIBIT_EDGE_TYPES;
  NGV.PROXIMITY_EDGE_TYPES = PROXIMITY_EDGE_TYPES;
  NGV.detectLayoutStrategy = detectLayoutStrategy;
  NGV.applyPathwayLayout3D = applyPathwayLayout3D;
})();
