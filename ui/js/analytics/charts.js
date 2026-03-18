// Neural Graph Visualizer — Analytics Charts Module
// Canvas2D chart drawing with click-to-filter

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;
  var nodeMap = NGV.nodeMap;
  var nodeTypeDefs = NGV.nodeTypeDefs;
  var categoryColors = NGV.categoryColors;
  var accentColor = NGV.accentColor;
  var cleanProjectPath = NGV.cleanProjectPath;

  var analyticsOpen = false;
  var chartTooltip = document.getElementById('chart-tooltip');

  // Store hit regions for each chart canvas
  var chartHitRegions = {};

  function toggleAnalytics() {
    analyticsOpen = !analyticsOpen;
    document.getElementById('analytics-panel').classList.toggle('open', analyticsOpen);
    document.getElementById('analytics-toggle').classList.toggle('active', analyticsOpen);
    if (analyticsOpen) doUpdateAnalytics();
  }

  function closeAnalytics() {
    analyticsOpen = false;
    document.getElementById('analytics-panel').classList.remove('open');
    document.getElementById('analytics-toggle').classList.remove('active');
  }

  document.getElementById('analytics-toggle').addEventListener('click', toggleAnalytics);

  function showChartTooltip(e, html) {
    chartTooltip.innerHTML = html;
    chartTooltip.style.display = 'block';
    chartTooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 260) + 'px';
    chartTooltip.style.top = Math.min(e.clientY - 10, window.innerHeight - 60) + 'px';
  }

  function hideChartTooltip() { chartTooltip.style.display = 'none'; }

  function smartTruncate(label, maxLen) {
    if (label.length <= maxLen) return label;
    if (maxLen <= 5) return label.slice(0, maxLen - 1) + '\u2026';
    var half = Math.floor((maxLen - 1) / 2);
    return label.slice(0, half) + '\u2026' + label.slice(-(maxLen - half - 1));
  }

  function setupCanvas(id, height) {
    var canvas = document.getElementById(id);
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.parentElement.clientWidth;
    canvas.style.width = w + 'px';
    canvas.style.height = height + 'px';
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    canvas.style.cursor = 'pointer';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: w, h: height, canvas: canvas };
  }

  function lerpColor(t) {
    var r = Math.round(10 + (0 - 10) * t);
    var g = Math.round(15 + (210 - 15) * t);
    var b = Math.round(20 + (255 - 20) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ─── Apply chart filter ───
  var activeChartFilter = null;

  function applyChartFilter(filterType, label) {
    // Toggle: click same filter again to clear
    if (activeChartFilter && activeChartFilter.type === filterType && activeChartFilter.label === label) {
      activeChartFilter = null;
    } else {
      activeChartFilter = { type: filterType, label: label };
    }
    NGV.setActiveChartFilter(activeChartFilter);

    // Sync header type filter buttons when clicking type distribution
    if (filterType === 'types') {
      var bar = document.getElementById('type-filter-bar');
      if (bar) {
        bar.querySelectorAll('.filter-btn').forEach(function(btn) {
          btn.classList.remove('active');
          if (activeChartFilter && btn.dataset.type === label) btn.classList.add('active');
          if (!activeChartFilter && btn.dataset.type === 'all') btn.classList.add('active');
        });
        NGV.setActiveFilter(activeChartFilter ? label : 'all');
      }
    }

    NGV.applyFilters();
    // Re-render charts to show active highlight
    doUpdateAnalytics();
  }

  function computeAnalytics() {
    var heatmap = Array.from({length: 7}, function() { return new Array(24).fill(0); });
    var now = Date.now();
    var weeklyMap = {};
    var categories = {};
    var types = {};
    var projects = {};

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.visible) continue;
      types[n.type] = (types[n.type] || 0) + 1;
      categories[n.category || 'general'] = (categories[n.category || 'general'] || 0) + 1;
      var proj = cleanProjectPath(n.project);
      projects[proj] = (projects[proj] || 0) + 1;

      var ts = n.startedAt || n.modifiedAt;
      if (ts) {
        var d = new Date(ts);
        heatmap[d.getDay()][d.getHours()]++;
        var t = d.getTime();
        if (now - t <= 90 * 86400000) {
          var weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          var key = weekStart.toISOString().slice(0, 10);
          weeklyMap[key] = (weeklyMap[key] || 0) + 1;
        }
      }
    }

    var weeklyTrend = Object.entries(weeklyMap).sort(function(a,b) { return a[0].localeCompare(b[0]); });
    var topProjects = Object.entries(projects).sort(function(a,b) { return b[1]-a[1]; }).slice(0, 10);
    var visCount = nodes.filter(function(n) { return n.visible; }).length;
    var visEdges = edges.filter(function(e) { var a = nodeMap[e.source], b = nodeMap[e.target]; return a && b && a.visible && b.visible; }).length;

    return { totalNodes: visCount, totalEdges: visEdges, totalTypes: Object.keys(types).length, totalProjects: Object.keys(projects).length, heatmap: heatmap, weeklyTrend: weeklyTrend, categories: categories, types: types, topProjects: topProjects };
  }

  function drawHeatmap(data) {
    var setup = setupCanvas('chart-heatmap', 120);
    var ctx = setup.ctx, w = setup.w, h = setup.h;
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var labelW = 30;
    var cellW = (w - labelW) / 24;
    var cellH = h / 7;
    var maxVal = 1;
    data.heatmap.forEach(function(row) { row.forEach(function(v) { if (v > maxVal) maxVal = v; }); });

    // Store hit regions
    var hits = [];

    ctx.font = '8px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var d = 0; d < 7; d++) {
      ctx.fillStyle = '#3a4a5a';
      ctx.fillText(days[d], labelW - 4, d * cellH + cellH / 2);
      for (var hr = 0; hr < 24; hr++) {
        var t = data.heatmap[d][hr] / maxVal;
        var isActive = activeChartFilter && activeChartFilter.type === 'heatmap' && activeChartFilter.label === days[d] + ' ' + hr;
        ctx.fillStyle = isActive ? 'rgba(0,210,255,0.6)' : lerpColor(t);
        ctx.fillRect(labelW + hr * cellW + 1, d * cellH + 1, cellW - 2, cellH - 2);

        if (data.heatmap[d][hr] > 0) {
          hits.push({ x: labelW + hr * cellW, y: d * cellH, w: cellW, h: cellH, type: 'heatmap', label: days[d] + ' ' + hr, count: data.heatmap[d][hr] });
          ctx.fillStyle = t > 0.5 || isActive ? '#030508' : '#5a7a9a';
          ctx.textAlign = 'center';
          ctx.fillText(data.heatmap[d][hr], labelW + hr * cellW + cellW / 2, d * cellH + cellH / 2);
          ctx.textAlign = 'right';
        }
      }
    }
    chartHitRegions['chart-heatmap'] = hits;

    ctx.fillStyle = '#2a3a4a';
    ctx.textAlign = 'center';
    ctx.font = '7px JetBrains Mono';
    for (var hr2 = 0; hr2 < 24; hr2 += 3) {
      ctx.fillText(hr2 + '', labelW + hr2 * cellW + cellW / 2, h - 2);
    }
  }

  function drawTimeline(data) {
    var setup = setupCanvas('chart-timeline', 100);
    var ctx = setup.ctx, w = setup.w, h = setup.h;
    var hits = [];

    if (data.weeklyTrend.length < 2) {
      ctx.fillStyle = '#2a3a4a'; ctx.font = '10px JetBrains Mono';
      ctx.fillText('Not enough data', w / 2 - 40, h / 2);
      chartHitRegions['chart-timeline'] = [];
      return;
    }
    var maxVal = Math.max.apply(null, data.weeklyTrend.map(function(d) { return d[1]; }).concat([1]));
    var pad = { l: 28, r: 8, t: 8, b: 16 };
    var pw = w - pad.l - pad.r;
    var ph = h - pad.t - pad.b;

    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + ph);
    data.weeklyTrend.forEach(function(d, i) {
      var x = pad.l + (i / (data.weeklyTrend.length - 1)) * pw;
      var y = pad.t + ph - (d[1] / maxVal) * ph;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(0,210,255,0.25)');
    grad.addColorStop(1, 'rgba(0,210,255,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    data.weeklyTrend.forEach(function(d, i) {
      var x = pad.l + (i / (data.weeklyTrend.length - 1)) * pw;
      var y = pad.t + ph - (d[1] / maxVal) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Clickable dots on data points
    data.weeklyTrend.forEach(function(d, i) {
      var x = pad.l + (i / (data.weeklyTrend.length - 1)) * pw;
      var y = pad.t + ph - (d[1] / maxVal) * ph;
      var isActive = activeChartFilter && activeChartFilter.type === 'timeline' && activeChartFilter.label === d[0];
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#fff' : accentColor;
      ctx.fill();
      hits.push({ x: x - 8, y: y - 8, w: 16, h: 16, type: 'timeline', label: d[0], count: d[1] });
    });
    chartHitRegions['chart-timeline'] = hits;

    ctx.fillStyle = '#2a3a4a'; ctx.font = '8px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(maxVal, pad.l - 4, pad.t + 8);
    ctx.fillText('0', pad.l - 4, pad.t + ph);
    ctx.textAlign = 'center';
    var step = Math.max(1, Math.floor(data.weeklyTrend.length / 4));
    for (var i = 0; i < data.weeklyTrend.length; i += step) {
      var x = pad.l + (i / (data.weeklyTrend.length - 1)) * pw;
      ctx.fillText(data.weeklyTrend[i][0].slice(5), x, h - 2);
    }
  }

  function drawHorizontalBars(canvasId, entries, height, colorFn, chartType) {
    var setup = setupCanvas(canvasId, height);
    var ctx = setup.ctx, w = setup.w, h = setup.h;
    var hits = [];

    if (!entries.length) {
      chartHitRegions[canvasId] = [];
      return;
    }
    var maxVal = Math.max.apply(null, entries.map(function(e) { return e[1]; }).concat([1]));
    var barH = Math.min(16, (h - 4) / entries.length);
    ctx.font = '9px JetBrains Mono';
    var labelW = Math.min(ctx.measureText('W'.repeat(20)).width + 8, w * 0.5);
    var barW = w - labelW - 44;

    entries.forEach(function(entry, i) {
      var y = i * barH + 2;
      var isActive = activeChartFilter && activeChartFilter.type === chartType && activeChartFilter.label === entry[0];

      // Highlight active row
      if (isActive) {
        ctx.fillStyle = 'rgba(0,210,255,0.08)';
        ctx.fillRect(0, y, w, barH);
      }

      ctx.fillStyle = isActive ? '#fff' : '#7a8a9a';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(smartTruncate(entry[0], 20), labelW - 4, y + barH / 2);
      var bw = (entry[1] / maxVal) * barW;
      ctx.globalAlpha = isActive ? 1.0 : 0.85;
      ctx.fillStyle = typeof colorFn === 'function' ? colorFn(entry[0]) : (colorFn || 'rgba(0,210,255,0.4)');
      ctx.fillRect(labelW, y + 2, bw, barH - 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = isActive ? '#fff' : '#5a7a9a';
      ctx.textAlign = 'left';
      ctx.fillText(entry[1], labelW + bw + 4, y + barH / 2);

      hits.push({ x: 0, y: y, w: w, h: barH, type: chartType, label: entry[0], count: entry[1] });
    });
    chartHitRegions[canvasId] = hits;
  }

  // ─── Chart click handlers ───
  function setupChartClick(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.addEventListener('click', function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var hits = chartHitRegions[canvasId] || [];

      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          applyChartFilter(h.type, h.label);
          return;
        }
      }
      // Clicked empty area — clear filter
      if (activeChartFilter) {
        activeChartFilter = null;
        NGV.setActiveChartFilter(null);
        NGV.applyFilters();
        doUpdateAnalytics();
      }
    });

    canvas.addEventListener('mousemove', function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var hits = chartHitRegions[canvasId] || [];

      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          showChartTooltip(e, '<span class="ct-label">' + h.label + '</span> <span class="ct-value">' + h.count + ' nodes</span>');
          canvas.style.cursor = 'pointer';
          return;
        }
      }
      hideChartTooltip();
      canvas.style.cursor = 'default';
    });

    canvas.addEventListener('mouseleave', function() { hideChartTooltip(); });
  }

  // Wire up click handlers for all chart canvases
  ['chart-heatmap', 'chart-timeline', 'chart-categories', 'chart-types', 'chart-projects'].forEach(setupChartClick);

  function doUpdateAnalytics() {
    if (!analyticsOpen) return;
    var d = computeAnalytics();

    document.getElementById('kpi-nodes').textContent = d.totalNodes.toLocaleString();
    document.getElementById('kpi-edges').textContent = d.totalEdges.toLocaleString();
    document.getElementById('kpi-types').textContent = d.totalTypes;
    document.getElementById('kpi-projects').textContent = d.totalProjects;

    drawHeatmap(d);
    drawTimeline(d);

    var catEntries = Object.entries(d.categories).sort(function(a,b) { return b[1]-a[1]; });
    drawHorizontalBars('chart-categories', catEntries, 140, function(label) {
      return (categoryColors[label] || '#666') + 'aa';
    }, 'categories');

    var typeEntries = Object.entries(d.types).sort(function(a,b) { return b[1]-a[1]; });
    drawHorizontalBars('chart-types', typeEntries, 140, function(label) {
      var def = nodeTypeDefs[label];
      return def ? def.color + 'aa' : 'rgba(100,100,100,0.5)';
    }, 'types');

    drawHorizontalBars('chart-projects', d.topProjects, 140, 'rgba(0,210,255,0.4)', 'projects');
  }

  // Hook into filter changes
  NGV._onFiltersChanged = function() {
    if (analyticsOpen) requestAnimationFrame(doUpdateAnalytics);
  };

  NGV.toggleAnalytics = toggleAnalytics;
  NGV.closeAnalytics = closeAnalytics;
  NGV.doUpdateAnalytics = doUpdateAnalytics;
  NGV.isAnalyticsOpen = function() { return analyticsOpen; };
})();
