// ═══════════════════════════════════════════════════════════════════
// Molecule Controls — UI panel, file drop, render mode toggles
// ═══════════════════════════════════════════════════════════════════

window.MolControls = (function() {
  'use strict';

  var viewer = null;
  var currentMode = 'ball-and-stick';
  var currentLabelMode = 'none';
  var hideHydrogens = false;
  var autoRotate = true;

  function init(viewerRef) {
    viewer = viewerRef;
    buildPanel();
    setupFileDrop();
    setupKeyboard();
    readUrlParams();
  }

  function buildPanel() {
    var panel = document.getElementById('mol-panel');
    if (!panel) return;

    var html = '';

    // Header
    html += '<div class="mol-panel-section">';
    html += '<div id="mol-name" class="mol-panel-title">No molecule loaded</div>';
    html += '<div id="mol-formula" class="mol-panel-subtitle"></div>';
    html += '</div>';

    // Render mode
    html += '<div class="mol-panel-section">';
    html += '<div class="mol-panel-label">Render Mode</div>';
    html += '<div class="mol-btn-group">';
    html += '<button class="mol-btn active" data-mode="ball-and-stick">Ball+Stick</button>';
    html += '<button class="mol-btn" data-mode="space-filling">CPK</button>';
    html += '<button class="mol-btn" data-mode="wireframe">Wire</button>';
    html += '<button class="mol-btn" data-mode="ribbon">Ribbon</button>';
    html += '<button class="mol-btn" data-mode="ribbon-ligand">Rib+Lig</button>';
    html += '</div>';
    html += '</div>';

    // Label mode
    html += '<div class="mol-panel-section">';
    html += '<div class="mol-panel-label">Labels</div>';
    html += '<div class="mol-btn-group">';
    html += '<button class="mol-btn active" data-label="none">None</button>';
    html += '<button class="mol-btn" data-label="element">Element</button>';
    html += '<button class="mol-btn" data-label="residue">Residue</button>';
    html += '<button class="mol-btn" data-label="full">Full</button>';
    html += '</div>';
    html += '</div>';

    // Toggles
    html += '<div class="mol-panel-section">';
    html += '<label class="mol-toggle"><input type="checkbox" id="mol-hide-h"> Hide Hydrogens</label>';
    html += '<label class="mol-toggle"><input type="checkbox" id="mol-auto-rotate" checked> Auto-rotate</label>';
    html += '</div>';

    // Stats
    html += '<div class="mol-panel-section">';
    html += '<div class="mol-panel-label">Info</div>';
    html += '<div id="mol-stats" class="mol-panel-stats">—</div>';
    html += '</div>';

    // Molecules list (for superposition)
    html += '<div class="mol-panel-section">';
    html += '<div class="mol-panel-label">Loaded Molecules</div>';
    html += '<div id="mol-list"></div>';
    html += '<button class="mol-btn mol-btn-wide" id="mol-align-btn" style="display:none">Align (Kabsch)</button>';
    html += '<div id="mol-rmsd" class="mol-panel-stats" style="display:none"></div>';
    html += '</div>';

    // Selection info
    html += '<div class="mol-panel-section">';
    html += '<div class="mol-panel-label">Selection</div>';
    html += '<div id="mol-selection-info" class="mol-panel-stats">Click an atom to select</div>';
    html += '</div>';

    // SMILES input
    html += '<div class="mol-panel-section">';
    html += '<div class="mol-panel-label">SMILES Input</div>';
    html += '<input type="text" id="mol-smiles-input" class="mol-input" placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O">';
    html += '<button class="mol-btn mol-btn-wide" id="mol-smiles-btn">Render SMILES</button>';
    html += '</div>';

    // File drop zone
    html += '<div class="mol-panel-section">';
    html += '<div id="mol-dropzone" class="mol-dropzone">Drop .pdb .mol .sdf files here</div>';
    html += '</div>';

    // Back link
    html += '<div class="mol-panel-section">';
    html += '<a href="/" class="mol-back-link">&larr; Back to Graph</a>';
    html += '</div>';

    panel.innerHTML = html;

    // Bind events
    bindRenderModeButtons();
    bindLabelButtons();
    bindToggles();
    bindSmilesInput();
    bindAlignButton();
  }

  function bindRenderModeButtons() {
    var btns = document.querySelectorAll('[data-mode]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        currentMode = this.getAttribute('data-mode');
        var siblings = document.querySelectorAll('[data-mode]');
        for (var j = 0; j < siblings.length; j++) siblings[j].classList.remove('active');
        this.classList.add('active');
        if (viewer) viewer.setRenderMode(currentMode);
      });
    }
  }

  function bindLabelButtons() {
    var btns = document.querySelectorAll('[data-label]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        currentLabelMode = this.getAttribute('data-label');
        var siblings = document.querySelectorAll('[data-label]');
        for (var j = 0; j < siblings.length; j++) siblings[j].classList.remove('active');
        this.classList.add('active');
        if (viewer) viewer.setLabelMode(currentLabelMode);
      });
    }
  }

  function bindToggles() {
    var hideH = document.getElementById('mol-hide-h');
    if (hideH) {
      hideH.addEventListener('change', function() {
        hideHydrogens = this.checked;
        if (viewer) viewer.setHideHydrogens(hideHydrogens);
      });
    }

    var autoRot = document.getElementById('mol-auto-rotate');
    if (autoRot) {
      autoRot.addEventListener('change', function() {
        autoRotate = this.checked;
        if (viewer) viewer.setAutoRotate(autoRotate);
      });
    }
  }

  function bindSmilesInput() {
    var btn = document.getElementById('mol-smiles-btn');
    var input = document.getElementById('mol-smiles-input');
    if (btn && input) {
      btn.addEventListener('click', function() {
        var smiles = input.value.trim();
        if (smiles && viewer) viewer.loadSMILES(smiles);
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var smiles = input.value.trim();
          if (smiles && viewer) viewer.loadSMILES(smiles);
        }
      });
    }
  }

  function bindAlignButton() {
    var btn = document.getElementById('mol-align-btn');
    if (btn) {
      btn.addEventListener('click', function() {
        if (viewer) viewer.alignMolecules();
      });
    }
  }

  function setupFileDrop() {
    var dropzone = document.getElementById('mol-dropzone');
    var body = document.body;

    function handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      if (dropzone) dropzone.classList.remove('dragover');

      var files = e.dataTransfer ? e.dataTransfer.files : [];
      for (var i = 0; i < files.length; i++) {
        loadFile(files[i]);
      }
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      if (dropzone) dropzone.classList.add('dragover');
    }

    function handleDragLeave(e) {
      e.preventDefault();
      if (dropzone) dropzone.classList.remove('dragover');
    }

    // Drop on the dropzone
    if (dropzone) {
      dropzone.addEventListener('dragover', handleDragOver);
      dropzone.addEventListener('dragleave', handleDragLeave);
      dropzone.addEventListener('drop', handleDrop);
    }

    // Also allow drop on the whole body
    body.addEventListener('dragover', function(e) { e.preventDefault(); });
    body.addEventListener('drop', handleDrop);
  }

  function loadFile(file) {
    var name = file.name.toLowerCase();
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      if (name.endsWith('.pdb')) {
        if (viewer) viewer.loadPDB(text, file.name);
      } else if (name.endsWith('.sdf') || name.endsWith('.mol')) {
        if (viewer) viewer.loadSDF(text, file.name);
      } else {
        console.warn('Unsupported file format:', name);
      }
    };
    reader.readAsText(file);
  }

  function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case '1': setMode('ball-and-stick'); break;
        case '2': setMode('space-filling'); break;
        case '3': setMode('wireframe'); break;
        case '4': setMode('ribbon'); break;
        case '5': setMode('ribbon-ligand'); break;
        case 'h': toggleHydrogens(); break;
        case 'l': cycleLabelMode(); break;
        case 'r': toggleAutoRotate(); break;
        case 'Escape':
          if (window.MolPicker) window.MolPicker.clearSelection();
          break;
      }
    });
  }

  function setMode(mode) {
    currentMode = mode;
    var btns = document.querySelectorAll('[data-mode]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-mode') === mode);
    }
    if (viewer) viewer.setRenderMode(mode);
  }

  function toggleHydrogens() {
    hideHydrogens = !hideHydrogens;
    var cb = document.getElementById('mol-hide-h');
    if (cb) cb.checked = hideHydrogens;
    if (viewer) viewer.setHideHydrogens(hideHydrogens);
  }

  function toggleAutoRotate() {
    autoRotate = !autoRotate;
    var cb = document.getElementById('mol-auto-rotate');
    if (cb) cb.checked = autoRotate;
    if (viewer) viewer.setAutoRotate(autoRotate);
  }

  function cycleLabelMode() {
    var modes = ['none', 'element', 'residue', 'full'];
    var idx = (modes.indexOf(currentLabelMode) + 1) % modes.length;
    currentLabelMode = modes[idx];
    var btns = document.querySelectorAll('[data-label]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-label') === currentLabelMode);
    }
    if (viewer) viewer.setLabelMode(currentLabelMode);
  }

  function updateStats(molecule) {
    var statsEl = document.getElementById('mol-stats');
    if (!statsEl) return;

    var chains = {};
    for (var i = 0; i < molecule.atoms.length; i++) {
      chains[molecule.atoms[i].chainId] = true;
    }

    statsEl.innerHTML =
      'Atoms: ' + molecule.atoms.length +
      '<br>Bonds: ' + molecule.bonds.length +
      '<br>Chains: ' + Object.keys(chains).length;
  }

  function updateName(name, formula) {
    var nameEl = document.getElementById('mol-name');
    var formulaEl = document.getElementById('mol-formula');
    if (nameEl) nameEl.textContent = name || 'Unknown';
    if (formulaEl) formulaEl.textContent = formula || '';
  }

  function updateMoleculeList() {
    var listEl = document.getElementById('mol-list');
    var alignBtn = document.getElementById('mol-align-btn');
    if (!listEl) return;

    var mols = window.MolSuperpose.getMolecules();
    if (mols.length <= 1) {
      listEl.innerHTML = '';
      if (alignBtn) alignBtn.style.display = 'none';
      return;
    }

    if (alignBtn) alignBtn.style.display = 'block';

    var html = '';
    for (var i = 0; i < mols.length; i++) {
      var color = '#' + mols[i].color.toString(16).padStart(6, '0');
      html += '<div class="mol-list-item">';
      html += '<input type="checkbox" data-mol-idx="' + i + '"' + (mols[i].visible ? ' checked' : '') + '>';
      html += '<span class="mol-color-swatch" style="background:' + color + '"></span>';
      html += '<span class="mol-list-name">' + mols[i].name + '</span>';
      html += '</div>';
    }
    listEl.innerHTML = html;

    // Bind visibility checkboxes
    var cbs = listEl.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < cbs.length; i++) {
      cbs[i].addEventListener('change', function() {
        var idx = parseInt(this.getAttribute('data-mol-idx'), 10);
        if (viewer) viewer.setMoleculeVisibility(idx, this.checked);
      });
    }
  }

  function updateSelectionInfo(selectedAtoms, molecule) {
    var el = document.getElementById('mol-selection-info');
    if (!el) return;

    if (!selectedAtoms || selectedAtoms.length === 0) {
      el.textContent = 'Click an atom to select';
      return;
    }

    var html = '';
    for (var i = 0; i < selectedAtoms.length; i++) {
      var a = molecule.atoms[selectedAtoms[i]];
      if (a) {
        html += '<div>' + a.element + ' ' + a.name + ' (' + a.resName + ' ' + a.resSeq + ' ' + a.chainId + ')</div>';
      }
    }
    el.innerHTML = html;
  }

  function showRMSD(rmsd) {
    var el = document.getElementById('mol-rmsd');
    if (el) {
      el.style.display = 'block';
      el.innerHTML = 'RMSD: <span style="color:#00d2ff">' + rmsd.toFixed(3) + ' \u00C5</span>';
    }
  }

  function readUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var file = params.get('file');
    var smiles = params.get('smiles');
    var pdbId = params.get('pdb');
    var name = params.get('name');

    if (smiles && viewer) {
      // SMILES takes priority — always works
      viewer.loadSMILES(smiles, name);
    } else if (pdbId && viewer) {
      // Fetch PDB from RCSB
      updateName(name || pdbId, 'Loading from RCSB...');
      fetch('https://files.rcsb.org/download/' + pdbId + '.pdb')
        .then(function(r) { return r.ok ? r.text() : Promise.reject('not found'); })
        .then(function(text) {
          if (!viewer.loadPDB(text, name || pdbId)) {
            showMoleculeInfo(name, pdbId);
          }
        })
        .catch(function() {
          showMoleculeInfo(name, pdbId);
        });
    } else if (file && viewer) {
      // Try local file
      fetch('/data/molecules/' + encodeURIComponent(file))
        .then(function(r) { return r.ok ? r.text() : Promise.reject('not found'); })
        .then(function(text) {
          var loaded = false;
          if (file.endsWith('.pdb')) loaded = viewer.loadPDB(text, name || file);
          else if (file.endsWith('.sdf') || file.endsWith('.mol')) loaded = viewer.loadSDF(text, name || file);
          if (!loaded) showMoleculeInfo(name, file);
        })
        .catch(function() {
          showMoleculeInfo(name, file);
        });
    } else if (name) {
      showMoleculeInfo(name, null);
    }
  }

  function showMoleculeInfo(name, file) {
    updateName(name || 'Unknown', 'Biologic / Large molecule');
    var statsEl = document.getElementById('mol-stats');
    if (statsEl) {
      statsEl.innerHTML =
        'Large biologic molecules (monoclonal antibodies, fusion proteins) ' +
        'contain thousands of atoms and require PDB structure files for 3D visualization.' +
        '<br><br>To view this molecule:' +
        '<br>1. Download the PDB file from <span style="color:#00d2ff">rcsb.org</span>' +
        '<br>2. Drag and drop it onto this viewer';
    }
    var dropzone = document.getElementById('mol-dropzone');
    if (dropzone) {
      dropzone.textContent = 'Drop .pdb file for ' + (name || 'this molecule') + ' here';
      dropzone.style.borderColor = 'rgba(0,210,255,0.3)';
      dropzone.style.color = '#00d2ff';
    }
  }

  return {
    init: init,
    updateStats: updateStats,
    updateName: updateName,
    updateMoleculeList: updateMoleculeList,
    updateSelectionInfo: updateSelectionInfo,
    showRMSD: showRMSD
  };
})();
