// ═══════════════════════════════════════════════════════════════════
// Multi-Molecule Superposition — Kabsch alignment + overlay
// ═══════════════════════════════════════════════════════════════════

window.MolSuperpose = (function() {
  'use strict';

  var MOLECULE_COLORS = [
    0x00d2ff,  // cyan
    0xff00ff,  // magenta
    0xffd700,  // gold
    0x26de81,  // green
    0xff6b6b,  // red
    0xab5cf2   // purple
  ];

  var loadedMolecules = [];

  function addMolecule(molecule, name) {
    var colorIndex = loadedMolecules.length % MOLECULE_COLORS.length;
    var entry = {
      molecule: molecule,
      name: name || ('Molecule ' + (loadedMolecules.length + 1)),
      color: MOLECULE_COLORS[colorIndex],
      visible: true,
      group: null,
      aligned: false
    };
    loadedMolecules.push(entry);
    return entry;
  }

  function getMolecules() {
    return loadedMolecules;
  }

  function removeMolecule(index) {
    if (index >= 0 && index < loadedMolecules.length) {
      loadedMolecules.splice(index, 1);
    }
  }

  function clear() {
    loadedMolecules = [];
  }

  function setVisibility(index, visible) {
    if (loadedMolecules[index]) {
      loadedMolecules[index].visible = visible;
      if (loadedMolecules[index].group) {
        loadedMolecules[index].group.visible = visible;
      }
    }
  }

  // Kabsch algorithm for optimal rotation
  function kabschAlign(refAtoms, movAtoms) {
    // Select common atoms: use CA for proteins, all heavy atoms for small molecules
    var refPoints = selectAlignmentAtoms(refAtoms);
    var movPoints = selectAlignmentAtoms(movAtoms);

    var n = Math.min(refPoints.length, movPoints.length);
    if (n < 3) return { rotation: null, translation: null, rmsd: Infinity };

    // Compute centroids
    var refCentroid = computeCentroid(refPoints, n);
    var movCentroid = computeCentroid(movPoints, n);

    // Center points
    var P = []; // ref, centered
    var Q = []; // mov, centered
    for (var i = 0; i < n; i++) {
      P.push([
        refPoints[i].x - refCentroid.x,
        refPoints[i].y - refCentroid.y,
        refPoints[i].z - refCentroid.z
      ]);
      Q.push([
        movPoints[i].x - movCentroid.x,
        movPoints[i].y - movCentroid.y,
        movPoints[i].z - movCentroid.z
      ]);
    }

    // Cross-covariance matrix H = P^T * Q (3x3)
    var H = [[0,0,0],[0,0,0],[0,0,0]];
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < 3; j++) {
        for (var k = 0; k < 3; k++) {
          H[j][k] += Q[i][j] * P[i][k];
        }
      }
    }

    // SVD of H using Jacobi iterations
    var svd = svd3x3(H);

    // R = V * U^T
    var R = matMul3(svd.V, transpose3(svd.U));

    // Check for reflection
    if (det3(R) < 0) {
      svd.V[0][2] *= -1;
      svd.V[1][2] *= -1;
      svd.V[2][2] *= -1;
      R = matMul3(svd.V, transpose3(svd.U));
    }

    // Compute RMSD after alignment
    var rmsd = 0;
    for (var i = 0; i < n; i++) {
      var rx = R[0][0]*Q[i][0] + R[0][1]*Q[i][1] + R[0][2]*Q[i][2];
      var ry = R[1][0]*Q[i][0] + R[1][1]*Q[i][1] + R[1][2]*Q[i][2];
      var rz = R[2][0]*Q[i][0] + R[2][1]*Q[i][1] + R[2][2]*Q[i][2];
      rmsd += Math.pow(rx - P[i][0], 2) + Math.pow(ry - P[i][1], 2) + Math.pow(rz - P[i][2], 2);
    }
    rmsd = Math.sqrt(rmsd / n);

    return {
      rotation: R,
      refCentroid: refCentroid,
      movCentroid: movCentroid,
      rmsd: rmsd
    };
  }

  function selectAlignmentAtoms(atoms) {
    // Prefer CA atoms for proteins
    var caAtoms = [];
    var heavyAtoms = [];
    for (var i = 0; i < atoms.length; i++) {
      if (atoms[i].name === 'CA') caAtoms.push(atoms[i]);
      if (atoms[i].element !== 'H') heavyAtoms.push(atoms[i]);
    }
    return caAtoms.length >= 3 ? caAtoms : heavyAtoms;
  }

  function computeCentroid(points, n) {
    var cx = 0, cy = 0, cz = 0;
    for (var i = 0; i < n; i++) {
      cx += points[i].x; cy += points[i].y; cz += points[i].z;
    }
    return { x: cx / n, y: cy / n, z: cz / n };
  }

  function applyAlignment(molecule, alignment) {
    if (!alignment.rotation) return;
    var R = alignment.rotation;
    var rc = alignment.refCentroid;
    var mc = alignment.movCentroid;

    for (var i = 0; i < molecule.atoms.length; i++) {
      var a = molecule.atoms[i];
      // Center on mov centroid
      var x = a.x - mc.x;
      var y = a.y - mc.y;
      var z = a.z - mc.z;
      // Rotate
      a.x = R[0][0]*x + R[0][1]*y + R[0][2]*z + rc.x;
      a.y = R[1][0]*x + R[1][1]*y + R[1][2]*z + rc.y;
      a.z = R[2][0]*x + R[2][1]*y + R[2][2]*z + rc.z;
    }
  }

  function alignToReference(refIndex, movIndex) {
    if (!loadedMolecules[refIndex] || !loadedMolecules[movIndex]) return null;
    var ref = loadedMolecules[refIndex].molecule;
    var mov = loadedMolecules[movIndex].molecule;

    var alignment = kabschAlign(ref.atoms, mov.atoms);
    if (alignment.rotation) {
      applyAlignment(mov, alignment);
      loadedMolecules[movIndex].aligned = true;
    }
    return alignment;
  }

  // ── Simple 3x3 SVD via Jacobi rotations ──

  function svd3x3(A) {
    // Compute A^T * A
    var AtA = matMul3(transpose3(A), A);

    // Eigendecomposition of AtA via Jacobi
    var eig = jacobi3(AtA);
    var sigma = [Math.sqrt(Math.max(0, eig.eigenvalues[0])),
                 Math.sqrt(Math.max(0, eig.eigenvalues[1])),
                 Math.sqrt(Math.max(0, eig.eigenvalues[2]))];

    var V = eig.eigenvectors;

    // U = A * V * Sigma^-1
    var AV = matMul3(A, V);
    var U = [[0,0,0],[0,0,0],[0,0,0]];
    for (var i = 0; i < 3; i++) {
      var s = sigma[i] > 1e-10 ? 1.0 / sigma[i] : 0;
      for (var j = 0; j < 3; j++) {
        U[j][i] = AV[j][i] * s;
      }
    }

    return { U: U, S: sigma, V: V };
  }

  function jacobi3(A) {
    var a = [[A[0][0],A[0][1],A[0][2]],[A[1][0],A[1][1],A[1][2]],[A[2][0],A[2][1],A[2][2]]];
    var v = [[1,0,0],[0,1,0],[0,0,1]];

    for (var iter = 0; iter < 50; iter++) {
      // Find largest off-diagonal
      var p = 0, q = 1;
      var maxVal = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > maxVal) { maxVal = Math.abs(a[0][2]); p = 0; q = 2; }
      if (Math.abs(a[1][2]) > maxVal) { maxVal = Math.abs(a[1][2]); p = 1; q = 2; }
      if (maxVal < 1e-12) break;

      var theta = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      var c = Math.cos(theta), s = Math.sin(theta);

      // Rotate a
      var newA = [[0,0,0],[0,0,0],[0,0,0]];
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) newA[i][j] = a[i][j];

      newA[p][p] = c*c*a[p][p] - 2*s*c*a[p][q] + s*s*a[q][q];
      newA[q][q] = s*s*a[p][p] + 2*s*c*a[p][q] + c*c*a[q][q];
      newA[p][q] = newA[q][p] = 0;

      for (var i = 0; i < 3; i++) {
        if (i !== p && i !== q) {
          newA[i][p] = newA[p][i] = c*a[i][p] - s*a[i][q];
          newA[i][q] = newA[q][i] = s*a[i][p] + c*a[i][q];
        }
      }
      a = newA;

      // Rotate v
      for (var i = 0; i < 3; i++) {
        var vip = v[i][p], viq = v[i][q];
        v[i][p] = c*vip - s*viq;
        v[i][q] = s*vip + c*viq;
      }
    }

    return { eigenvalues: [a[0][0], a[1][1], a[2][2]], eigenvectors: v };
  }

  function transpose3(M) {
    return [
      [M[0][0], M[1][0], M[2][0]],
      [M[0][1], M[1][1], M[2][1]],
      [M[0][2], M[1][2], M[2][2]]
    ];
  }

  function matMul3(A, B) {
    var R = [[0,0,0],[0,0,0],[0,0,0]];
    for (var i = 0; i < 3; i++)
      for (var j = 0; j < 3; j++)
        for (var k = 0; k < 3; k++)
          R[i][j] += A[i][k] * B[k][j];
    return R;
  }

  function det3(M) {
    return M[0][0]*(M[1][1]*M[2][2] - M[1][2]*M[2][1])
         - M[0][1]*(M[1][0]*M[2][2] - M[1][2]*M[2][0])
         + M[0][2]*(M[1][0]*M[2][1] - M[1][1]*M[2][0]);
  }

  return {
    addMolecule: addMolecule,
    getMolecules: getMolecules,
    removeMolecule: removeMolecule,
    clear: clear,
    setVisibility: setVisibility,
    kabschAlign: kabschAlign,
    applyAlignment: applyAlignment,
    alignToReference: alignToReference,
    MOLECULE_COLORS: MOLECULE_COLORS
  };
})();
