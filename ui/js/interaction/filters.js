// Neural Graph Visualizer — Filters Module
// Search, type, category, thread, status, chart filters

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;
  var nodeMap = NGV.nodeMap;
  var nodeTypeDefs = NGV.nodeTypeDefs;
  var cleanProjectPath = NGV.cleanProjectPath;

  var activeFilter = 'all';
  var searchQuery = '';
  var activeCategory = 'all';
  var activeThread = '';
  var activeStatus = 'all';
  var activeChartFilter = null;

  // Store unfiltered positions for restore
  var savedPositions = null;
  function savePositions() {
    savedPositions = {};
    nodes.forEach(function(n) {
      savedPositions[n.id] = { tx: n.tx, ty: n.ty, tz: n.tz, x: n.x, y: n.y, z: n.z };
    });
  }
  function restorePositions() {
    if (!savedPositions) return;
    nodes.forEach(function(n) {
      var s = savedPositions[n.id];
      if (s) { n.tx = s.tx; n.ty = s.ty; n.tz = s.tz; n.x = s.x; n.y = s.y; n.z = s.z; }
    });
  }

  function buildChartMatcher(cf) {
    if (cf.type === 'heatmap') {
      var parts = cf.label.split(' ');
      var dayAbbrs = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var dayIdx = dayAbbrs.indexOf(parts[0]);
      var hr = parts.length > 1 ? parseInt(parts[1]) : -1;
      return function(n) {
        if (!n.modifiedAt) return false;
        var d = new Date(n.modifiedAt);
        if (d.getDay() !== dayIdx) return false;
        if (hr >= 0 && d.getHours() !== hr) return false;
        return true;
      };
    }
    if (cf.type === 'timeline') {
      var weekStart = new Date(cf.label).getTime();
      var weekEnd = weekStart + 7 * 86400000;
      return function(n) {
        if (!n.modifiedAt) return false;
        var t = new Date(n.modifiedAt).getTime();
        return t >= weekStart && t < weekEnd;
      };
    }
    if (cf.type === 'types') {
      return function(n) { return n.type === cf.label || n.nodeType === cf.label; };
    }
    if (cf.type === 'projects') {
      var projLabel = cf.label.toLowerCase();
      return function(n) {
        return cleanProjectPath(n.project).toLowerCase().includes(projLabel);
      };
    }
    return null;
  }

  function applyFilters() {
    var q = searchQuery.toLowerCase();
    var chartMatch = activeChartFilter ? buildChartMatcher(activeChartFilter) : null;

    nodes.forEach(function(n) {
      var vis = true;
      if (activeFilter !== 'all') {
        if (n.type !== activeFilter && n.nodeType !== activeFilter) vis = false;
      }
      if (q) {
        var matchName = n.name && n.name.toLowerCase().includes(q);
        var matchDesc = n.description && n.description.toLowerCase().includes(q);
        if (!matchName && !matchDesc) vis = false;
      }
      if (activeCategory !== 'all' && n.category !== activeCategory) vis = false;
      if (activeThread && n.threadId !== activeThread) vis = false;
      if (activeStatus !== 'all') {
        if ((n.status || 'active') !== activeStatus) vis = false;
      }
      if (chartMatch && vis) vis = chartMatch(n);
      // Property filters (range sliders)
      if (vis) {
        for (var field in propertyFilters) {
          var pf = propertyFilters[field];
          var val = n[field];
          if (val !== undefined && val !== null && typeof val === 'number') {
            if (pf.min !== undefined && val < pf.min) vis = false;
            if (pf.max !== undefined && val > pf.max) vis = false;
          }
        }
      }
      n.visible = vis;
      var mesh = NGV.nodeMeshes[n.id];
      if (mesh) mesh.visible = vis;
    });

    // Compact re-layout: when filtering, reposition visible nodes to fill space
    var visibleNodes = nodes.filter(function(n) { return n.visible; });
    var isFiltered = activeFilter !== 'all' || q || activeCategory !== 'all' ||
                     activeThread || activeStatus !== 'all' || chartMatch;

    if (isFiltered && visibleNodes.length > 0 && visibleNodes.length < nodes.length) {
      // Save original positions on first filter
      if (!savedPositions) savePositions();

      // Hide cell layout shells when filtering to avoid visual clutter
      if (NGV.setCellShellsVisible) NGV.setCellShellsVisible(false);

      // Compute bounding box of visible nodes
      var minX = Infinity, maxX = -Infinity;
      var minY = Infinity, maxY = -Infinity;
      var minZ = Infinity, maxZ = -Infinity;
      visibleNodes.forEach(function(n) {
        if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
        if (n.z < minZ) minZ = n.z; if (n.z > maxZ) maxZ = n.z;
      });

      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      var rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1, rangeZ = (maxZ - minZ) || 1;
      var maxRange = Math.max(rangeX, rangeY, rangeZ);

      // Target size based on node count
      var targetSize = Math.max(100, Math.sqrt(visibleNodes.length) * 40);
      var scale = maxRange > 0 ? targetSize / maxRange : 1;
      scale = Math.min(scale, 3); // Don't blow up too much

      // Recenter and scale visible nodes toward origin
      visibleNodes.forEach(function(n) {
        n.tx = (n.x - cx) * scale;
        n.ty = (n.y - cy) * scale;
        n.tz = (n.z - cz) * scale;
      });

      // Frame camera on the compact cluster
      var camDist = targetSize * 1.5;
      NGV.controls.target.set(0, 0, 0);
      NGV.camera.position.set(0, camDist * 0.3, camDist);
    } else if (!isFiltered && savedPositions) {
      // Restore original positions when filter cleared
      restorePositions();
      // Restore cell shells if they were visible
      if (NGV.setCellShellsVisible) NGV.setCellShellsVisible(true);
      savedPositions = null;
      // Reset camera
      if (NGV.resetModeCamera) NGV.resetModeCamera();
    }

    updateStats();

    // Notify analytics if open
    if (NGV._onFiltersChanged) NGV._onFiltersChanged();
  }

  function updateStats() {
    var visNodes = nodes.filter(function(n) { return n.visible; });
    var typeCount = {};
    visNodes.forEach(function(n) { typeCount[n.type] = (typeCount[n.type] || 0) + 1; });
    var visEdges = edges.filter(function(e) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      return a && b && a.visible && b.visible;
    }).length;

    var parts = [];
    for (var t in typeCount) {
      var def = nodeTypeDefs[t];
      parts.push('<span>' + typeCount[t] + '</span> ' + (def ? def.label : t));
    }
    parts.push('<span>' + visEdges + '</span> synapses');
    document.getElementById('stats-bar').innerHTML = parts.join(' · ');

    // Update faceted counts on type filter buttons
    var allButtons = document.querySelectorAll('#type-filter-bar .filter-btn');
    allButtons.forEach(function(btn) {
      var type = btn.dataset.type;
      var count = type === 'all' ? visNodes.length : (typeCount[type] || 0);
      var label = btn.textContent.replace(/ \(\d+\)$/, '');
      btn.textContent = label + ' (' + count + ')';
    });

    // Update category counts
    var catCount = {};
    visNodes.forEach(function(n) { catCount[n.category || 'general'] = (catCount[n.category || 'general'] || 0) + 1; });
    var catButtons = document.querySelectorAll('#category-bar .cat-btn');
    catButtons.forEach(function(btn) {
      var cat = btn.dataset.cat;
      var count = cat === 'all' ? visNodes.length : (catCount[cat] || 0);
      var label = btn.textContent.replace(/ \(\d+\)$/, '');
      btn.textContent = label + ' (' + count + ')';
    });
  }

  // ─── Property Filters ───
  var propertyFilters = {};

  function addPropertyFilter(field, min, max) {
    propertyFilters[field] = { min: min, max: max };
    applyFilters();
  }

  function removePropertyFilter(field) {
    delete propertyFilters[field];
    applyFilters();
  }

  // Save/load filter presets
  function saveFilterPreset(name) {
    var presets = JSON.parse(localStorage.getItem('ngv-filter-presets') || '{}');
    presets[name] = {
      activeFilter: activeFilter,
      activeCategory: activeCategory,
      activeStatus: activeStatus,
      searchQuery: searchQuery,
      propertyFilters: Object.assign({}, propertyFilters),
    };
    localStorage.setItem('ngv-filter-presets', JSON.stringify(presets));
  }

  function loadFilterPreset(name) {
    var presets = JSON.parse(localStorage.getItem('ngv-filter-presets') || '{}');
    var preset = presets[name];
    if (!preset) return;
    activeFilter = preset.activeFilter || 'all';
    activeCategory = preset.activeCategory || 'all';
    activeStatus = preset.activeStatus || 'all';
    searchQuery = preset.searchQuery || '';
    propertyFilters = preset.propertyFilters || {};
    document.getElementById('search-box').value = searchQuery;
    applyFilters();
  }

  function getFilterPresets() {
    return JSON.parse(localStorage.getItem('ngv-filter-presets') || '{}');
  }

  // Event wiring
  document.getElementById('search-box').addEventListener('input', function(e) {
    searchQuery = e.target.value;
    if (activeChartFilter) activeChartFilter = null;
    applyFilters();
  });

  document.getElementById('category-bar').addEventListener('click', function(e) {
    var btn = e.target.closest('.cat-btn');
    if (!btn) return;
    document.querySelectorAll('.cat-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    applyFilters();
  });

  document.getElementById('thread-select').addEventListener('change', function(e) {
    activeThread = e.target.value;
    applyFilters();
  });

  document.querySelectorAll('.status-bar .filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.status-bar .filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      applyFilters();
    });
  });

  NGV.applyFilters = applyFilters;
  NGV.updateStats = updateStats;
  NGV.setActiveFilter = function(f) { activeFilter = f; };
  NGV.setSearchQuery = function(q) { searchQuery = q; };
  NGV.setActiveChartFilter = function(f) { activeChartFilter = f; };
  NGV.addPropertyFilter = addPropertyFilter;
  NGV.removePropertyFilter = removePropertyFilter;
  NGV.saveFilterPreset = saveFilterPreset;
  NGV.loadFilterPreset = loadFilterPreset;
  NGV.getFilterPresets = getFilterPresets;
})();
