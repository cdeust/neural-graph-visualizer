// ═══════════════════════════════════════════════════════════════════
// Protein Ribbon / Cartoon — secondary structure visualization
// ═══════════════════════════════════════════════════════════════════

window.MolRibbon = (function() {
  'use strict';

  var HELIX_COLOR = 0x00d2ff;  // cyan
  var SHEET_COLOR = 0xff00ff;  // magenta
  var COIL_COLOR = 0x606060;   // gray

  var HELIX_WIDTH = 1.5;
  var SHEET_WIDTH = 1.8;
  var COIL_WIDTH = 0.3;
  var SAMPLES_PER_RESIDUE = 10;

  function getSecondaryType(resSeq, chainId, ss) {
    for (var i = 0; i < ss.helices.length; i++) {
      var h = ss.helices[i];
      if (h.chainId === chainId && resSeq >= h.startSeq && resSeq <= h.endSeq) return 'helix';
    }
    for (var i = 0; i < ss.sheets.length; i++) {
      var s = ss.sheets[i];
      if (s.chainId === chainId && resSeq >= s.startSeq && resSeq <= s.endSeq) return 'sheet';
    }
    return 'coil';
  }

  function extractBackbone(molecule) {
    var chains = {};
    var atoms = molecule.atoms;

    for (var i = 0; i < atoms.length; i++) {
      var a = atoms[i];
      if (a.name !== 'CA') continue;
      if (!chains[a.chainId]) chains[a.chainId] = [];
      chains[a.chainId].push({
        resSeq: a.resSeq,
        resName: a.resName,
        x: a.x, y: a.y, z: a.z,
        ssType: getSecondaryType(a.resSeq, a.chainId, molecule.secondaryStructure)
      });
    }

    // Sort by residue sequence
    var chainIds = Object.keys(chains);
    for (var ci = 0; ci < chainIds.length; ci++) {
      chains[chainIds[ci]].sort(function(a, b) { return a.resSeq - b.resSeq; });
    }

    return chains;
  }

  function buildSpline(caAtoms) {
    if (caAtoms.length < 2) return null;

    var points = [];
    for (var i = 0; i < caAtoms.length; i++) {
      points.push(new THREE.Vector3(caAtoms[i].x, caAtoms[i].y, caAtoms[i].z));
    }

    var curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    var totalSamples = caAtoms.length * SAMPLES_PER_RESIDUE;
    var splinePoints = curve.getPoints(totalSamples);
    var tangents = [];
    for (var i = 0; i < splinePoints.length; i++) {
      tangents.push(curve.getTangentAt(i / totalSamples));
    }

    return { points: splinePoints, tangents: tangents, totalSamples: totalSamples };
  }

  function getSsAtSample(sampleIdx, totalSamples, caAtoms) {
    var residueIdx = Math.min(
      Math.floor(sampleIdx / SAMPLES_PER_RESIDUE),
      caAtoms.length - 1
    );
    return caAtoms[residueIdx].ssType;
  }

  function getColorAtSample(sampleIdx, totalSamples, caAtoms, useRainbow) {
    if (useRainbow) {
      var t = sampleIdx / totalSamples;
      var color = new THREE.Color();
      color.setHSL(t * 0.8, 0.8, 0.5);
      return color;
    }
    var ss = getSsAtSample(sampleIdx, totalSamples, caAtoms);
    if (ss === 'helix') return new THREE.Color(HELIX_COLOR);
    if (ss === 'sheet') return new THREE.Color(SHEET_COLOR);
    return new THREE.Color(COIL_COLOR);
  }

  function getWidthAtSample(sampleIdx, totalSamples, caAtoms) {
    var ss = getSsAtSample(sampleIdx, totalSamples, caAtoms);
    if (ss === 'helix') return HELIX_WIDTH;
    if (ss === 'sheet') return SHEET_WIDTH;
    return COIL_WIDTH;
  }

  function buildRibbonGeometry(spline, caAtoms, useRainbow) {
    var points = spline.points;
    var tangents = spline.tangents;
    var n = points.length;

    // Build Frenet frames
    var normals = [];
    var binormals = [];
    var refNormal = new THREE.Vector3(0, 1, 0);

    for (var i = 0; i < n; i++) {
      var t = tangents[i].clone().normalize();
      var b = new THREE.Vector3().crossVectors(t, refNormal).normalize();
      if (b.length() < 0.001) {
        refNormal.set(1, 0, 0);
        b.crossVectors(t, refNormal).normalize();
      }
      var norm = new THREE.Vector3().crossVectors(b, t).normalize();
      normals.push(norm);
      binormals.push(b);
      refNormal.copy(norm);
    }

    // Build ribbon as flat quad strip
    var positions = [];
    var normalsArr = [];
    var colors = [];
    var indices = [];

    for (var i = 0; i < n; i++) {
      var width = getWidthAtSample(i, spline.totalSamples, caAtoms) * 0.5;
      var color = getColorAtSample(i, spline.totalSamples, caAtoms, useRainbow);
      var p = points[i];
      var bn = binormals[i];
      var nm = normals[i];

      // Two vertices per sample (left and right of ribbon)
      positions.push(
        p.x + bn.x * width, p.y + bn.y * width, p.z + bn.z * width,
        p.x - bn.x * width, p.y - bn.y * width, p.z - bn.z * width
      );
      normalsArr.push(nm.x, nm.y, nm.z, nm.x, nm.y, nm.z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      if (i > 0) {
        var v = (i - 1) * 2;
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalsArr, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }

  function build(molecule, options) {
    var group = new THREE.Group();
    group.name = 'ribbon';
    var useRainbow = options && options.rainbowChain;

    var chains = extractBackbone(molecule);
    var chainIds = Object.keys(chains);

    if (chainIds.length === 0) {
      // No backbone found, fall back to ball-and-stick
      return window.MolRenderer.buildBallAndStick(molecule, options);
    }

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x111111,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide
    });

    for (var ci = 0; ci < chainIds.length; ci++) {
      var caAtoms = chains[chainIds[ci]];
      if (caAtoms.length < 4) continue;

      var spline = buildSpline(caAtoms);
      if (!spline) continue;

      var geo = buildRibbonGeometry(spline, caAtoms, useRainbow);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'ribbon-chain-' + chainIds[ci];
      group.add(mesh);
    }

    return group;
  }

  return {
    build: build,
    extractBackbone: extractBackbone,
    HELIX_COLOR: HELIX_COLOR,
    SHEET_COLOR: SHEET_COLOR,
    COIL_COLOR: COIL_COLOR
  };
})();
