// Neural Graph Visualizer — Force Layout Module
// 3D force-directed layout and timeline layout

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;
  var nodeMap = NGV.nodeMap;
  var graphScale = NGV.graphScale;

  function initPositions3D() {
    var projects = {};
    nodes.forEach(function(n) {
      if (!projects[n.project]) projects[n.project] = [];
      projects[n.project].push(n);
    });
    var projKeys = Object.keys(projects);
    var baseR = 150;

    projKeys.forEach(function(proj, pi) {
      var phi = (pi / projKeys.length) * Math.PI * 2;
      var theta = (pi / projKeys.length) * Math.PI * 0.6 + Math.PI * 0.2;
      var cx = Math.cos(phi) * Math.sin(theta) * baseR;
      var cy = (Math.cos(theta) - 0.5) * baseR * 0.3;
      var cz = Math.sin(phi) * Math.sin(theta) * baseR;
      var group = projects[proj];
      var spread = Math.sqrt(group.length) * 6;

      group.forEach(function(n, ni) {
        var a = (ni / group.length) * Math.PI * 2;
        var r = spread * (0.3 + Math.random() * 0.7);
        var elev = (Math.random() - 0.5) * spread * 0.5;
        n.x = cx + Math.cos(a) * r;
        n.y = cy + elev;
        n.z = cz + Math.sin(a) * r;
        n.tx = n.x; n.ty = n.y; n.tz = n.z;
      });
    });
  }

  function runForceLayout3D(iterations) {
    var N = nodes.length;
    if (N === 0) return;
    var targetRadius = 300;
    var k = targetRadius / Math.pow(N, 1/3) * 1.5;
    var repStr = 0.08;

    var strongEdges = edges.filter(function(e) {
      if (e.edgeType === 'conv-conv') return e.weight >= 0.35;
      return e.weight >= 0.2;
    });

    for (var iter = 0; iter < iterations; iter++) {
      var temp = 1 - iter / iterations;
      var cooling = temp * 3;

      for (var i = 0; i < N; i++) { nodes[i].vx = 0; nodes[i].vy = 0; nodes[i].vz = 0; }

      var cellSize = k * 2;
      var grid = {};
      for (var gi = 0; gi < N; gi++) {
        var n = nodes[gi];
        var gkey = Math.floor(n.x/cellSize)+','+Math.floor(n.y/cellSize)+','+Math.floor(n.z/cellSize);
        if (!grid[gkey]) grid[gkey] = [];
        grid[gkey].push(n);
      }
      for (var ri = 0; ri < N; ri++) {
        var rn = nodes[ri];
        var gx = Math.floor(rn.x/cellSize), gy = Math.floor(rn.y/cellSize), gz = Math.floor(rn.z/cellSize);
        for (var dx = -1; dx <= 1; dx++) {
          for (var dy = -1; dy <= 1; dy++) {
            for (var dz = -1; dz <= 1; dz++) {
              var cell = grid[(gx+dx)+','+(gy+dy)+','+(gz+dz)];
              if (!cell) continue;
              for (var ci = 0; ci < cell.length; ci++) {
                var o = cell[ci];
                if (o === rn) continue;
                var ddx = rn.x - o.x, ddy = rn.y - o.y, ddz = rn.z - o.z;
                var dist = Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz) || 1;
                if (dist > k * 4) continue;
                var force = (k * k) / dist;
                rn.vx += (ddx/dist) * force * repStr;
                rn.vy += (ddy/dist) * force * repStr;
                rn.vz += (ddz/dist) * force * repStr;
              }
            }
          }
        }
      }

      var springK = 0.01;
      for (var si = 0; si < strongEdges.length; si++) {
        var se = strongEdges[si];
        var sa = nodeMap[se.source], sb = nodeMap[se.target];
        if (!sa || !sb) continue;
        var sdx = sb.x - sa.x, sdy = sb.y - sa.y, sdz = sb.z - sa.z;
        var sdist = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz) || 1;
        var sforce = (sdist - k * 0.5) * springK * se.weight;
        var fx = (sdx/sdist)*sforce, fy = (sdy/sdist)*sforce, fz = (sdz/sdist)*sforce;
        sa.vx += fx; sa.vy += fy; sa.vz += fz;
        sb.vx -= fx; sb.vy -= fy; sb.vz -= fz;
      }

      for (var ui = 0; ui < N; ui++) {
        var un = nodes[ui];
        un.vx -= un.x * 0.003; un.vy -= un.y * 0.003; un.vz -= un.z * 0.003;
        un.x += un.vx * cooling; un.y += un.vy * cooling; un.z += un.vz * cooling;
        un.x = Math.max(-400 * graphScale, Math.min(400 * graphScale, un.x));
        un.y = Math.max(-250 * graphScale, Math.min(250 * graphScale, un.y));
        un.z = Math.max(-400 * graphScale, Math.min(400 * graphScale, un.z));
      }
    }

    nodes.forEach(function(n) { n.tx = n.x; n.ty = n.y; n.tz = n.z; });
  }

  function applyTimelineLayout3D() {
    var projects = {};
    var minTime = Infinity, maxTime = -Infinity;
    nodes.forEach(function(n) {
      if (!n.visible) return;
      if (!projects[n.project]) projects[n.project] = [];
      projects[n.project].push(n);
      var ts = n.startedAt || n.modifiedAt;
      if (ts) {
        var t = new Date(ts).getTime();
        if (t < minTime) minTime = t;
        if (t > maxTime) maxTime = t;
      }
    });

    var projKeys = Object.keys(projects).sort();
    var width = 800;
    var timeRange = maxTime - minTime || 1;

    projKeys.forEach(function(proj, pi) {
      var bandZ = (pi - projKeys.length / 2) * 50;
      projects[proj].forEach(function(n) {
        var ts = n.startedAt || n.modifiedAt;
        var t = ts ? new Date(ts).getTime() : (minTime + maxTime) / 2;
        n.tx = ((t - minTime) / timeRange - 0.5) * width;
        n.ty = (Math.random() - 0.5) * 20;
        n.tz = bandZ + (Math.random() - 0.5) * 25;
      });
    });
  }

  // Export
  NGV.initPositions3D = initPositions3D;
  NGV.runForceLayout3D = runForceLayout3D;
  NGV.applyTimelineLayout3D = applyTimelineLayout3D;
})();
