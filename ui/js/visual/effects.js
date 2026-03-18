// Neural Graph Visualizer — Effects Module
// Dust particles, glass shell

(function() {
  var scene = NGV.scene;
  var camera = NGV.camera;
  var graphScale = NGV.graphScale;
  var accentColor = NGV.accentColor;
  var accentThree = NGV.accentThree;
  var nodes = NGV.nodes;

  // ─── Dust particles ───
  var NUM_DUST = Math.min(6000, Math.round(4000 * graphScale));
  var dustPositions = new Float32Array(NUM_DUST * 3);
  var dustVelocities = [];

  for (var di = 0; di < NUM_DUST; di++) {
    dustPositions[di*3]   = (Math.random() - 0.5) * 1600 * graphScale;
    dustPositions[di*3+1] = (Math.random() - 0.5) * 800 * graphScale;
    dustPositions[di*3+2] = (Math.random() - 0.5) * 1600 * graphScale;
    dustVelocities.push({ x: (Math.random()-0.5)*0.08, y: (Math.random()-0.5)*0.04, z: (Math.random()-0.5)*0.08 });
  }

  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  var dustMat = new THREE.PointsMaterial({
    color: new THREE.Color(accentColor).getHex(),
    size: 0.8, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });

  var dustPoints = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPoints);

  function updateDustParticles() {
    var pos = dustGeo.attributes.position.array;
    var dustBound = 800 * graphScale;
    var dustBoundY = 400 * graphScale;
    for (var i = 0; i < NUM_DUST; i++) {
      var v = dustVelocities[i];
      pos[i*3] += v.x; pos[i*3+1] += v.y; pos[i*3+2] += v.z;
      if (pos[i*3] > dustBound) pos[i*3] = -dustBound;
      if (pos[i*3] < -dustBound) pos[i*3] = dustBound;
      if (pos[i*3+1] > dustBoundY) pos[i*3+1] = -dustBoundY;
      if (pos[i*3+1] < -dustBoundY) pos[i*3+1] = dustBoundY;
      if (pos[i*3+2] > dustBound) pos[i*3+2] = -dustBound;
      if (pos[i*3+2] < -dustBound) pos[i*3+2] = dustBound;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  // ─── Glass shell ───
  var glassShellEnabled = false;
  var glassShellMesh = null;

  function createGlassShell() {
    if (glassShellMesh) { scene.remove(glassShellMesh); glassShellMesh = null; }
    var maxDist = 0;
    nodes.forEach(function(n) {
      var d = Math.sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
      if (d > maxDist) maxDist = d;
    });
    var radius = maxDist * 1.3 + 50;
    var shellGeo = new THREE.IcosahedronGeometry(radius, 3);
    var shellMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: accentThree.clone() },
        uCameraPos: { value: camera.position },
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec3 vWorldPos;',
        'void main() {',
        '  vNormal = normalize(normalMatrix * normal);',
        '  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform vec3 uCameraPos;',
        'varying vec3 vNormal;',
        'varying vec3 vWorldPos;',
        'void main() {',
        '  vec3 viewDir = normalize(uCameraPos - vWorldPos);',
        '  float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);',
        '  gl_FragColor = vec4(uColor, fresnel * 0.12);',
        '}',
      ].join('\n'),
    });
    glassShellMesh = new THREE.Mesh(shellGeo, shellMat);
    glassShellMesh.visible = glassShellEnabled;
    scene.add(glassShellMesh);
  }

  createGlassShell();

  function toggleGlassShell() {
    glassShellEnabled = !glassShellEnabled;
    if (glassShellMesh) glassShellMesh.visible = glassShellEnabled;
    if (glassShellEnabled && !glassShellMesh) createGlassShell();
  }

  function updateGlassShell() {
    if (glassShellMesh && glassShellMesh.visible) {
      glassShellMesh.material.uniforms.uCameraPos.value.copy(camera.position);
    }
  }

  // Export
  NGV.updateDustParticles = updateDustParticles;
  NGV.toggleGlassShell = toggleGlassShell;
  NGV.updateGlassShell = updateGlassShell;
  NGV.glassShellEnabled = function() { return glassShellEnabled; };
})();
