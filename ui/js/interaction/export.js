// Neural Graph Visualizer — Export Module
// PNG screenshot, JSON, CSV, GEXF export

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;
  var nodeMap = NGV.nodeMap;
  var nodeScale = NGV.nodeScale;
  var escapeHtml = NGV.escapeHtml;
  var TYPE_COLORS_RGB = NGV.TYPE_COLORS_RGB;

  function downloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportScreenshot() {
    NGV.composer.render();
    var dataUrl = NGV.renderer.domElement.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = dataUrl; a.download = 'neural-graph-' + Date.now() + '.png';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }

  function exportJSON() {
    var visibleNodes = nodes.filter(function(n) { return n.visible; });
    var visibleEdges = edges.filter(function(e) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      return a && b && a.visible && b.visible;
    });
    var exportData = {
      nodes: visibleNodes.map(function(n) {
        return {
          id: n.id, name: n.name, type: n.type, project: n.project,
          description: n.description, body: n.body,
          position: { x: n.x, y: n.y, z: n.z },
          connections: n.connections, category: n.category,
          tags: n.tags, status: n.status
        };
      }),
      edges: visibleEdges.map(function(e) {
        return { source: e.source, target: e.target, weight: e.weight, edgeType: e.edgeType };
      }),
      exportedAt: new Date().toISOString()
    };
    downloadFile('neural-graph-' + Date.now() + '.json', JSON.stringify(exportData, null, 2), 'application/json');
  }

  function exportCSV() {
    var nodeCSV = 'id,name,type,project,description,category,status,connections,x,y,z\n';
    nodes.filter(function(n) { return n.visible; }).forEach(function(n) {
      nodeCSV += [n.id, '"'+escapeHtml(n.name||'')+'"', n.type, '"'+(n.project||'')+'"',
        '"'+escapeHtml((n.description||'').replace(/"/g,'""'))+'"',
        n.category||'', n.status||'active', n.connections, n.x.toFixed(1), n.y.toFixed(1), n.z.toFixed(1)
      ].join(',') + '\n';
    });

    var edgeCSV = 'source,target,weight,edgeType\n';
    edges.filter(function(e) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      return a && b && a.visible && b.visible;
    }).forEach(function(e) {
      edgeCSV += [e.source, e.target, (e.weight||0).toFixed(3), e.edgeType||''].join(',') + '\n';
    });

    downloadFile('neural-graph-nodes-' + Date.now() + '.csv', nodeCSV, 'text/csv');
    downloadFile('neural-graph-edges-' + Date.now() + '.csv', edgeCSV, 'text/csv');
  }

  function exportGEXF() {
    var visibleNodes = nodes.filter(function(n) { return n.visible; });
    var visibleEdges = edges.filter(function(e) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      return a && b && a.visible && b.visible;
    });

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gexf xmlns="http://gexf.net/1.3" xmlns:viz="http://gexf.net/1.3/viz" version="1.3">\n';
    xml += '  <meta lastmodifieddate="' + new Date().toISOString().slice(0,10) + '">\n';
    xml += '    <creator>Neural Graph Visualizer</creator>\n';
    xml += '  </meta>\n';
    xml += '  <graph defaultedgetype="directed" mode="static">\n';
    xml += '    <attributes class="node">\n';
    xml += '      <attribute id="0" title="type" type="string"/>\n';
    xml += '      <attribute id="1" title="category" type="string"/>\n';
    xml += '      <attribute id="2" title="project" type="string"/>\n';
    xml += '    </attributes>\n';
    xml += '    <attributes class="edge">\n';
    xml += '      <attribute id="0" title="edgeType" type="string"/>\n';
    xml += '    </attributes>\n';
    xml += '    <nodes>\n';
    visibleNodes.forEach(function(n) {
      var color = TYPE_COLORS_RGB[n.type] || TYPE_COLORS_RGB.unknown;
      xml += '      <node id="' + escapeHtml(n.id) + '" label="' + escapeHtml(n.name) + '">\n';
      xml += '        <attvalues>\n';
      xml += '          <attvalue for="0" value="' + escapeHtml(n.type||'') + '"/>\n';
      xml += '          <attvalue for="1" value="' + escapeHtml(n.category||'') + '"/>\n';
      xml += '          <attvalue for="2" value="' + escapeHtml(n.project||'') + '"/>\n';
      xml += '        </attvalues>\n';
      xml += '        <viz:color r="' + color.r + '" g="' + color.g + '" b="' + color.b + '"/>\n';
      xml += '        <viz:position x="' + n.x.toFixed(1) + '" y="' + n.y.toFixed(1) + '" z="' + n.z.toFixed(1) + '"/>\n';
      xml += '        <viz:size value="' + (nodeScale(n) * 2).toFixed(1) + '"/>\n';
      xml += '      </node>\n';
    });
    xml += '    </nodes>\n';
    xml += '    <edges>\n';
    visibleEdges.forEach(function(e, i) {
      xml += '      <edge id="' + i + '" source="' + escapeHtml(e.source) + '" target="' + escapeHtml(e.target) + '" weight="' + (e.weight||0).toFixed(3) + '">\n';
      if (e.edgeType) {
        xml += '        <attvalues><attvalue for="0" value="' + escapeHtml(e.edgeType) + '"/></attvalues>\n';
      }
      xml += '      </edge>\n';
    });
    xml += '    </edges>\n';
    xml += '  </graph>\n';
    xml += '</gexf>';

    downloadFile('neural-graph-' + Date.now() + '.gexf', xml, 'application/xml');
  }

  // Wire export buttons
  document.getElementById('btn-screenshot').addEventListener('click', exportScreenshot);
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-gexf').addEventListener('click', exportGEXF);

  NGV.exportScreenshot = exportScreenshot;
  NGV.exportJSON = exportJSON;
  NGV.exportCSV = exportCSV;
  NGV.exportGEXF = exportGEXF;
})();
