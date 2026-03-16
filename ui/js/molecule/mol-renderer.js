// ═══════════════════════════════════════════════════════════════════
// Molecule Renderer — atom/bond geometry, CPK colors, render modes
// ═══════════════════════════════════════════════════════════════════

window.MolRenderer = (function() {
  'use strict';

  // CPK colors (cyberpunk-enhanced)
  var CPK_COLORS = {
    H: 0xffffff, C: 0x404040, N: 0x3050f8, O: 0xff0d0d, S: 0xffff30,
    P: 0xff8000, F: 0x90e050, Cl: 0x1ff01f, Br: 0xa62929, I: 0x940094,
    Fe: 0xe06633, Ca: 0x3dff00, Na: 0xab5cf2, Mg: 0x8aff00, Zn: 0x7d80b0,
    Cu: 0xc88033, Mn: 0x9c7ac7, Co: 0xf090a0, Ni: 0x50d050, Se: 0xffa100,
    K: 0x8f40d4, DEFAULT: 0xff1493
  };

  // Van der Waals radii
  var VDW_RADII = {
    H: 1.20, C: 1.70, N: 1.55, O: 1.52, S: 1.80, P: 1.80,
    F: 1.47, Cl: 1.75, Br: 1.85, I: 1.98, Fe: 2.00, Ca: 2.31,
    Na: 2.27, Mg: 1.73, Zn: 1.39, Cu: 1.40, DEFAULT: 1.70
  };

  var RENDER_MODES = {
    BALL_AND_STICK: 'ball-and-stick',
    SPACE_FILLING: 'space-filling',
    WIREFRAME: 'wireframe',
    RIBBON: 'ribbon',
    RIBBON_LIGAND: 'ribbon-ligand'
  };

  // Shared geometries
  var atomGeo = null;
  var bondGeo = null;

  function getAtomGeometry() {
    if (!atomGeo) atomGeo = new THREE.IcosahedronGeometry(1, 2);
    return atomGeo;
  }

  function getBondGeometry() {
    if (!bondGeo) bondGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    return bondGeo;
  }

  function getColor(element) {
    return CPK_COLORS[element] !== undefined ? CPK_COLORS[element] : CPK_COLORS.DEFAULT;
  }

  function getRadius(element) {
    return VDW_RADII[element] !== undefined ? VDW_RADII[element] : VDW_RADII.DEFAULT;
  }

  // Build materials cache per element
  var materialCache = {};
  function getAtomMaterial(element) {
    if (!materialCache[element]) {
      var color = getColor(element);
      materialCache[element] = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.55,
        metalness: 0.05
      });
    }
    return materialCache[element];
  }

  function buildBallAndStick(molecule, options) {
    var group = new THREE.Group();
    group.name = 'ball-and-stick';
    var hideH = options && options.hideHydrogens;

    // Group atoms by element for InstancedMesh
    var elementGroups = {};
    var atoms = molecule.atoms;
    for (var i = 0; i < atoms.length; i++) {
      var a = atoms[i];
      if (hideH && a.element === 'H') continue;
      if (!elementGroups[a.element]) elementGroups[a.element] = [];
      elementGroups[a.element].push(a);
    }

    var geo = getAtomGeometry();
    var dummy = new THREE.Object3D();

    // Create instanced meshes per element
    var elements = Object.keys(elementGroups);
    for (var ei = 0; ei < elements.length; ei++) {
      var el = elements[ei];
      var elAtoms = elementGroups[el];
      var mat = getAtomMaterial(el);
      var mesh = new THREE.InstancedMesh(geo, mat, elAtoms.length);
      mesh.name = 'atoms-' + el;
      mesh.userData.element = el;
      mesh.userData.atomIndices = [];

      var radius = getRadius(el) * 0.3;
      for (var ai = 0; ai < elAtoms.length; ai++) {
        var a = elAtoms[ai];
        dummy.position.set(a.x, a.y, a.z);
        dummy.scale.setScalar(radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(ai, dummy.matrix);
        mesh.userData.atomIndices.push(a.index);
      }
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }

    // Bonds
    buildBonds(group, molecule, hideH, 0.08);

    return group;
  }

  function buildSpaceFilling(molecule, options) {
    var group = new THREE.Group();
    group.name = 'space-filling';
    var hideH = options && options.hideHydrogens;

    var elementGroups = {};
    var atoms = molecule.atoms;
    for (var i = 0; i < atoms.length; i++) {
      var a = atoms[i];
      if (hideH && a.element === 'H') continue;
      if (!elementGroups[a.element]) elementGroups[a.element] = [];
      elementGroups[a.element].push(a);
    }

    var geo = getAtomGeometry();
    var dummy = new THREE.Object3D();
    var elements = Object.keys(elementGroups);

    for (var ei = 0; ei < elements.length; ei++) {
      var el = elements[ei];
      var elAtoms = elementGroups[el];
      var mat = getAtomMaterial(el);
      var mesh = new THREE.InstancedMesh(geo, mat, elAtoms.length);
      mesh.name = 'atoms-' + el;
      mesh.userData.element = el;
      mesh.userData.atomIndices = [];

      var radius = getRadius(el);
      for (var ai = 0; ai < elAtoms.length; ai++) {
        var a = elAtoms[ai];
        dummy.position.set(a.x, a.y, a.z);
        dummy.scale.setScalar(radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(ai, dummy.matrix);
        mesh.userData.atomIndices.push(a.index);
      }
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }

    return group;
  }

  function buildWireframe(molecule, options) {
    var group = new THREE.Group();
    group.name = 'wireframe';
    var hideH = options && options.hideHydrogens;

    var atoms = molecule.atoms;
    var bonds = molecule.bonds;
    var positions = [];

    for (var i = 0; i < bonds.length; i++) {
      var b = bonds[i];
      var a1 = atoms[b.atomIndex1];
      var a2 = atoms[b.atomIndex2];
      if (!a1 || !a2) continue;
      if (hideH && (a1.element === 'H' || a2.element === 'H')) continue;

      positions.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z);
    }

    var bufGeo = new THREE.BufferGeometry();
    bufGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    var mat = new THREE.LineBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.8,
      linewidth: 1
    });
    var lines = new THREE.LineSegments(bufGeo, mat);
    lines.name = 'wireframe-lines';
    group.add(lines);

    return group;
  }

  function buildBonds(group, molecule, hideH, radius) {
    var atoms = molecule.atoms;
    var bonds = molecule.bonds;
    if (bonds.length === 0) return;

    var bondRadius = radius || 0.08;
    var geo = getBondGeometry();
    var mat = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.6,
      metalness: 0.05
    });

    // Count valid bonds
    var validBonds = [];
    for (var i = 0; i < bonds.length; i++) {
      var b = bonds[i];
      var a1 = atoms[b.atomIndex1];
      var a2 = atoms[b.atomIndex2];
      if (!a1 || !a2) continue;
      if (hideH && (a1.element === 'H' || a2.element === 'H')) continue;
      validBonds.push(b);
    }

    // Count total instances (double/triple bonds = extra cylinders)
    var totalInstances = 0;
    for (var i = 0; i < validBonds.length; i++) {
      totalInstances += Math.min(validBonds[i].order || 1, 3);
    }

    var mesh = new THREE.InstancedMesh(geo, mat, totalInstances);
    mesh.name = 'bonds';
    var dummy = new THREE.Object3D();
    var instanceIdx = 0;
    var up = new THREE.Vector3(0, 1, 0);
    var dir = new THREE.Vector3();
    var perp = new THREE.Vector3();

    for (var i = 0; i < validBonds.length; i++) {
      var b = validBonds[i];
      var a1 = atoms[b.atomIndex1];
      var a2 = atoms[b.atomIndex2];
      var order = Math.min(b.order || 1, 3);

      var mx = (a1.x + a2.x) * 0.5;
      var my = (a1.y + a2.y) * 0.5;
      var mz = (a1.z + a2.z) * 0.5;

      dir.set(a2.x - a1.x, a2.y - a1.y, a2.z - a1.z);
      var len = dir.length();
      dir.normalize();

      var quat = new THREE.Quaternion();
      quat.setFromUnitVectors(up, dir);

      if (order === 1) {
        dummy.position.set(mx, my, mz);
        dummy.quaternion.copy(quat);
        dummy.scale.set(bondRadius, len, bondRadius);
        dummy.updateMatrix();
        mesh.setMatrixAt(instanceIdx++, dummy.matrix);
      } else {
        // Multi-bond: offset perpendicular
        perp.set(1, 0, 0);
        if (Math.abs(dir.dot(perp)) > 0.9) perp.set(0, 0, 1);
        perp.cross(dir).normalize();

        var offset = bondRadius * 2.5;
        for (var o = 0; o < order; o++) {
          var t = (o - (order - 1) * 0.5) * offset;
          dummy.position.set(mx + perp.x * t, my + perp.y * t, mz + perp.z * t);
          dummy.quaternion.copy(quat);
          dummy.scale.set(bondRadius * 0.7, len, bondRadius * 0.7);
          dummy.updateMatrix();
          mesh.setMatrixAt(instanceIdx++, dummy.matrix);
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  function build(molecule, mode, options) {
    mode = mode || RENDER_MODES.BALL_AND_STICK;
    options = options || {};

    switch (mode) {
      case RENDER_MODES.SPACE_FILLING:
        return buildSpaceFilling(molecule, options);
      case RENDER_MODES.WIREFRAME:
        return buildWireframe(molecule, options);
      case RENDER_MODES.RIBBON:
        if (window.MolRibbon) return window.MolRibbon.build(molecule, options);
        return buildBallAndStick(molecule, options);
      case RENDER_MODES.RIBBON_LIGAND:
        var group = new THREE.Group();
        group.name = 'ribbon-ligand';
        if (window.MolRibbon) group.add(window.MolRibbon.build(molecule, options));
        // Add ball-and-stick for HETATM only
        var ligandMol = filterLigand(molecule);
        if (ligandMol.atoms.length > 0) {
          group.add(buildBallAndStick(ligandMol, options));
        }
        return group;
      default:
        return buildBallAndStick(molecule, options);
    }
  }

  function filterLigand(molecule) {
    // Extract only HETATM atoms (ligands, waters, ions)
    var indexMap = {};
    var atoms = [];
    var bonds = [];
    for (var i = 0; i < molecule.atoms.length; i++) {
      var a = molecule.atoms[i];
      if (a.isHet && a.resName !== 'HOH') {
        indexMap[i] = atoms.length;
        atoms.push(a);
      }
    }
    for (var i = 0; i < molecule.bonds.length; i++) {
      var b = molecule.bonds[i];
      if (indexMap[b.atomIndex1] !== undefined && indexMap[b.atomIndex2] !== undefined) {
        bonds.push({ atomIndex1: indexMap[b.atomIndex1], atomIndex2: indexMap[b.atomIndex2], order: b.order });
      }
    }
    return { atoms: atoms, bonds: bonds, secondaryStructure: molecule.secondaryStructure, meta: molecule.meta };
  }

  function centerMolecule(molecule) {
    if (molecule.atoms.length === 0) return { x: 0, y: 0, z: 0 };
    var cx = 0, cy = 0, cz = 0;
    for (var i = 0; i < molecule.atoms.length; i++) {
      cx += molecule.atoms[i].x;
      cy += molecule.atoms[i].y;
      cz += molecule.atoms[i].z;
    }
    var n = molecule.atoms.length;
    cx /= n; cy /= n; cz /= n;
    for (var i = 0; i < n; i++) {
      molecule.atoms[i].x -= cx;
      molecule.atoms[i].y -= cy;
      molecule.atoms[i].z -= cz;
    }
    return { x: cx, y: cy, z: cz };
  }

  function computeBoundingSphere(molecule) {
    var maxR2 = 0;
    for (var i = 0; i < molecule.atoms.length; i++) {
      var a = molecule.atoms[i];
      var r2 = a.x * a.x + a.y * a.y + a.z * a.z;
      if (r2 > maxR2) maxR2 = r2;
    }
    return Math.sqrt(maxR2);
  }

  return {
    RENDER_MODES: RENDER_MODES,
    CPK_COLORS: CPK_COLORS,
    VDW_RADII: VDW_RADII,
    build: build,
    buildBallAndStick: buildBallAndStick,
    buildSpaceFilling: buildSpaceFilling,
    buildWireframe: buildWireframe,
    centerMolecule: centerMolecule,
    computeBoundingSphere: computeBoundingSphere,
    getColor: getColor,
    getRadius: getRadius,
    getAtomMaterial: getAtomMaterial,
    filterLigand: filterLigand
  };
})();
