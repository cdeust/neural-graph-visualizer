// Neural Graph Visualizer — Node Visual Module
// Node meshes, halos, badges, glow texture

(function() {
  var nodes = NGV.nodes;
  var nodeTypeDefs = NGV.nodeTypeDefs;
  var getTypeColor = NGV.getTypeColor;
  var scene = NGV.scene;

  // Glow texture
  function createGlowTexture() {
    var s = 128;
    var c = document.createElement('canvas');
    c.width = s; c.height = s;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  var glowTexture = createGlowTexture();

  // Shared geometries
  var sphereGeo = new THREE.IcosahedronGeometry(1, 2);
  var hexGeo = new THREE.CylinderGeometry(1, 1, 0.4, 6);

  function nodeScale(n) {
    if (n.messageCount) {
      var msgFactor = Math.min(Math.log2((n.messageCount || 1) + 1) * 0.8, 3);
      var sizeFactor = Math.min(Math.log2(((n.fileSize || 1024) / 1024) + 1) * 0.5, 2);
      return 2 + msgFactor + sizeFactor * 0.3;
    }
    return 2 + Math.min(n.connections * 0.4, 3.5);
  }

  function isHexShape(n) {
    var typeDef = nodeTypeDefs[n.type] || nodeTypeDefs[n.nodeType];
    return typeDef && typeDef.shape === 'hex';
  }

  function createNodeMaterial(color, isHex) {
    return new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.15),
      emissive: color,
      emissiveIntensity: isHex ? 2.2 : 2.8,
      metalness: isHex ? 0.6 : 0.3,
      roughness: isHex ? 0.2 : 0.4,
      transparent: true,
      opacity: 0.9,
    });
  }

  var nodeMeshes = {};
  var nodeGroup = new THREE.Group();
  scene.add(nodeGroup);

  nodes.forEach(function(n) {
    var color = getTypeColor(n);
    var hex = isHexShape(n);
    var scale = nodeScale(n);

    var group = new THREE.Group();
    var geo = hex ? hexGeo : sphereGeo;
    var mat = createNodeMaterial(color, hex);
    var core = new THREE.Mesh(geo, mat);
    core.scale.setScalar(scale);
    if (hex) core.rotation.y = Math.random() * Math.PI;
    group.add(core);

    var haloMat = new THREE.SpriteMaterial({
      map: glowTexture, color: color,
      transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    var halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(scale * 5);
    group.add(halo);

    if (hex) {
      var ringGeo = new THREE.TorusGeometry(scale * 1.3, 0.08, 8, 6);
      var ringMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.name = 'ring';
      group.add(ring);
    }

    group.userData = { node: n, baseScale: scale, coreMesh: core };
    nodeGroup.add(group);
    nodeMeshes[n.id] = group;
  });

  // Highlight mesh
  var highlightGeo = new THREE.IcosahedronGeometry(1, 2);
  var highlightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, wireframe: true,
  });
  var highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
  highlightMesh.visible = false;
  scene.add(highlightMesh);

  // ─── Badge overlays ───
  function addBadgeOverlays() {
    nodes.forEach(function(n) {
      var mesh = nodeMeshes[n.id];
      if (!mesh) return;
      var scale = mesh.userData.baseScale;

      // Connection count badge (>5 edges)
      if (n.connections > 5) {
        var badgeCanvas = document.createElement('canvas');
        badgeCanvas.width = 48; badgeCanvas.height = 48;
        var bctx = badgeCanvas.getContext('2d');
        bctx.fillStyle = 'rgba(0, 210, 255, 0.8)';
        bctx.beginPath();
        bctx.arc(24, 24, 18, 0, Math.PI * 2);
        bctx.fill();
        bctx.fillStyle = '#fff';
        bctx.font = 'bold 16px sans-serif';
        bctx.textAlign = 'center';
        bctx.textBaseline = 'middle';
        bctx.fillText(n.connections, 24, 24);
        var badgeTex = new THREE.CanvasTexture(badgeCanvas);
        var badgeMat = new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthWrite: false });
        var badge = new THREE.Sprite(badgeMat);
        badge.scale.set(2, 2, 1);
        badge.position.set(scale * 0.8, scale * 0.8, 0);
        badge.name = 'connectionBadge';
        mesh.add(badge);
      }

      // Status dot
      var statusColors = { active: '#26de81', archived: '#576574', pinned: '#ffdd00' };
      var status = n.status || 'active';
      if (statusColors[status]) {
        var dotCanvas = document.createElement('canvas');
        dotCanvas.width = 16; dotCanvas.height = 16;
        var dctx = dotCanvas.getContext('2d');
        dctx.fillStyle = statusColors[status];
        dctx.beginPath();
        dctx.arc(8, 8, 6, 0, Math.PI * 2);
        dctx.fill();
        var dotTex = new THREE.CanvasTexture(dotCanvas);
        var dotMat = new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false });
        var dot = new THREE.Sprite(dotMat);
        dot.scale.set(1, 1, 1);
        dot.position.set(-scale * 0.8, scale * 0.8, 0);
        dot.name = 'statusDot';
        mesh.add(dot);
      }
    });
  }

  addBadgeOverlays();

  // Export
  NGV.nodeMeshes = nodeMeshes;
  NGV.nodeGroup = nodeGroup;
  NGV.nodeScale = nodeScale;
  NGV.isHexShape = isHexShape;
  NGV.highlightMesh = highlightMesh;
  NGV.glowTexture = glowTexture;
})();
