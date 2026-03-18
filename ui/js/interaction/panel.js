// Neural Graph Visualizer — Panel Module
// Detail panel with tabs (Overview, Connections, Properties)

(function() {
  var nodeTypeDefs = NGV.nodeTypeDefs;
  var categoryColors = NGV.categoryColors;
  var escapeHtml = NGV.escapeHtml;
  var hexOf = NGV.hexOf;
  var nodeMap = NGV.nodeMap;
  var nodeByKey = NGV.nodeByKey;
  var nodeEdgeMap = NGV.nodeEdgeMap;
  var edges = NGV.edges;
  var nodeScale = NGV.nodeScale;
  var TYPE_COLORS_RGB = NGV.TYPE_COLORS_RGB;

  var selectedNode = null;

  function openPanel(n) {
    selectedNode = n;
    var panel = document.getElementById('panel');
    document.getElementById('panel-name').textContent = n.name;
    var badge = document.getElementById('panel-type');

    document.getElementById('panel-tags').innerHTML = '';
    document.getElementById('panel-crossrefs').innerHTML = '';
    document.getElementById('panel-status').innerHTML = '';

    var oldCatBadge = panel.querySelector('.category-badge');
    if (oldCatBadge) oldCatBadge.remove();

    var typeDef = nodeTypeDefs[n.type];
    badge.textContent = typeDef ? typeDef.label : n.type;
    badge.style.background = hexOf(n.type);
    badge.style.color = '#030508';

    var projClean = NGV.cleanProjectPath(n.project);
    document.getElementById('panel-project').textContent = projClean;
    document.getElementById('panel-desc').innerHTML = '<span style="color:#3a4a5a;font-style:italic">Loading...</span>';
    document.getElementById('panel-body').textContent = '';
    document.getElementById('panel-meta').textContent = 'Modified: ' + new Date(n.modifiedAt).toLocaleDateString();

    // Category badge
    if (n.category) {
      var catBadge = document.createElement('span');
      catBadge.className = 'category-badge';
      catBadge.textContent = n.category;
      var catColor = categoryColors[n.category] || '#666';
      catBadge.style.background = catColor + '22';
      catBadge.style.color = catColor;
      catBadge.style.border = '1px solid ' + catColor + '33';
      badge.after(catBadge);
    }

    // Tags
    var tagsEl = document.getElementById('panel-tags');
    if (n.tags && n.tags.length) {
      n.tags.forEach(function(t) {
        var pill = document.createElement('span');
        pill.className = 'tag-pill auto';
        pill.textContent = t;
        tagsEl.appendChild(pill);
      });
    }
    if (n.customTags && n.customTags.length) {
      n.customTags.forEach(function(t) {
        var pill = document.createElement('span');
        pill.className = 'tag-pill custom';
        pill.textContent = t;
        tagsEl.appendChild(pill);
      });
    }

    // Cross-references
    var crossEl = document.getElementById('panel-crossrefs');
    if (n.crossRefs && n.crossRefs.length) {
      var label = document.createElement('div');
      label.style.cssText = 'color:#2a3a4a;margin-bottom:4px;font-size:10px';
      label.textContent = 'Cross-references:';
      crossEl.appendChild(label);
      n.crossRefs.forEach(function(refKey) {
        var refNode = nodeByKey[refKey] || nodeMap[refKey];
        var link = document.createElement('span');
        link.className = 'cross-ref-link';
        link.textContent = refNode ? refNode.name : refKey.split('/').pop();
        link.addEventListener('click', function() { if (refNode) openPanel(refNode); });
        crossEl.appendChild(link);
      });
    }

    // Status
    var statusEl = document.getElementById('panel-status');
    var status = n.status || 'active';
    var statusColors = { active: '#26de81', archived: '#3a4a5a', pinned: '#ffdd00' };
    statusEl.innerHTML = '<span style="color:' + (statusColors[status] || '#666') + '">●</span> ' + status;

    // Fetch detail
    fetch('/api/detail?id=' + encodeURIComponent(n.sessionId || n.id))
      .then(function(r) { return r.ok ? r.json() : Promise.reject('not found'); })
      .then(function(data) {
        var descEl = document.getElementById('panel-desc');
        descEl.textContent = data.description || data.summary || data.firstMessage || '(no description)';
        if (data.body) document.getElementById('panel-body').textContent = data.body;
        appendMoleculeButton(n);
      })
      .catch(function() {
        document.getElementById('panel-desc').textContent = n.description || '(no description)';
        appendMoleculeButton(n);
      });

    function appendMoleculeButton(node) {
      if (node.smiles || node.pdbId || node.moleculeFile || node.type === 'compound' || node.type === 'treatment' || node.type === 'drug') {
        var molUrl = '/molecule.html?name=' + encodeURIComponent(node.name);
        if (node.smiles) molUrl += '&smiles=' + encodeURIComponent(node.smiles);
        if (node.pdbId) molUrl += '&pdb=' + encodeURIComponent(node.pdbId);
        if (node.moleculeFile) molUrl += '&file=' + encodeURIComponent(node.moleculeFile);
        var viewBtn = document.createElement('button');
        viewBtn.className = 'layout-toggle';
        viewBtn.textContent = 'View 3D Structure';
        viewBtn.style.marginTop = '12px';
        viewBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.open(molUrl, '_blank');
        });
        document.getElementById('panel-body').appendChild(viewBtn);
      }
    }

    // Populate connections and properties tabs
    populateConnectionsTab(n);
    populatePropertiesTab(n);

    // Reset to overview tab
    document.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.panel-tab[data-tab="overview"]').classList.add('active');
    document.querySelectorAll('.panel-tab-content').forEach(function(c) { c.style.display = 'none'; });
    document.getElementById('tab-overview').style.display = '';

    panel.classList.add('open');
  }

  function closePanel() {
    selectedNode = null;
    document.getElementById('panel').classList.remove('open');
  }

  // Panel tab switching
  document.querySelector('.panel-tabs').addEventListener('click', function(e) {
    var tab = e.target.closest('.panel-tab');
    if (!tab) return;
    document.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    document.querySelectorAll('.panel-tab-content').forEach(function(c) { c.style.display = 'none'; });
    document.getElementById('tab-' + tab.dataset.tab).style.display = '';
  });

  function populateConnectionsTab(node) {
    var list = document.getElementById('panel-connections-list');
    list.innerHTML = '';
    var nodeEdges = nodeEdgeMap[node.id] || [];
    var sorted = nodeEdges.map(function(i) { return { idx: i, edge: edges[i] }; })
      .sort(function(a, b) { return (b.edge.weight || 0) - (a.edge.weight || 0); });

    if (sorted.length === 0) {
      list.innerHTML = '<div style="color:#3a4a5a;font-size:11px;padding:8px">No connections</div>';
      return;
    }

    sorted.forEach(function(item) {
      var e = item.edge;
      var neighborId = e.source === node.id ? e.target : e.source;
      var neighbor = nodeMap[neighborId];
      if (!neighbor) return;

      var div = document.createElement('div');
      div.className = 'connection-item';

      var weight = document.createElement('span');
      weight.className = 'connection-weight';
      weight.textContent = (e.weight || 0).toFixed(2);
      div.appendChild(weight);

      var name = document.createElement('span');
      name.className = 'connection-name';
      name.textContent = neighbor.name;
      name.style.color = hexOf(neighbor.type);
      div.appendChild(name);

      if (e.edgeType && e.edgeType !== 'auto' && e.edgeType !== 'temporal') {
        var badge = document.createElement('span');
        badge.className = 'edge-type-badge';
        badge.textContent = e.edgeType;
        div.appendChild(badge);
      }

      div.addEventListener('click', function() { openPanel(neighbor); });
      list.appendChild(div);
    });
  }

  function populatePropertiesTab(node) {
    var grid = document.getElementById('panel-properties-grid');
    grid.innerHTML = '';
    var props = [
      ['ID', node.id],
      ['Type', node.type],
      ['Project', node.project],
      ['Status', node.status || 'active'],
      ['Connections', (node.connections || 0).toString()],
    ];
    if (node.modifiedAt) props.push(['Modified', new Date(node.modifiedAt).toLocaleDateString()]);
    if (node.startedAt) props.push(['Started', new Date(node.startedAt).toLocaleDateString()]);
    if (node.endedAt) props.push(['Ended', new Date(node.endedAt).toLocaleDateString()]);
    if (node.category) props.push(['Category', node.category]);
    if (node.threadId) props.push(['Thread', node.threadId]);
    if (node.doi) props.push(['DOI', node.doi]);
    if (node.pmid) props.push(['PMID', node.pmid]);
    if (node.citationCount !== undefined) props.push(['Citations', node.citationCount.toString()]);

    var knownKeys = ['id','name','type','project','description','body','modifiedAt','startedAt','endedAt',
      'category','tags','customTags','status','threadId','crossRefs','connections','x','y','z','tx','ty','tz',
      'vx','vy','vz','visible','smiles','pdbId','moleculeFile','path','sessionId','rank','messageCount','fileSize',
      'doi','pmid','citationCount','nodeType','_pendingDrug'];
    for (var key in node) {
      if (knownKeys.indexOf(key) < 0 && node[key] !== undefined && node[key] !== null) {
        var val = typeof node[key] === 'object' ? JSON.stringify(node[key]) : String(node[key]);
        props.push([key, val]);
      }
    }

    props.forEach(function(p) {
      var label = document.createElement('div');
      label.className = 'meta-label';
      label.textContent = p[0];
      grid.appendChild(label);
      var value = document.createElement('div');
      value.className = 'meta-value';
      value.textContent = p[1];
      grid.appendChild(value);
    });
  }

  document.getElementById('panel-close').addEventListener('click', closePanel);

  NGV.openPanel = openPanel;
  NGV.closePanel = closePanel;
  NGV.getSelectedNode = function() { return selectedNode; };
})();
