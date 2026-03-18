// Neural Graph Visualizer — Minimap Module
// 200x150 orthographic top-down minimap

(function() {
  var nodes = NGV.nodes;
  var camera = NGV.camera;
  var controls = NGV.controls;

  var canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  canvas.width = 200;
  canvas.height = 150;
  canvas.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:100;' +
    'background:rgba(3,5,8,0.8);border:1px solid rgba(0,210,255,0.1);border-radius:6px;' +
    'cursor:pointer;backdrop-filter:blur(12px);';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  function drawMinimap() {
    ctx.clearRect(0, 0, 200, 150);

    // Find bounds
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    var visNodes = [];
    nodes.forEach(function(n) {
      if (!n.visible) return;
      visNodes.push(n);
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    });

    if (visNodes.length === 0) return;

    var pad = 20;
    var rangeX = (maxX - minX) || 1;
    var rangeZ = (maxZ - minZ) || 1;
    var scaleX = (200 - pad * 2) / rangeX;
    var scaleZ = (150 - pad * 2) / rangeZ;
    var scale = Math.min(scaleX, scaleZ);

    var offsetX = (200 - rangeX * scale) / 2;
    var offsetZ = (150 - rangeZ * scale) / 2;

    // Draw nodes
    visNodes.forEach(function(n) {
      var x = (n.x - minX) * scale + offsetX;
      var z = (n.z - minZ) * scale + offsetZ;
      var color = NGV.TYPE_COLORS_RGB[n.type] || NGV.TYPE_COLORS_RGB.unknown;
      ctx.fillStyle = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x, z, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw camera viewport rectangle
    var camX = (camera.position.x - minX) * scale + offsetX;
    var camZ = (camera.position.z - minZ) * scale + offsetZ;
    var viewSize = Math.min(40, 200 / (camera.position.distanceTo(controls.target) / 200 + 1));

    ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX - viewSize/2, camZ - viewSize/2, viewSize, viewSize);

    // Center dot
    ctx.fillStyle = 'rgba(0, 210, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(camX, camZ, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Click to navigate
  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var mz = e.clientY - rect.top;

    // Convert minimap coords to world coords
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    nodes.forEach(function(n) {
      if (!n.visible) return;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    });

    var rangeX = (maxX - minX) || 1;
    var rangeZ = (maxZ - minZ) || 1;
    var scaleX = 160 / rangeX;
    var scaleZ = 110 / rangeZ;
    var scale = Math.min(scaleX, scaleZ);
    var offsetX = (200 - rangeX * scale) / 2;
    var offsetZ = (150 - rangeZ * scale) / 2;

    var worldX = (mx - offsetX) / scale + minX;
    var worldZ = (mz - offsetZ) / scale + minZ;

    controls.target.set(worldX, 0, worldZ);
    camera.position.set(worldX, camera.position.y, worldZ + camera.position.distanceTo(controls.target) * 0.8);
  });

  NGV.drawMinimap = drawMinimap;
})();
