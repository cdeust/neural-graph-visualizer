// Neural Graph Visualizer — Main Orchestrator
// Wires modules together: init, event handling, animation loop
// Modules loaded via script tags: core/data, core/scene, visual/nodes, visual/edges,
// visual/effects, layout/force, layout/pathway, interaction/*, analytics/charts, modes/*

window.addEventListener('error', function(e) {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(255,0,0,0.9);color:#fff;padding:16px;z-index:9999;font:12px monospace;white-space:pre-wrap';
  d.textContent = 'ERROR: ' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || '');
  document.body.appendChild(d);
});

(function() {
  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZE LAYOUT
  // ═══════════════════════════════════════════════════════════════════

  NGV.applyPathwayLayout3D();

  // Set mesh positions immediately
  NGV.nodes.forEach(function(n) {
    var mesh = NGV.nodeMeshes[n.id];
    if (mesh) mesh.position.set(n.x, n.y, n.z);
  });

  // Build fiber tracts & edge visibility after initial layout
  NGV.buildFiberTracts();
  NGV.computeDefaultEdgeVisibility();

  // Save original node visual state for mode switching
  NGV.saveOriginalStyles();

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTION STATE
  // ═══════════════════════════════════════════════════════════════════

  var hoveredNode = null;
  var frame = 0;
  var lastInteraction = Date.now();

  // ═══════════════════════════════════════════════════════════════════
  // LAYOUT TOGGLE
  // ═══════════════════════════════════════════════════════════════════

  var layoutModes = ['cluster', 'pathway', 'cell', 'timeline'];
  var layoutLabels = { cluster: 'Cluster', timeline: 'Timeline', pathway: 'Pathway', cell: 'Cell' };
  var layoutMode = 'cluster';

  // Auto-add cell layout if biomedical data detected
  if (NGV.isBiomedicalData && !NGV.isBiomedicalData()) {
    // Remove cell from options if not biomedical
    layoutModes = ['cluster', 'pathway', 'timeline'];
  }

  function toggleLayout() {
    // Hide cell shells when leaving cell mode
    if (layoutMode === 'cell' && NGV.hideCellShells) NGV.hideCellShells();

    var idx = layoutModes.indexOf(layoutMode);
    layoutMode = layoutModes[(idx + 1) % layoutModes.length];
    var btn = document.getElementById('layout-toggle');
    btn.textContent = layoutLabels[layoutMode];
    btn.classList.toggle('active', layoutMode !== 'cluster');

    if (layoutMode === 'cell') {
      NGV.applyCellLayout();
      // Top-down camera for concentric ring view
      NGV.controls.target.set(0, 0, 0);
      NGV.camera.position.set(0, 500, 120);
      // Skip fiber tracts in cell mode — they clutter the clean rings
      return;
    } else if (layoutMode === 'timeline') {
      NGV.applyTimelineLayout3D();
    } else if (layoutMode === 'pathway') {
      NGV.applyPathwayLayout3D();
    } else {
      NGV.initPositions3D();
      NGV.runForceLayout3D(200);
    }
    // Rebuild fiber tracts after layout change
    NGV.buildFiberTracts();
    // Reframe camera
    if (NGV.resetModeCamera) NGV.resetModeCamera();
  }

  document.getElementById('layout-toggle').addEventListener('click', toggleLayout);

  // ═══════════════════════════════════════════════════════════════════
  // MOUSE EVENTS
  // ═══════════════════════════════════════════════════════════════════

  NGV.renderer.domElement.addEventListener('mousemove', function(e) {
    lastInteraction = Date.now();
    var node = NGV.getHoveredNode(e);
    hoveredNode = node;
    NGV.renderer.domElement.style.cursor = node ? 'pointer' : 'default';
    if (node) { NGV.showTooltip(node, e); NGV.highlightEdges(node.id); }
    else { NGV.hideTooltip(); NGV.highlightEdges(null); }
  });

  NGV.renderer.domElement.addEventListener('click', function(e) {
    lastInteraction = Date.now();
    var node = NGV.getHoveredNode(e);
    if (node) {
      NGV.openPanel(node);
      var target = new THREE.Vector3(node.x, node.y, node.z);
      NGV.controls.target.lerp(target, 0.5);
      NGV.setRevealedNode(node.id);
    } else {
      NGV.setRevealedNode(null);
    }
  });

  // Keyboard shortcuts handled by interaction/shortcuts.js
  // Expose toggleLayout for shortcuts module
  NGV.toggleLayout = toggleLayout;

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  function updateNodePositions() {
    var nodes = NGV.nodes;
    var nodeMeshes = NGV.nodeMeshes;
    var isHexShape = NGV.isHexShape;

    nodes.forEach(function(n) {
      var mesh = nodeMeshes[n.id];
      if (!mesh) return;
      var speed = 0.08;
      var dx = n.tx - n.x, dy = n.ty - n.y, dz = n.tz - n.z;
      if (dx*dx + dy*dy + dz*dz > 1) {
        n.x += dx * speed; n.y += dy * speed; n.z += dz * speed;
      } else {
        n.x = n.tx; n.y = n.ty; n.z = n.tz;
      }
      mesh.position.set(n.x, n.y, n.z);

      if (isHexShape(n)) {
        var core = mesh.userData.coreMesh;
        core.rotation.y += 0.003;
        var ring = mesh.getObjectByName('ring');
        if (ring) ring.rotation.z += 0.005;
      }

      var baseScale = mesh.userData.baseScale;
      var breathe = 1 + Math.sin(frame * 0.015 + n.x * 0.01) * 0.04;
      mesh.userData.coreMesh.scale.setScalar(baseScale * breathe);

      if (n.endedAt) {
        var age = (Date.now() - new Date(n.endedAt).getTime()) / 86400000;
        var alpha = Math.max(0.25, 1 - age / 90);
        mesh.userData.coreMesh.material.opacity = alpha * 0.9;
        mesh.children[1].material.opacity = alpha * 0.2;
      }

      if (n.status === 'archived') {
        mesh.userData.coreMesh.material.opacity *= 0.3;
        mesh.children[1].material.opacity *= 0.2;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════════

  function animate() {
    requestAnimationFrame(animate);
    frame++;

    NGV.gridMaterial.uniforms.uTime.value = frame * 0.016;

    var idleTime = Date.now() - lastInteraction;
    NGV.controls.autoRotate = idleTime > 4000;
    NGV.controls.update();

    updateNodePositions();
    NGV.updateEdgePositions();
    if (frame % 2 === 0) NGV.updateFlowParticles();
    if (frame % 3 === 0) NGV.updateDustParticles();
    if (frame % 5 === 0) NGV.updateFiberTracts();
    if (frame % 4 === 0 && NGV.updateSemanticZoom) NGV.updateSemanticZoom();
    if (frame % 10 === 0 && NGV.drawMinimap) NGV.drawMinimap();
    if (frame % 8 === 0 && NGV.updateLOD) NGV.updateLOD();
    NGV.updateGlassShell();

    if (hoveredNode) {
      NGV.highlightMesh.visible = true;
      NGV.highlightMesh.position.set(hoveredNode.x, hoveredNode.y, hoveredNode.z);
      var hs = NGV.nodeScale(hoveredNode) * 2;
      NGV.highlightMesh.scale.setScalar(hs);
      NGV.highlightMesh.rotation.x += 0.01;
      NGV.highlightMesh.rotation.y += 0.015;
    } else {
      NGV.highlightMesh.visible = false;
    }

    NGV.pointLight.position.x = Math.sin(frame * 0.003) * 200;
    NGV.pointLight.position.z = Math.cos(frame * 0.003) * 200;
    NGV.pointLight2.position.x = Math.cos(frame * 0.002) * 300;
    NGV.pointLight2.position.z = Math.sin(frame * 0.002) * 300;

    NGV.composer.render();
  }

  // ═══════════════════════════════════════════════════════════════════
  // POPULATE UI (config-driven)
  // ═══════════════════════════════════════════════════════════════════

  // Type filter buttons
  (function() {
    var bar = document.getElementById('type-filter-bar');
    var allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.dataset.type = 'all';
    allBtn.textContent = 'All';
    allBtn.style.setProperty('--type-color', NGV.accentColor);
    bar.appendChild(allBtn);

    for (var key in NGV.nodeTypeDefs) {
      var def = NGV.nodeTypeDefs[key];
      var btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.type = key;
      btn.textContent = def.label || key;
      btn.style.setProperty('--type-color', def.color);
      bar.appendChild(btn);
    }

    bar.addEventListener('click', function(e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      NGV.setActiveFilter(btn.dataset.type);
      NGV.applyFilters();
    });
  })();

  // Category buttons
  (function() {
    var bar = document.getElementById('category-bar');
    for (var cat in NGV.categoryColors) {
      if (cat === 'general') continue;
      var btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = cat;
      btn.style.setProperty('--cat-color', NGV.categoryColors[cat]);
      btn.textContent = cat;
      bar.appendChild(btn);
    }
  })();

  // Thread dropdown
  (function() {
    var sel = document.getElementById('thread-select');
    var threads = new Set();
    NGV.nodes.forEach(function(n) { if (n.threadId) threads.add(n.threadId); });
    Array.from(threads).sort().forEach(function(tid) {
      var opt = document.createElement('option');
      opt.value = tid; opt.textContent = tid;
      sel.appendChild(opt);
    });
  })();

  // Legend
  (function() {
    var legend = document.getElementById('legend');
    legend.innerHTML = '';
    for (var key in NGV.nodeTypeDefs) {
      var def = NGV.nodeTypeDefs[key];
      var item = document.createElement('div');
      item.className = 'legend-item';
      var dot = document.createElement('div');
      dot.className = def.shape === 'hex' ? 'legend-hex' : 'legend-dot';
      dot.style.background = def.color;
      dot.style.color = def.color;
      item.appendChild(dot);
      item.appendChild(document.createTextNode(def.label || key));
      legend.appendChild(item);
    }
  })();

  // Logo from config
  (function() {
    var logo = document.getElementById('logo-text');
    if (NGV.config.name) logo.textContent = NGV.config.name;
    logo.style.color = NGV.accentColor;
  })();

  // Accent color for dynamic elements
  (function() {
    var style = document.createElement('style');
    style.textContent = [
      '#header .logo { color: ' + NGV.accentColor + '; }',
      '#header .stats span { color: ' + NGV.accentColor + '; }',
      '.filter-btn.active { color: ' + NGV.accentColor + '; }',
      '.layout-toggle { color: ' + NGV.accentColor + '; }',
      '.analytics-toggle { color: ' + NGV.accentColor + '; }',
      '.analytics-title { color: ' + NGV.accentColor + '; }',
      '#panel .close-btn:hover { color: ' + NGV.accentColor + '; }',
    ].join('\n');
    document.head.appendChild(style);
  })();

  // ═══════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════

  // Apply detected mode
  var detectedMode = NGV.getMode();
  var modeSelector = document.getElementById('mode-selector');
  if (modeSelector) {
    modeSelector.value = detectedMode;
    modeSelector.addEventListener('change', function(e) {
      NGV.setMode(e.target.value);
    });
  }
  // Apply initial mode config after layout
  if (detectedMode !== 'generic') {
    NGV.applyModeConfig(detectedMode);
  }

  NGV.applyFilters();
  animate();

  // ═══════════════════════════════════════════════════════════════════
  // NON-TEMPORAL DATA DETECTION
  // ═══════════════════════════════════════════════════════════════════
  (function() {
    var nodes = NGV.nodes;
    var timestamps = nodes.map(function(n) { return new Date(n.modifiedAt || n.startedAt || 0).getTime(); })
      .filter(function(t) { return t > 0; });
    var range = timestamps.length > 1 ? Math.max.apply(null, timestamps) - Math.min.apply(null, timestamps) : 0;
    var hasTemporalData = range > 86400000;
    var hasThreads = nodes.some(function(n) { return !!n.threadId; });

    if (!hasTemporalData) {
      var layoutBtn = document.getElementById('layout-toggle');
      if (layoutBtn) {
        layoutBtn.style.display = '';
        layoutBtn.textContent = layoutLabels[layoutMode] || 'Pathway';
      }
      // Remove timeline but keep cell layout if biomedical data
      if (NGV.isBiomedicalData && NGV.isBiomedicalData()) {
        layoutModes = ['cluster', 'pathway', 'cell'];
      } else {
        layoutModes = ['cluster', 'pathway'];
      }

      var threadSelect = document.getElementById('thread-select');
      if (threadSelect) threadSelect.style.display = 'none';

      var statusBar = document.querySelector('.status-bar');
      if (statusBar) statusBar.style.display = 'none';

      var charts = document.querySelectorAll('#analytics-panel .analytics-card');
      charts.forEach(function(card) {
        var title = card.querySelector('.analytics-title');
        if (title && (title.textContent === 'Activity Heatmap' || title.textContent === 'Activity Over Time')) {
          card.style.display = 'none';
        }
      });

      var projects = {};
      nodes.forEach(function(n) { projects[n.project] = true; });
      if (Object.keys(projects).length <= 2) {
        var kpiProjects = document.querySelector('#kpi-projects');
        if (kpiProjects && kpiProjects.nextElementSibling) {
          kpiProjects.nextElementSibling.textContent = 'Groups';
        }
      }

      var origOpenPanel = NGV.openPanel;
      NGV.openPanel = function(n) {
        origOpenPanel(n);
        var metaEl = document.getElementById('panel-meta');
        if (metaEl && !n.startedAt) metaEl.style.display = 'none';
      };
    }

    if (!hasThreads) {
      var threadSelect = document.getElementById('thread-select');
      if (threadSelect) threadSelect.style.display = 'none';
    }
  })();
})();
