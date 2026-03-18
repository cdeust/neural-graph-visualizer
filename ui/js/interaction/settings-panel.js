// Neural Graph Visualizer — Settings Panel Module
// Gear icon, toggles, layout dropdown, localStorage persistence

(function() {
  // Load saved settings
  var settings = JSON.parse(localStorage.getItem('ngv-settings') || '{}');

  // Default settings
  var defaults = {
    bloom: true,
    edgeParticles: true,
    glassShell: false,
    labels: false,
    edgeBundling: false,
    minimap: true,
    dustParticles: true,
  };

  for (var key in defaults) {
    if (settings[key] === undefined) settings[key] = defaults[key];
  }

  function saveSetting(key, value) {
    settings[key] = value;
    localStorage.setItem('ngv-settings', JSON.stringify(settings));
  }

  // Create settings panel
  var panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.style.cssText = 'position:fixed;top:48px;right:0;bottom:0;width:280px;' +
    'background:rgba(3,5,8,0.92);backdrop-filter:blur(30px);' +
    'border-left:1px solid rgba(0,210,255,0.08);' +
    'transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);' +
    'z-index:140;overflow-y:auto;padding:16px;' +
    'font-family:JetBrains Mono,monospace;font-size:11px;color:#c8d6e5;';
  document.body.appendChild(panel);

  var settingsOpen = false;

  // Gear button
  var gearBtn = document.createElement('button');
  gearBtn.className = 'header-btn';
  gearBtn.id = 'settings-btn';
  gearBtn.textContent = '\u2699';
  gearBtn.title = 'Settings';
  gearBtn.style.fontSize = '14px';
  // Insert before stats bar
  var statsBar = document.getElementById('stats-bar');
  if (statsBar) statsBar.parentNode.insertBefore(gearBtn, statsBar);

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    panel.style.transform = settingsOpen ? 'translateX(0)' : 'translateX(100%)';
    gearBtn.classList.toggle('active', settingsOpen);
  }

  gearBtn.addEventListener('click', toggleSettings);

  // Build settings UI
  var title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;' +
    'margin-bottom:16px;color:#00d2ff;';
  title.textContent = 'Settings';
  panel.appendChild(title);

  function createToggle(label, key, onChange) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;' +
      'border-bottom:1px solid rgba(0,210,255,0.05);';

    var labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.color = '#8a9aaa';
    row.appendChild(labelEl);

    var toggle = document.createElement('div');
    toggle.style.cssText = 'width:36px;height:20px;border-radius:10px;cursor:pointer;' +
      'transition:background 0.2s;position:relative;' +
      'background:' + (settings[key] ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.08)') + ';';
    var knob = document.createElement('div');
    knob.style.cssText = 'width:16px;height:16px;border-radius:50%;position:absolute;top:2px;' +
      'transition:left 0.2s;background:#c8d6e5;' +
      'left:' + (settings[key] ? '18px' : '2px') + ';';
    toggle.appendChild(knob);

    toggle.addEventListener('click', function() {
      settings[key] = !settings[key];
      saveSetting(key, settings[key]);
      toggle.style.background = settings[key] ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.08)';
      knob.style.left = settings[key] ? '18px' : '2px';
      if (onChange) onChange(settings[key]);
    });

    row.appendChild(toggle);
    panel.appendChild(row);
    return row;
  }

  // Visual toggles
  var sectionTitle = document.createElement('div');
  sectionTitle.style.cssText = 'font-size:9px;color:#3a5a7a;letter-spacing:1px;text-transform:uppercase;' +
    'margin:12px 0 4px;';
  sectionTitle.textContent = 'Visual Effects';
  panel.appendChild(sectionTitle);

  createToggle('Bloom', 'bloom', function(val) {
    NGV.bloomPass.strength = val ? 0.7 : 0;
  });

  createToggle('Edge Particles', 'edgeParticles', function(val) {
    if (NGV.flowPoints) NGV.flowPoints.visible = val;
  });

  createToggle('Glass Shell', 'glassShell', function(val) {
    if (val !== NGV.glassShellEnabled()) NGV.toggleGlassShell();
  });

  createToggle('Labels', 'labels', function(val) {
    if (val !== NGV.isLabelsVisible()) NGV.toggleLabels();
  });

  createToggle('Dust Particles', 'dustParticles', function() {
    // Toggle handled in animation by checking this setting
  });

  createToggle('Minimap', 'minimap', function(val) {
    var minimap = document.getElementById('minimap');
    if (minimap) minimap.style.display = val ? '' : 'none';
  });

  // Layout section
  var layoutTitle = document.createElement('div');
  layoutTitle.style.cssText = 'font-size:9px;color:#3a5a7a;letter-spacing:1px;text-transform:uppercase;' +
    'margin:16px 0 8px;';
  layoutTitle.textContent = 'Layout';
  panel.appendChild(layoutTitle);

  var layoutSelect = document.createElement('select');
  layoutSelect.className = 'header-select';
  layoutSelect.style.cssText = 'width:100%;padding:6px 8px;margin-bottom:8px;';
  ['cluster', 'pathway', 'timeline', 'cascade', 'pipeline', 'radial'].forEach(function(l) {
    var opt = document.createElement('option');
    opt.value = l;
    opt.textContent = l.charAt(0).toUpperCase() + l.slice(1);
    layoutSelect.appendChild(opt);
  });
  layoutSelect.addEventListener('change', function() {
    var val = layoutSelect.value;
    if (val === 'cluster') { NGV.initPositions3D(); NGV.runForceLayout3D(200); }
    else if (val === 'timeline') { NGV.applyTimelineLayout3D(); }
    else { NGV.applyPathwayLayout3D(); }
    NGV.buildFiberTracts();
  });
  panel.appendChild(layoutSelect);

  // Performance section
  var perfTitle = document.createElement('div');
  perfTitle.style.cssText = 'font-size:9px;color:#3a5a7a;letter-spacing:1px;text-transform:uppercase;' +
    'margin:16px 0 4px;';
  perfTitle.textContent = 'Performance';
  panel.appendChild(perfTitle);

  createToggle('Edge Bundling', 'edgeBundling', function(val) {
    if (NGV.toggleEdgeBundling) NGV.toggleEdgeBundling();
  });

  // Apply initial settings
  if (!settings.bloom) NGV.bloomPass.strength = 0;
  if (!settings.minimap) {
    var minimap = document.getElementById('minimap');
    if (minimap) minimap.style.display = 'none';
  }

  NGV.getSettings = function() { return settings; };
  NGV.toggleSettings = toggleSettings;
})();
