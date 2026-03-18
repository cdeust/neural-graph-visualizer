// Neural Graph Visualizer — Context Menu Module
// Right-click context menu with node/empty actions

(function() {
  var menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.style.cssText = 'position:fixed;display:none;z-index:300;' +
    'background:rgba(3,5,8,0.92);backdrop-filter:blur(20px);' +
    'border:1px solid rgba(0,210,255,0.15);border-radius:6px;' +
    'padding:4px 0;min-width:180px;box-shadow:0 8px 30px rgba(0,0,0,0.5);' +
    'font-family:JetBrains Mono,monospace;font-size:11px;color:#c8d6e5;';
  document.body.appendChild(menu);

  var contextNode = null;

  function createMenuItem(label, callback, shortcut) {
    var item = document.createElement('div');
    item.style.cssText = 'padding:6px 14px;cursor:pointer;display:flex;justify-content:space-between;' +
      'align-items:center;transition:background 0.15s;';
    var labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    item.appendChild(labelSpan);
    if (shortcut) {
      var sc = document.createElement('span');
      sc.textContent = shortcut;
      sc.style.cssText = 'color:#3a5a7a;font-size:9px;margin-left:20px;';
      item.appendChild(sc);
    }
    item.addEventListener('mouseenter', function() { item.style.background = 'rgba(0,210,255,0.08)'; });
    item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      hideContextMenu();
      callback();
    });
    return item;
  }

  function createSeparator() {
    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(0,210,255,0.08);margin:4px 0;';
    return sep;
  }

  function showContextMenu(e, node) {
    e.preventDefault();
    contextNode = node;
    menu.innerHTML = '';

    if (node) {
      menu.appendChild(createMenuItem('Focus on node', function() {
        var target = new THREE.Vector3(node.x, node.y, node.z);
        NGV.controls.target.copy(target);
        NGV.camera.position.set(node.x, node.y + 50, node.z + 100);
      }, 'F'));

      menu.appendChild(createMenuItem('Expand neighbors', function() {
        NGV.setRevealedNode(node.id);
      }, 'E'));

      menu.appendChild(createMenuItem('Hide node', function() {
        node.visible = false;
        var mesh = NGV.nodeMeshes[node.id];
        if (mesh) mesh.visible = false;
        NGV.updateStats();
      }, 'H'));

      menu.appendChild(createMenuItem('Copy name', function() {
        navigator.clipboard.writeText(node.name).catch(function() {});
      }));

      menu.appendChild(createSeparator());

      menu.appendChild(createMenuItem('View details', function() {
        NGV.openPanel(node);
      }));
    } else {
      menu.appendChild(createMenuItem('Reset view', function() {
        NGV.controls.target.set(0, 0, 0);
        NGV.camera.position.set(0, 150 * NGV.graphScale, 500 * NGV.graphScale);
      }, 'R'));

      menu.appendChild(createMenuItem('Show all nodes', function() {
        NGV.nodes.forEach(function(n) {
          n.visible = true;
          var mesh = NGV.nodeMeshes[n.id];
          if (mesh) mesh.visible = true;
        });
        NGV.applyFilters();
      }));

      menu.appendChild(createMenuItem('Toggle labels', function() {
        NGV.toggleLabels();
      }, 'L'));

      menu.appendChild(createSeparator());

      menu.appendChild(createMenuItem('Screenshot', function() {
        NGV.exportScreenshot();
      }, 'S'));
    }

    // Position menu
    var x = Math.min(e.clientX, window.innerWidth - 200);
    var y = Math.min(e.clientY, window.innerHeight - menu.children.length * 32);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
  }

  function hideContextMenu() {
    menu.style.display = 'none';
    contextNode = null;
  }

  // Right-click handler
  NGV.renderer.domElement.addEventListener('contextmenu', function(e) {
    var node = NGV.getHoveredNode(e);
    showContextMenu(e, node);
  });

  // Hide on click elsewhere
  document.addEventListener('click', function() { hideContextMenu(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hideContextMenu();
  });

  NGV.showContextMenu = showContextMenu;
  NGV.hideContextMenu = hideContextMenu;
})();
