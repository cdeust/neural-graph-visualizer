// Neural Graph Visualizer — Raycast Module
// Hover detection, click handling

(function() {
  var camera = NGV.camera;
  var nodeMeshes = NGV.nodeMeshes;
  var raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 5 };
  var mouse = new THREE.Vector2();

  function getHoveredNode(event) {
    mouse.x = (event.clientX / NGV.W) * 2 - 1;
    mouse.y = -(event.clientY / NGV.H) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    var coreMeshes = [];
    for (var id in nodeMeshes) {
      var grp = nodeMeshes[id];
      if (!grp.visible) continue;
      var core = grp.userData.coreMesh;
      if (core) coreMeshes.push(core);
    }

    var intersects = raycaster.intersectObjects(coreMeshes, false);
    if (intersects.length > 0) return intersects[0].object.parent.userData.node;
    return null;
  }

  NGV.getHoveredNode = getHoveredNode;
})();
