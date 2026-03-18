// Neural Graph Visualizer — Scene Module
// Three.js setup, post-processing, animation loop

(function() {
  var graphScale = NGV.graphScale;
  var accentColor = NGV.accentColor;

  var OrbitControls = THREE.OrbitControls;
  var EffectComposer = THREE.EffectComposer;
  var RenderPass = THREE.RenderPass;
  var UnrealBloomPass = THREE.UnrealBloomPass;
  var ShaderPass = THREE.ShaderPass;

  var W = window.innerWidth, H = window.innerHeight;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030508);
  scene.fog = new THREE.FogExp2(0x030508, 0.0008 / graphScale);

  var camera = new THREE.PerspectiveCamera(60, W / H, 1, 5000 * graphScale);
  camera.position.set(0, 150 * graphScale, 500 * graphScale);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.body.prepend(renderer.domElement);
  renderer.domElement.id = 'three-canvas';

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.4;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 50 * graphScale;
  controls.maxDistance = 2000 * graphScale;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.15;

  // Lights
  var accentThree = new THREE.Color(accentColor);
  var ambientLight = new THREE.AmbientLight(0x101520, 2);
  scene.add(ambientLight);

  var pointLight = new THREE.PointLight(accentThree.getHex(), 40, 1200);
  pointLight.position.set(0, 200, 100);
  scene.add(pointLight);

  var pointLight2 = new THREE.PointLight(0xff4081, 20, 800);
  pointLight2.position.set(-200, -100, -200);
  scene.add(pointLight2);

  var dirLight = new THREE.DirectionalLight(0x4060a0, 1);
  dirLight.position.set(100, 300, 200);
  scene.add(dirLight);

  // Post-processing
  var composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  var bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.7, 0.4, 0.25);
  composer.addPass(bloomPass);

  var vignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      darkness: { value: 1.2 },
      offset: { value: 1.0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform float darkness;',
      'uniform float offset;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec4 color = texture2D(tDiffuse, vUv);',
      '  vec2 uv = (vUv - 0.5) * 2.0;',
      '  float vig = 1.0 - dot(uv, uv) * darkness * 0.3;',
      '  vig = clamp(vig, 0.0, 1.0);',
      '  color.rgb *= vig;',
      '  float grain = (fract(sin(dot(vUv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;',
      '  color.rgb += grain;',
      '  gl_FragColor = color;',
      '}',
    ].join('\n'),
  };
  composer.addPass(new ShaderPass(vignetteShader));

  // Holographic grid floor
  var gridMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: accentThree.clone() } },
    vertexShader: [
      'varying vec2 vWorldPos;',
      'void main() {',
      '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = worldPos.xz;',
      '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;',
      'uniform vec3 uColor;',
      'varying vec2 vWorldPos;',
      'void main() {',
      '  vec2 grid = abs(fract(vWorldPos / 40.0 - 0.5) - 0.5) / fwidth(vWorldPos / 40.0);',
      '  float line = min(grid.x, grid.y);',
      '  float alpha = 1.0 - min(line, 1.0);',
      '  float dist = length(vWorldPos) / 600.0;',
      '  alpha *= smoothstep(1.0, 0.2, dist) * 0.12;',
      '  alpha *= 0.8 + 0.2 * sin(uTime * 0.5 + length(vWorldPos) * 0.01);',
      '  gl_FragColor = vec4(uColor, alpha);',
      '}',
    ].join('\n'),
  });
  var gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000 * graphScale, 2000 * graphScale), gridMaterial);
  gridPlane.rotation.x = -Math.PI / 2;
  gridPlane.position.y = -200 * graphScale;
  scene.add(gridPlane);

  // Resize handler
  window.addEventListener('resize', function() {
    W = window.innerWidth; H = window.innerHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    composer.setSize(W, H);
    NGV.W = W; NGV.H = H;
  });

  // Export
  NGV.scene = scene;
  NGV.camera = camera;
  NGV.renderer = renderer;
  NGV.composer = composer;
  NGV.controls = controls;
  NGV.bloomPass = bloomPass;
  NGV.gridMaterial = gridMaterial;
  NGV.accentThree = accentThree;
  NGV.pointLight = pointLight;
  NGV.pointLight2 = pointLight2;
  NGV.W = W;
  NGV.H = H;
})();
