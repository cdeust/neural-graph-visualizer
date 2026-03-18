// Neural Graph Visualizer — Keyboard Shortcuts Module
// Extended keyboard shortcuts with help overlay and undo stack

(function() {
  // Undo stack (simple 20-action stack)
  var undoStack = [];
  var MAX_UNDO = 20;

  function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function popUndo() {
    if (undoStack.length === 0) return;
    var action = undoStack.pop();
    if (action.type === 'hide') {
      action.nodeIds.forEach(function(id) {
        var node = NGV.nodeMap[id];
        if (node) {
          node.visible = true;
          var mesh = NGV.nodeMeshes[id];
          if (mesh) mesh.visible = true;
        }
      });
      NGV.updateStats();
    }
  }

  // Help overlay
  var helpOverlay = document.createElement('div');
  helpOverlay.id = 'shortcuts-overlay';
  helpOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:500;' +
    'background:rgba(3,5,8,0.92);backdrop-filter:blur(20px);display:none;' +
    'justify-content:center;align-items:center;';
  var helpContent = document.createElement('div');
  helpContent.style.cssText = 'max-width:500px;padding:30px;color:#c8d6e5;' +
    'font-family:JetBrains Mono,monospace;font-size:12px;line-height:2;';
  helpContent.innerHTML =
    '<div style="font-size:14px;font-weight:600;margin-bottom:16px;color:#fff">Keyboard Shortcuts</div>' +
    '<div style="display:grid;grid-template-columns:60px 1fr;gap:4px 16px;">' +
    '<span style="color:#00d2ff">?</span><span>Toggle this help</span>' +
    '<span style="color:#00d2ff">F</span><span>Focus selected node</span>' +
    '<span style="color:#00d2ff">H</span><span>Hide selected node</span>' +
    '<span style="color:#00d2ff">L</span><span>Toggle labels</span>' +
    '<span style="color:#00d2ff">R</span><span>Reset camera view</span>' +
    '<span style="color:#00d2ff">E</span><span>Expand neighbor edges</span>' +
    '<span style="color:#00d2ff">G</span><span>Toggle glass shell</span>' +
    '<span style="color:#00d2ff">T</span><span>Cycle layout mode</span>' +
    '<span style="color:#00d2ff">A</span><span>Toggle analytics</span>' +
    '<span style="color:#00d2ff">S</span><span>Screenshot (PNG)</span>' +
    '<span style="color:#00d2ff">/</span><span>Focus search box</span>' +
    '<span style="color:#00d2ff">1-5</span><span>Switch layout preset</span>' +
    '<span style="color:#00d2ff">Ctrl+Z</span><span>Undo last action</span>' +
    '<span style="color:#00d2ff">Esc</span><span>Close panels / deselect</span>' +
    '</div>' +
    '<div style="margin-top:16px;color:#3a5a7a;font-size:10px">Press any key to close</div>';
  helpOverlay.appendChild(helpContent);
  document.body.appendChild(helpOverlay);

  var helpVisible = false;
  function toggleHelp() {
    helpVisible = !helpVisible;
    helpOverlay.style.display = helpVisible ? 'flex' : 'none';
  }

  // Layout presets for 1-5 keys
  var layoutPresets = {
    '1': 'cluster',
    '2': 'pathway',
    '3': 'timeline',
  };

  // Extended keyboard handler (replaces the one in main.js)
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (helpVisible) {
      toggleHelp();
      return;
    }

    var selected = NGV.getSelectedNode ? NGV.getSelectedNode() : null;

    switch(e.key.toLowerCase()) {
      case '?':
        toggleHelp();
        break;
      case 't':
        if (NGV.toggleLayout) NGV.toggleLayout();
        break;
      case 'a':
        if (NGV.toggleAnalytics) NGV.toggleAnalytics();
        break;
      case 'g':
        if (NGV.toggleGlassShell) NGV.toggleGlassShell();
        break;
      case 'escape':
        NGV.closePanel();
        NGV.closeAnalytics();
        NGV.setRevealedNode(null);
        if (NGV.clearSelection) NGV.clearSelection();
        break;
      case 'f':
        if (selected) {
          var target = new THREE.Vector3(selected.x, selected.y, selected.z);
          NGV.controls.target.copy(target);
          NGV.camera.position.set(selected.x, selected.y + 50, selected.z + 100);
        }
        break;
      case 'h':
        if (selected) {
          selected.visible = false;
          var mesh = NGV.nodeMeshes[selected.id];
          if (mesh) mesh.visible = false;
          pushUndo({ type: 'hide', nodeIds: [selected.id] });
          NGV.closePanel();
          NGV.updateStats();
        }
        break;
      case 'l':
        if (NGV.toggleLabels) NGV.toggleLabels();
        break;
      case 'r':
        NGV.controls.target.set(0, 0, 0);
        NGV.camera.position.set(0, 150 * NGV.graphScale, 500 * NGV.graphScale);
        break;
      case 'e':
        if (selected) NGV.setRevealedNode(selected.id);
        break;
      case 's':
        if (!e.ctrlKey && !e.metaKey) NGV.exportScreenshot();
        break;
      case '/':
        e.preventDefault();
        document.getElementById('search-box').focus();
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          popUndo();
        }
        break;
    }
  });

  NGV.pushUndo = pushUndo;
  NGV.toggleHelp = toggleHelp;
})();
