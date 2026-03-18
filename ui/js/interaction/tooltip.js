// Neural Graph Visualizer — Tooltip Module

(function() {
  var nodeTypeDefs = NGV.nodeTypeDefs;
  var escapeHtml = NGV.escapeHtml;

  function cleanProjectPath(raw) {
    if (!raw) return 'unknown';
    var p = raw.replace(/^-Users-[^-]+-/, '').replace(/-/g, '/');
    p = p.replace(/^Developments\//, '');
    p = p.replace(/\/worktrees\/.*$/, '');
    p = p.replace(/\/+/g, '/').replace(/\/$/, '');
    var segs = p.split('/').filter(Boolean);
    if (segs.length > 3) return segs.slice(-3).join('/');
    return p || 'unknown';
  }

  function formatDuration(startedAt, endedAt) {
    if (!startedAt || !endedAt) return 'Unknown';
    var ms = new Date(endedAt) - new Date(startedAt);
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    return (ms / 3600000).toFixed(1) + 'h';
  }

  function showTooltip(node, event) {
    var tooltip = document.getElementById('tooltip');
    var projClean = cleanProjectPath(node.project);
    var dateStr = '';
    if (node.startedAt || node.modifiedAt) {
      var d = new Date(node.startedAt || node.modifiedAt);
      var diff = Date.now() - d.getTime();
      if (diff < 86400000) dateStr = 'Today';
      else if (diff < 604800000) dateStr = Math.floor(diff/86400000) + ' days ago';
      else if (diff < 2592000000) dateStr = Math.floor(diff/604800000) + ' weeks ago';
      else dateStr = Math.floor(diff/2592000000) + ' months ago';
    }
    var html = '<div class="tt-name">' + escapeHtml(node.name) + '</div>';
    html += '<div class="tt-project">' + escapeHtml(projClean) + '</div>';
    var meta = [];
    if (dateStr) meta.push(dateStr);
    var typeDef = nodeTypeDefs[node.type];
    if (typeDef) meta.push(typeDef.label);
    else meta.push(node.type);
    if (meta.length) html += '<div class="tt-meta">' + meta.join(' · ') + '</div>';
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.clientX + 16) + 'px';
    tooltip.style.top = (event.clientY - 10) + 'px';
  }

  function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
  }

  NGV.cleanProjectPath = cleanProjectPath;
  NGV.formatDuration = formatDuration;
  NGV.showTooltip = showTooltip;
  NGV.hideTooltip = hideTooltip;
})();
