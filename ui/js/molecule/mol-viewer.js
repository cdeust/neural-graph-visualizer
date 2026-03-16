// ═══════════════════════════════════════════════════════════════════
// Molecule Viewer — Three.js scene, bloom, animation loop
// ═══════════════════════════════════════════════════════════════════

window.MolViewer = (function() {
  'use strict';

  var scene, camera, renderer, composer, controls;
  var container;
  var moleculeGroup = null;
  var currentMolecule = null;
  var currentMode = 'ball-and-stick';
  var currentLabelMode = 'none';
  var hideHydrogens = false;
  var autoRotateEnabled = true;
  var autoRotateTimer = null;
  var lastInteraction = Date.now();
  var clock = new THREE.Clock();
  var animationId = null;

  function init() {
    container = document.getElementById('mol-viewport');
    if (!container) return;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030508);
    scene.fog = new THREE.FogExp2(0x030508, 0.004);

    // Camera
    var W = container.clientWidth;
    var H = container.clientHeight;
    camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
    camera.position.set(0, 0, 30);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // Post-processing
    composer = new THREE.EffectComposer(renderer);
    var renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    var bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(W, H), 0.3, 0.6, 0.85
    );
    composer.addPass(bloomPass);

    // Vignette + grain shader (matches graph aesthetic)
    var vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        darkness: { value: 0.6 },
        offset: { value: 1.0 },
        time: { value: 0 }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform float darkness;',
        'uniform float offset;',
        'uniform float time;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec4 texel = texture2D(tDiffuse, vUv);',
        '  vec2 uv = (vUv - vec2(0.5)) * vec2(offset);',
        '  float vig = 1.0 - dot(uv, uv);',
        '  texel.rgb *= mix(1.0, smoothstep(0.0, 1.0, pow(vig, 0.4)), darkness * 0.5);',
        '  float grain = fract(sin(dot(vUv * time, vec2(12.9898, 78.233))) * 43758.5453);',
        '  texel.rgb += (grain - 0.5) * 0.03;',
        '  gl_FragColor = texel;',
        '}'
      ].join('\n')
    };
    var vignettePass = new THREE.ShaderPass(vignetteShader);
    composer.addPass(vignettePass);

    // Lighting
    var light1 = new THREE.DirectionalLight(0xccddff, 0.8);
    light1.position.set(1, 1, 1);
    scene.add(light1);

    var light2 = new THREE.DirectionalLight(0xff9080, 0.3);
    light2.position.set(-1, -0.5, 0.5);
    scene.add(light2);

    var light3 = new THREE.DirectionalLight(0x4060a0, 0.4);
    light3.position.set(0, -1, -0.5);
    scene.add(light3);

    var ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.0;
    controls.addEventListener('start', function() {
      lastInteraction = Date.now();
      controls.autoRotate = false;
    });

    // Labels renderer
    if (window.MolLabels) {
      window.MolLabels.initRenderer(container);
    }

    // Picker
    if (window.MolPicker) {
      window.MolPicker.init({
        scene: scene,
        camera: camera,
        container: container,
        molecule: null,
        onSelectionChange: function(sel) {
          if (window.MolControls && currentMolecule) {
            window.MolControls.updateSelectionInfo(sel, currentMolecule);
          }
        }
      });
    }

    // Controls panel
    var viewerApi = {
      loadPDB: loadPDB,
      loadSDF: loadSDF,
      loadSMILES: loadSMILES,
      setRenderMode: setRenderMode,
      setLabelMode: setLabelMode,
      setHideHydrogens: setHideHydrogens,
      setAutoRotate: setAutoRotate,
      alignMolecules: alignMolecules,
      setMoleculeVisibility: setMoleculeVisibility
    };
    if (window.MolControls) {
      window.MolControls.init(viewerApi);
    }

    // Resize
    window.addEventListener('resize', onResize);

    // Start animation
    animate();
  }

  function loadPDB(text, name) {
    var molecule = window.MolPDBParser.parse(text);
    if (molecule.atoms.length === 0) return false;
    displayMolecule(molecule, name || molecule.meta.title || 'PDB Structure');
    return true;
  }

  function loadSDF(text, name) {
    var molecule = window.MolSDFParser.parse(text);
    if (molecule.atoms.length === 0) return false;
    displayMolecule(molecule, name || molecule.meta.title || 'SDF Structure');
    return true;
  }

  function loadSMILES(smiles, name) {
    var molecule = window.MolSMILESParser.parse(smiles);
    if (molecule.atoms.length === 0) return false;
    displayMolecule(molecule, name || smiles);
    return true;
  }

  function displayMolecule(molecule, name) {
    try {
      // Center molecule
      window.MolRenderer.centerMolecule(molecule);
      currentMolecule = molecule;

      // Auto-hide hydrogens for large molecules (proteins)
      if (molecule.atoms.length > 500) {
        hideHydrogens = true;
      }

      // Track in superposition manager
      var entry = window.MolSuperpose.addMolecule(molecule, name);

      // Update picker
      if (window.MolPicker) window.MolPicker.setMolecule(molecule);

      // Build geometry
      rebuildGeometry();

      // Fit camera
      fitCamera(molecule);

      // Update UI
      if (window.MolControls) {
        window.MolControls.updateName(name, computeFormula(molecule));
        window.MolControls.updateStats(molecule);
        window.MolControls.updateMoleculeList();
      }

      // Debug: count objects in scene
      var meshCount = 0;
      scene.traverse(function(o) { if (o.isMesh || o.isInstancedMesh || o.isLine || o.isLineSegments) meshCount++; });
      console.log('[mol-viewer] Loaded:', name, '| atoms:', molecule.atoms.length, '| bonds:', molecule.bonds.length, '| scene objects:', meshCount, '| camera z:', camera.position.z.toFixed(1));
    } catch(e) {
      console.error('[mol-viewer] displayMolecule error:', e);
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:48px;left:10px;right:310px;background:rgba(255,0,0,0.9);color:#fff;padding:12px;z-index:9999;font:11px monospace;white-space:pre-wrap;border-radius:4px';
      d.textContent = 'Render error: ' + e.message + '\n' + e.stack;
      document.body.appendChild(d);
    }
  }

  function rebuildGeometry() {
    // Remove old molecule group
    if (moleculeGroup) {
      scene.remove(moleculeGroup);
      disposeMeshes(moleculeGroup);
    }

    if (window.MolLabels) window.MolLabels.clearLabels(scene);

    moleculeGroup = new THREE.Group();
    moleculeGroup.name = 'molecules';

    var mols = window.MolSuperpose.getMolecules();
    var options = { hideHydrogens: hideHydrogens };

    if (mols.length <= 1 && currentMolecule) {
      // Single molecule
      var group = window.MolRenderer.build(currentMolecule, currentMode, options);
      moleculeGroup.add(group);
    } else {
      // Multiple molecules with color tinting
      for (var i = 0; i < mols.length; i++) {
        if (!mols[i].visible) continue;
        var group = window.MolRenderer.build(mols[i].molecule, currentMode, options);
        // Apply color tint for multi-molecule
        if (mols.length > 1) {
          applyColorTint(group, mols[i].color);
        }
        mols[i].group = group;
        moleculeGroup.add(group);
      }
    }

    scene.add(moleculeGroup);

    // Rebuild labels
    if (window.MolLabels && currentMolecule && currentLabelMode !== 'none') {
      window.MolLabels.buildLabels(scene, currentMolecule, currentLabelMode);
    }
  }

  function applyColorTint(group, color) {
    group.traverse(function(obj) {
      if (obj.isMesh && obj.material) {
        var mat = obj.material.clone();
        var tint = new THREE.Color(color);
        var orig = new THREE.Color(mat.color);
        mat.color.copy(orig.lerp(tint, 0.3));
        mat.emissive = new THREE.Color(color);
        mat.emissiveIntensity = 0.2;
        obj.material = mat;
      }
    });
  }

  function fitCamera(molecule) {
    var radius = window.MolRenderer.computeBoundingSphere(molecule);
    var dist = Math.max(radius * 2.5, 10);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    // Light fog scaled to molecule size — keeps distant atoms subtle without washing out
    scene.fog.density = 0.15 / Math.max(dist, 1);
  }

  function setRenderMode(mode) {
    currentMode = mode;
    rebuildGeometry();
  }

  function setLabelMode(mode) {
    currentLabelMode = mode;
    if (window.MolLabels && currentMolecule) {
      window.MolLabels.clearLabels(scene);
      if (mode !== 'none') {
        window.MolLabels.buildLabels(scene, currentMolecule, mode);
      }
    }
  }

  function setHideHydrogens(hide) {
    hideHydrogens = hide;
    rebuildGeometry();
  }

  function setAutoRotate(enabled) {
    autoRotateEnabled = enabled;
    if (!enabled) controls.autoRotate = false;
  }

  function setMoleculeVisibility(index, visible) {
    window.MolSuperpose.setVisibility(index, visible);
    rebuildGeometry();
  }

  function alignMolecules() {
    var mols = window.MolSuperpose.getMolecules();
    if (mols.length < 2) return;

    // Align all to first molecule
    for (var i = 1; i < mols.length; i++) {
      var result = window.MolSuperpose.alignToReference(0, i);
      if (result && window.MolControls) {
        window.MolControls.showRMSD(result.rmsd);
      }
    }

    rebuildGeometry();
  }

  function computeFormula(molecule) {
    var counts = {};
    for (var i = 0; i < molecule.atoms.length; i++) {
      var el = molecule.atoms[i].element;
      counts[el] = (counts[el] || 0) + 1;
    }
    // Hill system: C first, H second, then alphabetical
    var parts = [];
    if (counts.C) { parts.push('C' + (counts.C > 1 ? counts.C : '')); delete counts.C; }
    if (counts.H) { parts.push('H' + (counts.H > 1 ? counts.H : '')); delete counts.H; }
    var remaining = Object.keys(counts).sort();
    for (var i = 0; i < remaining.length; i++) {
      parts.push(remaining[i] + (counts[remaining[i]] > 1 ? counts[remaining[i]] : ''));
    }
    return parts.join('');
  }

  function disposeMeshes(obj) {
    obj.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
  }

  function onResize() {
    if (!container) return;
    var W = container.clientWidth;
    var H = container.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    composer.setSize(W, H);
    if (window.MolLabels) window.MolLabels.resize(W, H);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);

    var dt = clock.getDelta();

    // Auto-rotate after 3s idle
    if (autoRotateEnabled && Date.now() - lastInteraction > 3000) {
      controls.autoRotate = true;
    }

    controls.update();

    // Update vignette time uniform
    var vigPass = composer.passes[2];
    if (vigPass && vigPass.uniforms && vigPass.uniforms.time) {
      vigPass.uniforms.time.value = clock.elapsedTime * 10;
    }

    composer.render();

    // Render labels on top
    if (window.MolLabels) window.MolLabels.render(scene, camera);
  }

  function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    if (window.MolPicker) window.MolPicker.destroy();
    if (moleculeGroup) disposeMeshes(moleculeGroup);
    if (renderer) renderer.dispose();
  }

  return {
    init: init,
    loadPDB: loadPDB,
    loadSDF: loadSDF,
    loadSMILES: loadSMILES,
    setRenderMode: setRenderMode,
    setLabelMode: setLabelMode,
    setHideHydrogens: setHideHydrogens,
    setAutoRotate: setAutoRotate,
    alignMolecules: alignMolecules,
    setMoleculeVisibility: setMoleculeVisibility,
    destroy: destroy
  };
})();
