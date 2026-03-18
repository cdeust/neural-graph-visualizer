// Neural Graph Visualizer — Lasso Selection Module
// Shift+drag = rectangle select, with highlight ring

(function() {
  var renderer = NGV.renderer;
  var camera = NGV.camera;
  var nodes = NGV.nodes;
  var nodeMeshes = NGV.nodeMeshes;

  var isSelecting = false;
  var startX = 0, startY = 0;
  var selectedNodeIds = new Set();

  // Selection rectangle overlay
  var selectRect = document.createElement('div');
  selectRect.id = 'lasso-rect';
  selectRect.style.cssText = 'position:fixed;border:1px solid rgba(0,210,255,0.5);' +
    'background:rgba(0,210,255,0.05);display:none;z-index:90;pointer-events:none;';
  document.body.appendChild(selectRect);

  // Selection info bar
  var selectionBar = document.createElement('div');
  selectionBar.id = 'selection-bar';
  selectionBar.style.cssText = 'position:fixed;bottom:50px;left:50%;transform:translateX(-50%);' +
    'z-index:200;background:rgba(3,5,8,0.9);backdrop-filter:blur(20px);' +
    'border:1px solid rgba(0,210,255,0.15);border-radius:6px;' +
    'padding:6px 14px;display:none;font-family:JetBrains Mono,monospace;' +
    'font-size:11px;color:#c8d6e5;gap:12px;align-items:center;';
  document.body.appendChild(selectionBar);

  function updateSelectionBar() {
    if (selectedNodeIds.size === 0) {
      selectionBar.style.display = 'none';
      return;
    }
    selectionBar.style.display = 'flex';
    selectionBar.innerHTML = '<span style="color:#00d2ff">' + selectedNodeIds.size + '</span> selected';

    var hideBtn = document.createElement('button');
    hideBtn.className = 'header-btn';
    hideBtn.textContent = 'Hide';
    hideBtn.addEventListener('click', function() {
      var ids = Array.from(selectedNodeIds);
      ids.forEach(function(id) {
        var node = NGV.nodeMap[id];
        if (node) { node.visible = false; var m = nodeMeshes[id]; if (m) m.visible = false; }
      });
      NGV.pushUndo({ type: 'hide', nodeIds: ids });
      clearSelection();
      NGV.updateStats();
    });
    selectionBar.appendChild(hideBtn);

    var focusBtn = document.createElement('button');
    focusBtn.className = 'header-btn';
    focusBtn.textContent = 'Focus';
    focusBtn.addEventListener('click', function() {
      // Hide everything except selected
      nodes.forEach(function(n) {
        if (!selectedNodeIds.has(n.id)) {
          n.visible = false;
          var m = nodeMeshes[n.id]; if (m) m.visible = false;
        }
      });
      NGV.updateStats();
    });
    selectionBar.appendChild(focusBtn);

    var clearBtn = document.createElement('button');
    clearBtn.className = 'header-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', clearSelection);
    selectionBar.appendChild(clearBtn);
  }

  function clearSelection() {
    selectedNodeIds.forEach(function(id) {
      var mesh = nodeMeshes[id];
      if (mesh && mesh.userData._selectionRing) {
        mesh.remove(mesh.userData._selectionRing);
        delete mesh.userData._selectionRing;
      }
    });
    selectedNodeIds.clear();
    updateSelectionBar();
  }

  function addToSelection(nodeId) {
    selectedNodeIds.add(nodeId);
    var mesh = nodeMeshes[nodeId];
    if (mesh && !mesh.userData._selectionRing) {
      var scale = mesh.userData.baseScale;
      var ringGeo = new THREE.TorusGeometry(scale * 1.8, 0.12, 8, 32);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d2ff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending,
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      mesh.add(ring);
      mesh.userData._selectionRing = ring;
    }
  }

  // Shift+mousedown starts selection
  renderer.domElement.addEventListener('mousedown', function(e) {
    if (!e.shiftKey) return;
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectRect.style.left = startX + 'px';
    selectRect.style.top = startY + 'px';
    selectRect.style.width = '0px';
    selectRect.style.height = '0px';
    selectRect.style.display = 'block';
    e.preventDefault();
  });

  window.addEventListener('mousemove', function(e) {
    if (!isSelecting) return;
    var x = Math.min(e.clientX, startX);
    var y = Math.min(e.clientY, startY);
    var w = Math.abs(e.clientX - startX);
    var h = Math.abs(e.clientY - startY);
    selectRect.style.left = x + 'px';
    selectRect.style.top = y + 'px';
    selectRect.style.width = w + 'px';
    selectRect.style.height = h + 'px';
  });

  window.addEventListener('mouseup', function(e) {
    if (!isSelecting) return;
    isSelecting = false;
    selectRect.style.display = 'none';

    var minX = Math.min(e.clientX, startX);
    var maxX = Math.max(e.clientX, startX);
    var minY = Math.min(e.clientY, startY);
    var maxY = Math.max(e.clientY, startY);

    // Find nodes within rectangle
    clearSelection();
    nodes.forEach(function(n) {
      if (!n.visible) return;
      var pos = new THREE.Vector3(n.x, n.y, n.z);
      pos.project(camera);
      var screenX = (pos.x + 1) / 2 * NGV.W;
      var screenY = (-pos.y + 1) / 2 * NGV.H;
      if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
        addToSelection(n.id);
      }
    });
    updateSelectionBar();
  });

  NGV.clearSelection = clearSelection;
  NGV.getSelectedNodeIds = function() { return selectedNodeIds; };
})();
