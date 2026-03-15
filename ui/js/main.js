// Neural Graph Visualizer — Main Entry Point
// Wires Three.js scene, interaction, analytics — config-driven

window.addEventListener('error', function(e) {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(255,0,0,0.9);color:#fff;padding:16px;z-index:9999;font:12px monospace;white-space:pre-wrap';
  d.textContent = 'ERROR: ' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || '');
  document.body.appendChild(d);
});

// Three.js globals from script tags
var OrbitControls = THREE.OrbitControls;
var EffectComposer = THREE.EffectComposer;
var RenderPass = THREE.RenderPass;
var UnrealBloomPass = THREE.UnrealBloomPass;
var ShaderPass = THREE.ShaderPass;

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ngvConfig = window.__NGV_CONFIG__ || {};
const accentColor = ngvConfig.accentColor || '#00d2ff';
const nodeTypeDefs = ngvConfig.nodeTypes || {};
const categoryColors = ngvConfig.categoryColors || {};

// Build runtime type colors from config
const TYPE_COLORS = {};
const TYPE_COLORS_RGB = {};
for (const [key, def] of Object.entries(nodeTypeDefs)) {
  const hex = def.color || '#636e72';
  TYPE_COLORS[key] = new THREE.Color(hex);
  const c = TYPE_COLORS[key];
  TYPE_COLORS_RGB[key] = { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
}
TYPE_COLORS.unknown = new THREE.Color(0x636e72);
TYPE_COLORS_RGB.unknown = { r: 99, g: 110, b: 114 };

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hexOf(type) {
  const c = TYPE_COLORS_RGB[type] || TYPE_COLORS_RGB.unknown;
  return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
}

function getTypeColor(node) {
  return TYPE_COLORS[node.type] || TYPE_COLORS[node.nodeType] || TYPE_COLORS.unknown;
}

// ═══════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════

const data = window.__GRAPH_DATA__ || { nodes: [], edges: [] };
const nodes = data.nodes.map(function(n) {
  return Object.assign({}, n, { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, vx: 0, vy: 0, vz: 0, connections: 0, visible: true });
});
const edges = data.edges;

const nodeMap = {};
nodes.forEach(function(n) { nodeMap[n.id] = n; });

const nodeByKey = {};
nodes.forEach(function(n) {
  if (n.path) nodeByKey[n.path] = n;
  if (n.sessionId) nodeByKey[n.sessionId] = n;
});

edges.forEach(function(e) {
  if (nodeMap[e.source]) nodeMap[e.source].connections++;
  if (nodeMap[e.target]) nodeMap[e.target].connections++;
});

const nodeEdgeMap = {};
edges.forEach(function(e, i) {
  if (!nodeEdgeMap[e.source]) nodeEdgeMap[e.source] = [];
  if (!nodeEdgeMap[e.target]) nodeEdgeMap[e.target] = [];
  nodeEdgeMap[e.source].push(i);
  nodeEdgeMap[e.target].push(i);
});

// ═══════════════════════════════════════════════════════════════════
// THREE.JS SCENE
// ═══════════════════════════════════════════════════════════════════

var W = window.innerWidth, H = window.innerHeight;

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x030508);
scene.fog = new THREE.FogExp2(0x030508, 0.0008);

var camera = new THREE.PerspectiveCamera(60, W / H, 1, 5000);
camera.position.set(0, 150, 500);

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
controls.minDistance = 50;
controls.maxDistance = 2000;
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

// ═══════════════════════════════════════════════════════════════════
// POST-PROCESSING (BLOOM)
// ═══════════════════════════════════════════════════════════════════

var composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

var bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 1.2, 0.5, 0.15);
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

// ═══════════════════════════════════════════════════════════════════
// HOLOGRAPHIC GRID FLOOR
// ═══════════════════════════════════════════════════════════════════

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
var gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), gridMaterial);
gridPlane.rotation.x = -Math.PI / 2;
gridPlane.position.y = -200;
scene.add(gridPlane);

// ═══════════════════════════════════════════════════════════════════
// GLOW TEXTURE
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// NODE CREATION
// ═══════════════════════════════════════════════════════════════════

var nodeMeshes = {};
var nodeGroup = new THREE.Group();
scene.add(nodeGroup);

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
    emissiveIntensity: isHex ? 1.8 : 2.2,
    metalness: isHex ? 0.6 : 0.3,
    roughness: isHex ? 0.2 : 0.4,
    transparent: true,
    opacity: 0.9,
  });
}

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

// ═══════════════════════════════════════════════════════════════════
// EDGE CREATION
// ═══════════════════════════════════════════════════════════════════

var edgePositions = new Float32Array(edges.length * 6);
var edgeColors = new Float32Array(edges.length * 6);
var edgeBaseAlphas = new Float32Array(edges.length);

var edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));

var edgeMaterial = new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.6,
  blending: THREE.AdditiveBlending, depthWrite: false,
});

var edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
scene.add(edgeLines);

edges.forEach(function(e, i) {
  var srcNode = nodeMap[e.source];
  var color = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
  var dim = 0.08 + (e.weight || 0.1) * 0.12;
  edgeColors[i*6]   = color.r * dim; edgeColors[i*6+1] = color.g * dim; edgeColors[i*6+2] = color.b * dim;
  edgeColors[i*6+3] = color.r * dim; edgeColors[i*6+4] = color.g * dim; edgeColors[i*6+5] = color.b * dim;
  edgeBaseAlphas[i] = dim;
});

// ═══════════════════════════════════════════════════════════════════
// FLOW PARTICLES (synaptic pulses)
// ═══════════════════════════════════════════════════════════════════

var NUM_FLOW_PARTICLES = 3000;
var flowParticleData = [];
var flowPositions = new Float32Array(NUM_FLOW_PARTICLES * 3);
var flowColors = new Float32Array(NUM_FLOW_PARTICLES * 3);
var flowSizes = new Float32Array(NUM_FLOW_PARTICLES);

for (var fi = 0; fi < NUM_FLOW_PARTICLES; fi++) {
  var ei = edges.length > 0 ? Math.floor(Math.random() * edges.length) : 0;
  flowParticleData.push({ edgeIdx: ei, progress: Math.random(), speed: 0.002 + Math.random() * 0.006 });
  flowPositions[fi*3] = 9999; flowPositions[fi*3+1] = 9999; flowPositions[fi*3+2] = 9999;
  if (edges.length > 0) {
    var srcNode = nodeMap[edges[ei].source];
    var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
    flowColors[fi*3] = c.r; flowColors[fi*3+1] = c.g; flowColors[fi*3+2] = c.b;
  }
  flowSizes[fi] = 1.5 + Math.random() * 1.5;
}

var flowGeo = new THREE.BufferGeometry();
flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPositions, 3));
flowGeo.setAttribute('color', new THREE.BufferAttribute(flowColors, 3));
flowGeo.setAttribute('size', new THREE.BufferAttribute(flowSizes, 1));

var flowMat = new THREE.ShaderMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: {},
  vertexShader: [
    'attribute float size;',
    'attribute vec3 color;',
    'varying vec3 vColor;',
    'void main() {',
    '  vColor = color;',
    '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = size * (200.0 / -mvPos.z);',
    '  gl_Position = projectionMatrix * mvPos;',
    '}',
  ].join('\n'),
  fragmentShader: [
    'varying vec3 vColor;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5);',
    '  if (d > 0.5) discard;',
    '  float alpha = smoothstep(0.5, 0.0, d) * 0.7;',
    '  gl_FragColor = vec4(vColor, alpha);',
    '}',
  ].join('\n'),
});

var flowPoints = new THREE.Points(flowGeo, flowMat);
scene.add(flowPoints);

// ═══════════════════════════════════════════════════════════════════
// AMBIENT DUST PARTICLES
// ═══════════════════════════════════════════════════════════════════

var NUM_DUST = 4000;
var dustPositions = new Float32Array(NUM_DUST * 3);
var dustVelocities = [];

for (var di = 0; di < NUM_DUST; di++) {
  dustPositions[di*3]   = (Math.random() - 0.5) * 1600;
  dustPositions[di*3+1] = (Math.random() - 0.5) * 800;
  dustPositions[di*3+2] = (Math.random() - 0.5) * 1600;
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

// ═══════════════════════════════════════════════════════════════════
// 3D FORCE LAYOUT
// ═══════════════════════════════════════════════════════════════════

function initPositions3D() {
  var projects = {};
  nodes.forEach(function(n) {
    if (!projects[n.project]) projects[n.project] = [];
    projects[n.project].push(n);
  });
  var projKeys = Object.keys(projects);
  var baseR = 150;

  projKeys.forEach(function(proj, pi) {
    var phi = (pi / projKeys.length) * Math.PI * 2;
    var theta = (pi / projKeys.length) * Math.PI * 0.6 + Math.PI * 0.2;
    var cx = Math.cos(phi) * Math.sin(theta) * baseR;
    var cy = (Math.cos(theta) - 0.5) * baseR * 0.3;
    var cz = Math.sin(phi) * Math.sin(theta) * baseR;
    var group = projects[proj];
    var spread = Math.sqrt(group.length) * 6;

    group.forEach(function(n, ni) {
      var a = (ni / group.length) * Math.PI * 2;
      var r = spread * (0.3 + Math.random() * 0.7);
      var elev = (Math.random() - 0.5) * spread * 0.5;
      n.x = cx + Math.cos(a) * r;
      n.y = cy + elev;
      n.z = cz + Math.sin(a) * r;
      n.tx = n.x; n.ty = n.y; n.tz = n.z;
    });
  });
}

function runForceLayout3D(iterations) {
  var N = nodes.length;
  if (N === 0) return;
  var targetRadius = 300;
  var k = targetRadius / Math.pow(N, 1/3) * 1.5;
  var repStr = 0.08;

  var strongEdges = edges.filter(function(e) {
    if (e.edgeType === 'conv-conv') return e.weight >= 0.35;
    return e.weight >= 0.2;
  });

  for (var iter = 0; iter < iterations; iter++) {
    var temp = 1 - iter / iterations;
    var cooling = temp * 3;

    for (var i = 0; i < N; i++) { nodes[i].vx = 0; nodes[i].vy = 0; nodes[i].vz = 0; }

    var cellSize = k * 2;
    var grid = {};
    for (var gi = 0; gi < N; gi++) {
      var n = nodes[gi];
      var gkey = Math.floor(n.x/cellSize)+','+Math.floor(n.y/cellSize)+','+Math.floor(n.z/cellSize);
      if (!grid[gkey]) grid[gkey] = [];
      grid[gkey].push(n);
    }
    for (var ri = 0; ri < N; ri++) {
      var rn = nodes[ri];
      var gx = Math.floor(rn.x/cellSize), gy = Math.floor(rn.y/cellSize), gz = Math.floor(rn.z/cellSize);
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          for (var dz = -1; dz <= 1; dz++) {
            var cell = grid[(gx+dx)+','+(gy+dy)+','+(gz+dz)];
            if (!cell) continue;
            for (var ci = 0; ci < cell.length; ci++) {
              var o = cell[ci];
              if (o === rn) continue;
              var ddx = rn.x - o.x, ddy = rn.y - o.y, ddz = rn.z - o.z;
              var dist = Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz) || 1;
              if (dist > k * 4) continue;
              var force = (k * k) / dist;
              rn.vx += (ddx/dist) * force * repStr;
              rn.vy += (ddy/dist) * force * repStr;
              rn.vz += (ddz/dist) * force * repStr;
            }
          }
        }
      }
    }

    var springK = 0.01;
    for (var si = 0; si < strongEdges.length; si++) {
      var se = strongEdges[si];
      var sa = nodeMap[se.source], sb = nodeMap[se.target];
      if (!sa || !sb) continue;
      var sdx = sb.x - sa.x, sdy = sb.y - sa.y, sdz = sb.z - sa.z;
      var sdist = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz) || 1;
      var sforce = (sdist - k * 0.5) * springK * se.weight;
      var fx = (sdx/sdist)*sforce, fy = (sdy/sdist)*sforce, fz = (sdz/sdist)*sforce;
      sa.vx += fx; sa.vy += fy; sa.vz += fz;
      sb.vx -= fx; sb.vy -= fy; sb.vz -= fz;
    }

    for (var ui = 0; ui < N; ui++) {
      var un = nodes[ui];
      un.vx -= un.x * 0.003; un.vy -= un.y * 0.003; un.vz -= un.z * 0.003;
      un.x += un.vx * cooling; un.y += un.vy * cooling; un.z += un.vz * cooling;
      un.x = Math.max(-400, Math.min(400, un.x));
      un.y = Math.max(-250, Math.min(250, un.y));
      un.z = Math.max(-400, Math.min(400, un.z));
    }
  }

  nodes.forEach(function(n) { n.tx = n.x; n.ty = n.y; n.tz = n.z; });
}

function applyTimelineLayout3D() {
  var projects = {};
  var minTime = Infinity, maxTime = -Infinity;
  nodes.forEach(function(n) {
    if (!n.visible) return;
    if (!projects[n.project]) projects[n.project] = [];
    projects[n.project].push(n);
    var ts = n.startedAt || n.modifiedAt;
    if (ts) {
      var t = new Date(ts).getTime();
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }
  });

  var projKeys = Object.keys(projects).sort();
  var width = 800;
  var timeRange = maxTime - minTime || 1;

  projKeys.forEach(function(proj, pi) {
    var bandZ = (pi - projKeys.length / 2) * 50;
    projects[proj].forEach(function(n) {
      var ts = n.startedAt || n.modifiedAt;
      var t = ts ? new Date(ts).getTime() : (minTime + maxTime) / 2;
      n.tx = ((t - minTime) / timeRange - 0.5) * width;
      n.ty = (Math.random() - 0.5) * 20;
      n.tz = bandZ + (Math.random() - 0.5) * 25;
    });
  });
}

// Initialize layout
initPositions3D();
runForceLayout3D(200);

// Set mesh positions immediately
nodes.forEach(function(n) {
  var mesh = nodeMeshes[n.id];
  if (mesh) mesh.position.set(n.x, n.y, n.z);
});

// ═══════════════════════════════════════════════════════════════════
// INTERACTION STATE
// ═══════════════════════════════════════════════════════════════════

var hoveredNode = null;
var selectedNode = null;
var activeFilter = 'all';
var searchQuery = '';
var activeCategory = 'all';
var activeThread = '';
var activeStatus = 'all';
var layoutMode = 'cluster';
var frame = 0;
var lastInteraction = Date.now();
var activeChartFilter = null;

var raycaster = new THREE.Raycaster();
raycaster.params.Points = { threshold: 5 };
var mouse = new THREE.Vector2();

var highlightGeo = new THREE.IcosahedronGeometry(1, 2);
var highlightMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.15,
  blending: THREE.AdditiveBlending, wireframe: true,
});
var highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
highlightMesh.visible = false;
scene.add(highlightMesh);

// ═══════════════════════════════════════════════════════════════════
// RAYCASTING & HOVER
// ═══════════════════════════════════════════════════════════════════

function getHoveredNode(event) {
  mouse.x = (event.clientX / W) * 2 - 1;
  mouse.y = -(event.clientY / H) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  var coreMeshes = [];
  for (var id in nodeMeshes) {
    var grp = nodeMeshes[id];
    if (!grp.visible) continue;
    var core = grp.userData.coreMesh;
    if (core) coreMeshes.push(core);
  }

  var intersects = raycaster.intersectObjects(coreMeshes, false);
  if (intersects.length > 0) return intersects[0].object.parent.userData.node;
  return null;
}

function highlightEdges(nodeId) {
  edges.forEach(function(e, i) {
    var srcNode = nodeMap[e.source];
    var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
    var dim = edgeBaseAlphas[i];
    edgeColors[i*6] = c.r*dim; edgeColors[i*6+1] = c.g*dim; edgeColors[i*6+2] = c.b*dim;
    edgeColors[i*6+3] = c.r*dim; edgeColors[i*6+4] = c.g*dim; edgeColors[i*6+5] = c.b*dim;
  });

  if (nodeId && nodeEdgeMap[nodeId]) {
    for (var j = 0; j < nodeEdgeMap[nodeId].length; j++) {
      var ei = nodeEdgeMap[nodeId][j];
      var e = edges[ei];
      var srcNode = nodeMap[e.source];
      var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
      edgeColors[ei*6] = c.r; edgeColors[ei*6+1] = c.g; edgeColors[ei*6+2] = c.b;
      edgeColors[ei*6+3] = c.r; edgeColors[ei*6+4] = c.g; edgeColors[ei*6+5] = c.b;
    }
  }

  edgeGeometry.attributes.color.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// PANEL
// ═══════════════════════════════════════════════════════════════════

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

  var projClean = cleanProjectPath(n.project);
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
    })
    .catch(function() {
      document.getElementById('panel-desc').textContent = n.description || '(no description)';
    });

  panel.classList.add('open');
}

function closePanel() {
  selectedNode = null;
  document.getElementById('panel').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════════
// FILTERING
// ═══════════════════════════════════════════════════════════════════

function buildChartMatcher(cf) {
  if (cf.type === 'heatmap') {
    var parts = cf.label.split(' ');
    var dayAbbrs = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var dayIdx = dayAbbrs.indexOf(parts[0]);
    var hr = parts.length > 1 ? parseInt(parts[1]) : -1;
    return function(n) {
      if (!n.modifiedAt) return false;
      var d = new Date(n.modifiedAt);
      if (d.getDay() !== dayIdx) return false;
      if (hr >= 0 && d.getHours() !== hr) return false;
      return true;
    };
  }
  if (cf.type === 'timeline') {
    var weekStart = new Date(cf.label).getTime();
    var weekEnd = weekStart + 7 * 86400000;
    return function(n) {
      if (!n.modifiedAt) return false;
      var t = new Date(n.modifiedAt).getTime();
      return t >= weekStart && t < weekEnd;
    };
  }
  if (cf.type === 'types') {
    return function(n) { return n.type === cf.label || n.nodeType === cf.label; };
  }
  if (cf.type === 'projects') {
    var projLabel = cf.label.toLowerCase();
    return function(n) {
      return cleanProjectPath(n.project).toLowerCase().includes(projLabel);
    };
  }
  return null;
}

function applyFilters() {
  var q = searchQuery.toLowerCase();
  var chartMatch = activeChartFilter ? buildChartMatcher(activeChartFilter) : null;

  nodes.forEach(function(n) {
    var vis = true;
    if (activeFilter !== 'all') {
      if (n.type !== activeFilter && n.nodeType !== activeFilter) vis = false;
    }
    if (q) {
      var matchName = n.name && n.name.toLowerCase().includes(q);
      var matchDesc = n.description && n.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) vis = false;
    }
    if (activeCategory !== 'all' && n.category !== activeCategory) vis = false;
    if (activeThread && n.threadId !== activeThread) vis = false;
    if (activeStatus !== 'all') {
      if ((n.status || 'active') !== activeStatus) vis = false;
    }
    if (chartMatch && vis) vis = chartMatch(n);
    n.visible = vis;
    var mesh = nodeMeshes[n.id];
    if (mesh) mesh.visible = vis;
  });
  updateStats();
}

function updateStats() {
  var visNodes = nodes.filter(function(n) { return n.visible; });
  var typeCount = {};
  visNodes.forEach(function(n) { typeCount[n.type] = (typeCount[n.type] || 0) + 1; });
  var visEdges = edges.filter(function(e) {
    var a = nodeMap[e.source], b = nodeMap[e.target];
    return a && b && a.visible && b.visible;
  }).length;

  var parts = [];
  for (var t in typeCount) {
    var def = nodeTypeDefs[t];
    parts.push('<span>' + typeCount[t] + '</span> ' + (def ? def.label : t));
  }
  parts.push('<span>' + visEdges + '</span> synapses');
  document.getElementById('stats-bar').innerHTML = parts.join(' · ');
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function updateNodePositions() {
  nodes.forEach(function(n) {
    var mesh = nodeMeshes[n.id];
    if (!mesh) return;
    var speed = 0.08;
    var dx = n.tx - n.x, dy = n.ty - n.y, dz = n.tz - n.z;
    if (dx*dx + dy*dy + dz*dz > 1) {
      n.x += dx * speed; n.y += dy * speed; n.z += dz * speed;
    } else {
      n.x = n.tx; n.y = n.ty; n.z = n.tz;
    }
    mesh.position.set(n.x, n.y, n.z);

    if (isHexShape(n)) {
      var core = mesh.userData.coreMesh;
      core.rotation.y += 0.003;
      var ring = mesh.getObjectByName('ring');
      if (ring) ring.rotation.z += 0.005;
    }

    var baseScale = mesh.userData.baseScale;
    var breathe = 1 + Math.sin(frame * 0.015 + n.x * 0.01) * 0.04;
    mesh.userData.coreMesh.scale.setScalar(baseScale * breathe);

    if (n.endedAt) {
      var age = (Date.now() - new Date(n.endedAt).getTime()) / 86400000;
      var alpha = Math.max(0.25, 1 - age / 90);
      mesh.userData.coreMesh.material.opacity = alpha * 0.9;
      mesh.children[1].material.opacity = alpha * 0.2;
    }

    if (n.status === 'archived') {
      mesh.userData.coreMesh.material.opacity *= 0.3;
      mesh.children[1].material.opacity *= 0.2;
    }
  });
}

function updateEdgePositions() {
  var pos = edgeGeometry.attributes.position.array;
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    var a = nodeMap[e.source], b = nodeMap[e.target];
    if (!a || !b || !a.visible || !b.visible) {
      pos[i*6]=9999; pos[i*6+1]=9999; pos[i*6+2]=9999;
      pos[i*6+3]=9999; pos[i*6+4]=9999; pos[i*6+5]=9999;
      continue;
    }
    pos[i*6]=a.x; pos[i*6+1]=a.y; pos[i*6+2]=a.z;
    pos[i*6+3]=b.x; pos[i*6+4]=b.y; pos[i*6+5]=b.z;
  }
  edgeGeometry.attributes.position.needsUpdate = true;
}

function updateFlowParticles() {
  if (edges.length === 0) return;
  var pos = flowGeo.attributes.position.array;
  var cols = flowGeo.attributes.color.array;

  for (var i = 0; i < NUM_FLOW_PARTICLES; i++) {
    var p = flowParticleData[i];
    p.progress += p.speed;
    if (p.progress > 1) {
      p.edgeIdx = Math.floor(Math.random() * edges.length);
      p.progress = 0;
      var srcNode = nodeMap[edges[p.edgeIdx].source];
      var c = srcNode ? getTypeColor(srcNode) : TYPE_COLORS.unknown;
      cols[i*3] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
    }
    var e = edges[p.edgeIdx];
    var a = nodeMap[e.source], b = nodeMap[e.target];
    if (!a || !b || !a.visible || !b.visible) {
      pos[i*3]=9999; pos[i*3+1]=9999; pos[i*3+2]=9999;
      continue;
    }
    var t = p.progress;
    pos[i*3] = a.x + (b.x - a.x) * t;
    pos[i*3+1] = a.y + (b.y - a.y) * t;
    pos[i*3+2] = a.z + (b.z - a.z) * t;
  }
  flowGeo.attributes.position.needsUpdate = true;
  flowGeo.attributes.color.needsUpdate = true;
}

function updateDustParticles() {
  var pos = dustGeo.attributes.position.array;
  for (var i = 0; i < NUM_DUST; i++) {
    var v = dustVelocities[i];
    pos[i*3] += v.x; pos[i*3+1] += v.y; pos[i*3+2] += v.z;
    if (pos[i*3] > 800) pos[i*3] = -800;
    if (pos[i*3] < -800) pos[i*3] = 800;
    if (pos[i*3+1] > 400) pos[i*3+1] = -400;
    if (pos[i*3+1] < -400) pos[i*3+1] = 400;
    if (pos[i*3+2] > 800) pos[i*3+2] = -800;
    if (pos[i*3+2] < -800) pos[i*3+2] = 800;
  }
  dustGeo.attributes.position.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════════

function animate() {
  requestAnimationFrame(animate);
  frame++;

  gridMaterial.uniforms.uTime.value = frame * 0.016;

  var idleTime = Date.now() - lastInteraction;
  controls.autoRotate = idleTime > 4000;
  controls.update();

  updateNodePositions();
  updateEdgePositions();
  if (frame % 2 === 0) updateFlowParticles();
  if (frame % 3 === 0) updateDustParticles();

  if (hoveredNode) {
    highlightMesh.visible = true;
    highlightMesh.position.set(hoveredNode.x, hoveredNode.y, hoveredNode.z);
    var hs = nodeScale(hoveredNode) * 2;
    highlightMesh.scale.setScalar(hs);
    highlightMesh.rotation.x += 0.01;
    highlightMesh.rotation.y += 0.015;
  } else {
    highlightMesh.visible = false;
  }

  pointLight.position.x = Math.sin(frame * 0.003) * 200;
  pointLight.position.z = Math.cos(frame * 0.003) * 200;
  pointLight2.position.x = Math.cos(frame * 0.002) * 300;
  pointLight2.position.z = Math.sin(frame * 0.002) * 300;

  composer.render();
}

// ═══════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

window.addEventListener('resize', function() {
  W = window.innerWidth; H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
  composer.setSize(W, H);
});

renderer.domElement.addEventListener('mousemove', function(e) {
  lastInteraction = Date.now();
  var node = getHoveredNode(e);
  hoveredNode = node;
  renderer.domElement.style.cursor = node ? 'pointer' : 'default';
  if (node) { showTooltip(node, e); highlightEdges(node.id); }
  else { hideTooltip(); highlightEdges(null); }
});

renderer.domElement.addEventListener('click', function(e) {
  lastInteraction = Date.now();
  var node = getHoveredNode(e);
  if (node) {
    openPanel(node);
    var target = new THREE.Vector3(node.x, node.y, node.z);
    controls.target.lerp(target, 0.5);
  }
});

document.getElementById('panel-close').addEventListener('click', closePanel);

document.getElementById('search-box').addEventListener('input', function(e) {
  searchQuery = e.target.value;
  if (activeChartFilter) activeChartFilter = null;
  applyFilters();
});

document.getElementById('category-bar').addEventListener('click', function(e) {
  var btn = e.target.closest('.cat-btn');
  if (!btn) return;
  document.querySelectorAll('.cat-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  activeCategory = btn.dataset.cat;
  applyFilters();
});

document.getElementById('thread-select').addEventListener('change', function(e) {
  activeThread = e.target.value;
  applyFilters();
});

document.querySelectorAll('.status-bar .filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.status-bar .filter-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    applyFilters();
  });
});

// Layout toggle
function toggleLayout() {
  layoutMode = layoutMode === 'cluster' ? 'timeline' : 'cluster';
  var btn = document.getElementById('layout-toggle');
  btn.textContent = layoutMode === 'cluster' ? 'Cluster' : 'Timeline';
  btn.classList.toggle('active', layoutMode === 'timeline');
  if (layoutMode === 'timeline') applyTimelineLayout3D();
  else { initPositions3D(); runForceLayout3D(200); }
}

document.getElementById('layout-toggle').addEventListener('click', toggleLayout);

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════

var analyticsOpen = false;
var chartTooltip = document.getElementById('chart-tooltip');

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
  if (maxLen <= 5) return label.slice(0, maxLen - 1) + '…';
  var half = Math.floor((maxLen - 1) / 2);
  return label.slice(0, half) + '…' + label.slice(-(maxLen - half - 1));
}

function setupCanvas(id, height) {
  var canvas = document.getElementById(id);
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.parentElement.clientWidth;
  canvas.style.width = w + 'px';
  canvas.style.height = height + 'px';
  canvas.width = w * dpr;
  canvas.height = height * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx: ctx, w: w, h: height };
}

function lerpColor(t) {
  var r = Math.round(10 + (0 - 10) * t);
  var g = Math.round(15 + (210 - 15) * t);
  var b = Math.round(20 + (255 - 20) * t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
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

  ctx.font = '8px JetBrains Mono';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (var d = 0; d < 7; d++) {
    ctx.fillStyle = '#3a4a5a';
    ctx.fillText(days[d], labelW - 4, d * cellH + cellH / 2);
    for (var hr = 0; hr < 24; hr++) {
      var t = data.heatmap[d][hr] / maxVal;
      ctx.fillStyle = lerpColor(t);
      ctx.fillRect(labelW + hr * cellW + 1, d * cellH + 1, cellW - 2, cellH - 2);
      if (data.heatmap[d][hr] > 0) {
        ctx.fillStyle = t > 0.5 ? '#030508' : '#5a7a9a';
        ctx.textAlign = 'center';
        ctx.fillText(data.heatmap[d][hr], labelW + hr * cellW + cellW / 2, d * cellH + cellH / 2);
        ctx.textAlign = 'right';
      }
    }
  }
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
  if (data.weeklyTrend.length < 2) {
    ctx.fillStyle = '#2a3a4a'; ctx.font = '10px JetBrains Mono';
    ctx.fillText('Not enough data', w / 2 - 40, h / 2);
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
  if (!entries.length) return;
  var maxVal = Math.max.apply(null, entries.map(function(e) { return e[1]; }).concat([1]));
  var barH = Math.min(16, (h - 4) / entries.length);
  ctx.font = '9px JetBrains Mono';
  var labelW = Math.min(ctx.measureText('W'.repeat(20)).width + 8, w * 0.5);
  var barW = w - labelW - 44;

  entries.forEach(function(entry, i) {
    var y = i * barH + 2;
    ctx.fillStyle = '#7a8a9a'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(smartTruncate(entry[0], 20), labelW - 4, y + barH / 2);
    var bw = (entry[1] / maxVal) * barW;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = typeof colorFn === 'function' ? colorFn(entry[0]) : (colorFn || 'rgba(0,210,255,0.4)');
    ctx.fillRect(labelW, y + 2, bw, barH - 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a7a9a'; ctx.textAlign = 'left';
    ctx.fillText(entry[1], labelW + bw + 4, y + barH / 2);
  });
}

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

// Hook analytics update into applyFilters
var origApplyFilters = applyFilters;
applyFilters = function() {
  origApplyFilters();
  if (analyticsOpen) {
    requestAnimationFrame(doUpdateAnalytics);
  }
};

// Keyboard
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 't' || e.key === 'T') toggleLayout();
  if (e.key === 'a' || e.key === 'A') toggleAnalytics();
  if (e.key === 'Escape') { closePanel(); closeAnalytics(); }
});

// ═══════════════════════════════════════════════════════════════════
// POPULATE UI (config-driven)
// ═══════════════════════════════════════════════════════════════════

// Type filter buttons
(function() {
  var bar = document.getElementById('type-filter-bar');
  var allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.dataset.type = 'all';
  allBtn.textContent = 'All';
  allBtn.style.setProperty('--type-color', accentColor);
  bar.appendChild(allBtn);

  for (var key in nodeTypeDefs) {
    var def = nodeTypeDefs[key];
    var btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.type = key;
    btn.textContent = def.label || key;
    btn.style.setProperty('--type-color', def.color);
    bar.appendChild(btn);
  }

  bar.addEventListener('click', function(e) {
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    bar.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeFilter = btn.dataset.type;
    applyFilters();
  });
})();

// Category buttons
(function() {
  var bar = document.getElementById('category-bar');
  for (var cat in categoryColors) {
    if (cat === 'general') continue;
    var btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat;
    btn.style.setProperty('--cat-color', categoryColors[cat]);
    btn.textContent = cat;
    bar.appendChild(btn);
  }
})();

// Thread dropdown
(function() {
  var sel = document.getElementById('thread-select');
  var threads = new Set();
  nodes.forEach(function(n) { if (n.threadId) threads.add(n.threadId); });
  Array.from(threads).sort().forEach(function(tid) {
    var opt = document.createElement('option');
    opt.value = tid; opt.textContent = tid;
    sel.appendChild(opt);
  });
})();

// Legend
(function() {
  var legend = document.getElementById('legend');
  legend.innerHTML = '';
  for (var key in nodeTypeDefs) {
    var def = nodeTypeDefs[key];
    var item = document.createElement('div');
    item.className = 'legend-item';
    var dot = document.createElement('div');
    dot.className = def.shape === 'hex' ? 'legend-hex' : 'legend-dot';
    dot.style.background = def.color;
    dot.style.color = def.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(def.label || key));
    legend.appendChild(item);
  }
})();

// Logo from config
(function() {
  var logo = document.getElementById('logo-text');
  if (ngvConfig.name) logo.textContent = ngvConfig.name;
  logo.style.color = accentColor;
})();

// Accent color for dynamic elements
(function() {
  var style = document.createElement('style');
  style.textContent = [
    '#header .logo { color: ' + accentColor + '; }',
    '#header .stats span { color: ' + accentColor + '; }',
    '.filter-btn.active { color: ' + accentColor + '; }',
    '.layout-toggle { color: ' + accentColor + '; }',
    '.analytics-toggle { color: ' + accentColor + '; }',
    '.analytics-title { color: ' + accentColor + '; }',
    '#panel .close-btn:hover { color: ' + accentColor + '; }',
  ].join('\n');
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

applyFilters();
animate();
