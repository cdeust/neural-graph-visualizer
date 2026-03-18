// Neural Graph Visualizer — Cell Layout Module
// Positions nodes by cellular compartment in concentric rings (cell cross-section view)
// Nucleus at center, expanding outward: nucleus → signaling → cytoplasm → membrane → extracellular

(function() {
  var nodes = NGV.nodes;
  var edges = NGV.edges;
  var scene = NGV.scene;

  // ─── Compartment detection ───
  var compartmentRules = [
    // By type
    { match: function(n) { return n.type === 'trigger'; }, compartment: 'extracellular' },
    { match: function(n) { return n.type === 'cytokine' || n.type === 'chemokine' || n.type === 'antimicrobial_peptide'; }, compartment: 'extracellular' },
    { match: function(n) { return n.type === 'immune_cell'; }, compartment: 'immune' },
    { match: function(n) { return n.type === 'structural_cell'; }, compartment: 'membrane' },
    { match: function(n) { return n.type === 'signaling_pathway'; }, compartment: 'intracellular' },
    { match: function(n) { return n.type === 'compound' || n.type === 'drug' || n.type === 'treatment'; }, compartment: 'therapeutic' },
    { match: function(n) { return n.type === 'clinical_outcome'; }, compartment: 'outcome' },
    // By category
    { match: function(n) { return n.category === 'environmental'; }, compartment: 'extracellular' },
    { match: function(n) { return n.category === 'innate'; }, compartment: 'immune' },
    { match: function(n) { return n.category === 'adaptive'; }, compartment: 'immune' },
    { match: function(n) { return n.category === 'pro-inflammatory'; }, compartment: 'extracellular' },
    { match: function(n) { return n.category === 'intracellular'; }, compartment: 'intracellular' },
    { match: function(n) { return n.category === 'skin'; }, compartment: 'membrane' },
    { match: function(n) { return n.category === 'chemoattractant'; }, compartment: 'extracellular' },
    { match: function(n) { return n.category === 'biologic'; }, compartment: 'therapeutic' },
    { match: function(n) { return n.category === 'small-molecule'; }, compartment: 'therapeutic' },
    // By keywords
    { match: function(n) { return /receptor|membrane|surface/i.test(n.name + ' ' + (n.description || '')); }, compartment: 'membrane' },
    { match: function(n) { return /nucleus|transcription|gene|DNA|chromatin/i.test(n.name + ' ' + (n.description || '')); }, compartment: 'nucleus' },
    { match: function(n) { return /pathway|signaling|kinase|phosphor/i.test(n.name + ' ' + (n.description || '')); }, compartment: 'intracellular' },
    { match: function(n) { return /cell|lymphocyte|macrophage|neutrophil|DC|dendritic/i.test(n.type || ''); }, compartment: 'immune' },
  ];

  function detectCompartment(node) {
    for (var i = 0; i < compartmentRules.length; i++) {
      if (compartmentRules[i].match(node)) return compartmentRules[i].compartment;
    }
    return 'cytoplasm';
  }

  // ─── Concentric ring layout ───
  // Rings expand outward from center on the XZ plane, slight Y variation
  // Therapeutics placed on a separate arc to the side
  var compartmentRings = {
    nucleus:       { ring: 0,   baseRadius: 20,  color: '#ff4081', label: 'Nucleus' },
    intracellular: { ring: 1,   baseRadius: 70,  color: '#ffaa00', label: 'Signaling' },
    cytoplasm:     { ring: 2,   baseRadius: 120, color: '#00d2ff', label: 'Cytoplasm' },
    membrane:      { ring: 3,   baseRadius: 160, color: '#ff6b35', label: 'Cell Membrane' },
    immune:        { ring: 4,   baseRadius: 220, color: '#26de81', label: 'Immune Cells' },
    extracellular: { ring: 5,   baseRadius: 300, color: '#3a7aaa', label: 'Extracellular' },
    therapeutic:   { ring: -1,  baseRadius: 280, color: '#a55eea', label: 'Therapeutics' },
    outcome:       { ring: 6,   baseRadius: 360, color: '#45aaf2', label: 'Outcome' },
  };

  // ─── Visual ring shells ───
  var cellShells = new THREE.Group();
  cellShells.visible = false;
  scene.add(cellShells);

  function buildCellShells() {
    while (cellShells.children.length) cellShells.remove(cellShells.children[0]);

    // Draw concentric ring outlines on the XZ plane
    var ringOrder = ['nucleus', 'intracellular', 'cytoplasm', 'membrane', 'immune', 'extracellular'];
    var ringIdx = 0;
    ringOrder.forEach(function(key) {
      var zone = compartmentRings[key];
      // Ring outline — wide band with visible color
      var ringGeo = new THREE.RingGeometry(zone.baseRadius - 12, zone.baseRadius + 12, 64);
      var ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(zone.color),
        transparent: true, opacity: 0.12,
        side: THREE.DoubleSide, depthWrite: false,
      });
      var ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = -5;
      cellShells.add(ringMesh);

      // Filled disc for innermost zones
      if (key === 'nucleus') {
        var discGeo = new THREE.CircleGeometry(zone.baseRadius + 8, 48);
        var discMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(zone.color),
          transparent: true, opacity: 0.03,
          side: THREE.DoubleSide, depthWrite: false,
        });
        var disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = -5;
        cellShells.add(disc);
      }

      // Label — positioned at different angles around the ring
      var labelCanvas = document.createElement('canvas');
      var lctx = labelCanvas.getContext('2d');
      var text = zone.label;
      lctx.font = 'bold 24px JetBrains Mono';
      var tw = lctx.measureText(text).width + 20;
      labelCanvas.width = tw; labelCanvas.height = 34;
      lctx.font = 'bold 24px JetBrains Mono';
      lctx.fillStyle = zone.color;
      lctx.globalAlpha = 0.8;
      lctx.fillText(text, 10, 26);
      var labelTex = new THREE.CanvasTexture(labelCanvas);
      var labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false });
      var labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(tw / 4, 34 / 4, 1);
      // Distribute labels at different angles so they don't overlap
      var labelAngle = (ringIdx / ringOrder.length) * Math.PI * 1.5 - Math.PI * 0.3;
      var labelR = zone.baseRadius + 5;
      labelSprite.position.set(Math.cos(labelAngle) * labelR, 18, Math.sin(labelAngle) * labelR);
      cellShells.add(labelSprite);
      ringIdx++;
    });

    // Therapeutic zone label (positioned on the left side arc)
    var thZone = compartmentRings.therapeutic;
    var thCanvas = document.createElement('canvas');
    var thCtx = thCanvas.getContext('2d');
    thCtx.font = 'bold 24px JetBrains Mono';
    var thText = thZone.label;
    var thW = thCtx.measureText(thText).width + 20;
    thCanvas.width = thW; thCanvas.height = 34;
    thCtx.font = 'bold 24px JetBrains Mono';
    thCtx.fillStyle = thZone.color;
    thCtx.globalAlpha = 0.8;
    thCtx.fillText(thText, 10, 26);
    var thTex = new THREE.CanvasTexture(thCanvas);
    var thMat = new THREE.SpriteMaterial({ map: thTex, transparent: true, depthWrite: false });
    var thSprite = new THREE.Sprite(thMat);
    thSprite.scale.set(thW / 4, 34 / 4, 1);
    thSprite.position.set(-thZone.baseRadius - 10, 18, -50);
    cellShells.add(thSprite);
  }

  buildCellShells();

  // ─── Apply cell layout ───
  function applyCellLayout() {
    var compartments = {};
    nodes.forEach(function(n) {
      var comp = detectCompartment(n);
      n._compartment = comp;
      if (!compartments[comp]) compartments[comp] = [];
      compartments[comp].push(n);
    });

    for (var comp in compartments) {
      var group = compartments[comp];
      var zone = compartmentRings[comp] || compartmentRings.cytoplasm;
      var count = group.length;

      if (comp === 'therapeutic') {
        // Place therapeutics in a separate arc on the left side
        var arcStart = Math.PI * 0.6;
        var arcEnd = Math.PI * 1.4;
        group.forEach(function(n, i) {
          var angle = arcStart + (i / Math.max(count - 1, 1)) * (arcEnd - arcStart);
          n.tx = Math.cos(angle) * zone.baseRadius;
          n.ty = (Math.random() - 0.5) * 10;
          n.tz = Math.sin(angle) * zone.baseRadius;
        });
      } else if (count === 1) {
        n = group[0];
        n.tx = 0; n.ty = 0; n.tz = 0;
        if (zone.baseRadius > 0) {
          var a = Math.random() * Math.PI * 2;
          n.tx = Math.cos(a) * zone.baseRadius * 0.5;
          n.tz = Math.sin(a) * zone.baseRadius * 0.5;
        }
        n.ty = (Math.random() - 0.5) * 10;
      } else {
        // Distribute around the ring
        var jitter = Math.min(25, zone.baseRadius * 0.15);
        group.forEach(function(n, i) {
          var angle = (i / count) * Math.PI * 2 + (zone.ring || 0) * 0.3;
          var r = zone.baseRadius + (Math.random() - 0.5) * jitter;
          n.tx = Math.cos(angle) * r;
          n.ty = (Math.random() - 0.5) * 15;
          n.tz = Math.sin(angle) * r;
        });
      }
    }

    // Snap positions
    nodes.forEach(function(n) { n.x = n.tx; n.y = n.ty; n.z = n.tz; });

    // Light settling to prevent overlaps within same ring
    for (var iter = 0; iter < 20; iter++) {
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var ni = nodes[i], nj = nodes[j];
          if (ni._compartment !== nj._compartment) continue;
          var dx = ni.tx - nj.tx;
          var dz = ni.tz - nj.tz;
          var dist = Math.sqrt(dx * dx + dz * dz) || 1;
          var minDist = 30;
          if (dist < minDist) {
            var push = (minDist - dist) * 0.4 / dist;
            ni.tx += dx * push; ni.tz += dz * push;
            nj.tx -= dx * push; nj.tz -= dz * push;
          }
        }
      }
    }
    nodes.forEach(function(n) { n.x = n.tx; n.y = n.ty; n.z = n.tz; });

    // Show shells
    cellShells.visible = true;

    // In cell layout, hide auto/temporal edges — only show explicit biological edges
    var edgeColors = NGV.edgeGeometry.attributes.color.array;
    NGV.edges.forEach(function(e, i) {
      var isExplicit = e.edgeType && e.edgeType !== 'auto' && e.edgeType !== 'temporal';
      if (!isExplicit) {
        edgeColors[i*6] = 0; edgeColors[i*6+1] = 0; edgeColors[i*6+2] = 0;
        edgeColors[i*6+3] = 0; edgeColors[i*6+4] = 0; edgeColors[i*6+5] = 0;
      } else {
        // Make explicit edges brighter
        var srcNode = NGV.nodeMap[e.source];
        var color = srcNode ? NGV.getTypeColor(srcNode) : NGV.TYPE_COLORS.unknown;
        var bright = 0.3 + (e.weight || 0.5) * 0.4;
        edgeColors[i*6] = color.r*bright; edgeColors[i*6+1] = color.g*bright; edgeColors[i*6+2] = color.b*bright;
        edgeColors[i*6+3] = color.r*bright; edgeColors[i*6+4] = color.g*bright; edgeColors[i*6+5] = color.b*bright;
      }
    });
    NGV.edgeGeometry.attributes.color.needsUpdate = true;
  }

  function hideCellShells() {
    cellShells.visible = false;
  }

  function setCellShellsVisible(vis) {
    cellShells.visible = vis;
  }

  function isBiomedicalData() {
    var bioTypes = ['immune_cell', 'cytokine', 'chemokine', 'structural_cell',
      'signaling_pathway', 'antimicrobial_peptide', 'compound', 'clinical_outcome'];
    var bioCats = ['innate', 'adaptive', 'pro-inflammatory', 'intracellular',
      'skin', 'biologic', 'environmental'];
    var score = 0;
    nodes.forEach(function(n) {
      if (bioTypes.indexOf(n.type) >= 0) score++;
      if (bioCats.indexOf(n.category) >= 0) score++;
    });
    return score > nodes.length * 0.3;
  }

  NGV.applyCellLayout = applyCellLayout;
  NGV.hideCellShells = hideCellShells;
  NGV.setCellShellsVisible = setCellShellsVisible;
  NGV.isBiomedicalData = isBiomedicalData;
  NGV.detectCompartment = detectCompartment;
  NGV.compartmentRings = compartmentRings;
})();
