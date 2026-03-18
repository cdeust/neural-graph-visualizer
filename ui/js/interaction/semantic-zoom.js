// Neural Graph Visualizer — Semantic Zoom Module
// Far: dots only. Mid: shapes. Close: labels as sprites.

(function() {
  var nodes = NGV.nodes;
  var nodeMeshes = NGV.nodeMeshes;
  var camera = NGV.camera;
  var scene = NGV.scene;

  // Zoom thresholds
  var FAR_THRESHOLD = 800;
  var CLOSE_THRESHOLD = 200;

  // Label sprites (created on demand for close zoom)
  var labelSprites = {};
  var labelsVisible = false;

  function createLabelSprite(node) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var text = node.name || node.id;
    var fontSize = 24;
    ctx.font = fontSize + 'px JetBrains Mono';
    var metrics = ctx.measureText(text);
    var width = metrics.width + 16;
    var height = fontSize + 12;
    canvas.width = width; canvas.height = height;
    ctx.font = fontSize + 'px JetBrains Mono';
    ctx.fillStyle = 'rgba(3, 5, 8, 0.7)';
    ctx.roundRect(0, 0, width, height, 4);
    ctx.fill();
    ctx.fillStyle = '#c8d6e5';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 8, height / 2);

    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    var material = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false, depthTest: false,
    });
    var sprite = new THREE.Sprite(material);
    sprite.scale.set(width / 8, height / 8, 1);
    sprite.position.set(0, NGV.nodeScale(node) + 3, 0);
    sprite.visible = false;
    return sprite;
  }

  function updateSemanticZoom() {
    var camPos = camera.position;
    var target = NGV.controls.target;
    var dist = camPos.distanceTo(target);

    nodes.forEach(function(n) {
      var mesh = nodeMeshes[n.id];
      if (!mesh || !mesh.visible) return;

      if (dist > FAR_THRESHOLD) {
        // Far: just dots (hide halos, smaller scale)
        var core = mesh.userData.coreMesh;
        if (core) core.scale.setScalar(mesh.userData.baseScale * 0.6);
        if (mesh.children[1]) mesh.children[1].visible = false; // halo
        var ring = mesh.getObjectByName('ring');
        if (ring) ring.visible = false;
      } else if (dist > CLOSE_THRESHOLD) {
        // Mid: normal rendering
        if (mesh.children[1]) mesh.children[1].visible = true;
        var ring = mesh.getObjectByName('ring');
        if (ring) ring.visible = true;
      } else {
        // Close: show labels
        if (mesh.children[1]) mesh.children[1].visible = true;
        var ring = mesh.getObjectByName('ring');
        if (ring) ring.visible = true;
      }

      // Label management
      if (dist < CLOSE_THRESHOLD && labelsVisible) {
        if (!labelSprites[n.id]) {
          labelSprites[n.id] = createLabelSprite(n);
          mesh.add(labelSprites[n.id]);
        }
        labelSprites[n.id].visible = true;
      } else if (labelSprites[n.id]) {
        labelSprites[n.id].visible = false;
      }
    });
  }

  function toggleLabels() {
    labelsVisible = !labelsVisible;
    if (!labelsVisible) {
      for (var id in labelSprites) {
        if (labelSprites[id]) labelSprites[id].visible = false;
      }
    }
  }

  NGV.updateSemanticZoom = updateSemanticZoom;
  NGV.toggleLabels = toggleLabels;
  NGV.isLabelsVisible = function() { return labelsVisible; };
})();
