// ═══════════════════════════════════════════════════════════════════
// PDB Parser — ATOM/HETATM/CONECT/HELIX/SHEET
// ═══════════════════════════════════════════════════════════════════

window.MolPDBParser = (function() {
  'use strict';

  // Covalent radii (Angstroms) for bond detection fallback
  var COVALENT_RADII = {
    H: 0.31, He: 0.28, Li: 1.28, Be: 0.96, B: 0.84, C: 0.76, N: 0.71,
    O: 0.66, F: 0.57, Ne: 0.58, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11,
    P: 1.07, S: 1.05, Cl: 1.02, Ar: 1.06, K: 2.03, Ca: 1.76, Fe: 1.32,
    Zn: 1.22, Br: 1.20, I: 1.39, Se: 1.20, Cu: 1.32, Mn: 1.39, Co: 1.26,
    Ni: 1.24, Mo: 1.54
  };

  var BOND_TOLERANCE = 0.4;

  function parseElement(line) {
    // PDB element is columns 77-78, fallback to atom name
    var el = line.substring(76, 78).trim();
    if (!el) {
      el = line.substring(12, 16).trim().replace(/[0-9]/g, '');
      if (el.length > 1) el = el[0] + el.substring(1).toLowerCase();
    }
    if (el.length > 2) el = el.substring(0, 2);
    if (el.length === 2 && !'HeLiBeNeNaMgAlSiClArCaFeCuZnBrSeMnCoNiMoAs'.includes(el)) {
      el = el[0];
    }
    return el || 'C';
  }

  function parse(text) {
    var lines = text.split('\n');
    var atoms = [];
    var bonds = [];
    var helices = [];
    var sheets = [];
    var conectMap = {};
    var meta = { title: '', compound: '' };
    var serialToIndex = {};

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length < 6) continue;
      var record = line.substring(0, 6).trim();

      if (record === 'ATOM' || record === 'HETATM') {
        var serial = parseInt(line.substring(6, 11).trim(), 10);
        var atomName = line.substring(12, 16).trim();
        var resName = line.substring(17, 20).trim();
        var chainId = line.substring(21, 22).trim() || 'A';
        var resSeq = parseInt(line.substring(22, 26).trim(), 10) || 0;
        var x = parseFloat(line.substring(30, 38).trim());
        var y = parseFloat(line.substring(38, 46).trim());
        var z = parseFloat(line.substring(46, 54).trim());
        var bfactor = parseFloat(line.substring(60, 66).trim()) || 0;
        var element = parseElement(line);

        var idx = atoms.length;
        serialToIndex[serial] = idx;

        atoms.push({
          index: idx,
          serial: serial,
          name: atomName,
          element: element,
          resName: resName,
          chainId: chainId,
          resSeq: resSeq,
          x: x, y: y, z: z,
          bfactor: bfactor,
          isHet: record === 'HETATM'
        });
      }

      else if (record === 'CONECT') {
        var srcSerial = parseInt(line.substring(6, 11).trim(), 10);
        for (var j = 11; j < Math.min(line.length, 31); j += 5) {
          var tgtSerial = parseInt(line.substring(j, j + 5).trim(), 10);
          if (!isNaN(tgtSerial) && tgtSerial > 0) {
            var key = Math.min(srcSerial, tgtSerial) + '-' + Math.max(srcSerial, tgtSerial);
            if (!conectMap[key]) {
              conectMap[key] = { src: srcSerial, tgt: tgtSerial, order: 1 };
            } else {
              conectMap[key].order++;
            }
          }
        }
      }

      else if (record === 'HELIX') {
        helices.push({
          chainId: line.substring(19, 20).trim(),
          startSeq: parseInt(line.substring(21, 25).trim(), 10),
          endSeq: parseInt(line.substring(33, 37).trim(), 10)
        });
      }

      else if (record === 'SHEET') {
        sheets.push({
          chainId: line.substring(21, 22).trim(),
          startSeq: parseInt(line.substring(22, 26).trim(), 10),
          endSeq: parseInt(line.substring(33, 37).trim(), 10)
        });
      }

      else if (record === 'TITLE') {
        meta.title += line.substring(10).trim() + ' ';
      }

      else if (record === 'COMPND') {
        meta.compound += line.substring(10).trim() + ' ';
      }
    }

    // Convert CONECT records to bonds
    var conectKeys = Object.keys(conectMap);
    for (var k = 0; k < conectKeys.length; k++) {
      var bond = conectMap[conectKeys[k]];
      var ai = serialToIndex[bond.src];
      var bi = serialToIndex[bond.tgt];
      if (ai !== undefined && bi !== undefined) {
        bonds.push({ atomIndex1: ai, atomIndex2: bi, order: Math.min(bond.order, 3) });
      }
    }

    // Fallback: detect bonds by distance if no CONECT records
    if (bonds.length === 0 && atoms.length > 0 && atoms.length < 20000) {
      bonds = detectBondsByDistance(atoms);
    }

    meta.title = meta.title.trim();
    meta.compound = meta.compound.trim();

    return {
      atoms: atoms,
      bonds: bonds,
      secondaryStructure: { helices: helices, sheets: sheets },
      meta: meta
    };
  }

  function detectBondsByDistance(atoms) {
    var bonds = [];
    var n = atoms.length;
    // Build spatial grid for performance
    var cellSize = 2.5;
    var grid = {};

    for (var i = 0; i < n; i++) {
      var a = atoms[i];
      var cx = Math.floor(a.x / cellSize);
      var cy = Math.floor(a.y / cellSize);
      var cz = Math.floor(a.z / cellSize);
      var key = cx + ',' + cy + ',' + cz;
      if (!grid[key]) grid[key] = [];
      grid[key].push(i);
    }

    for (var i = 0; i < n; i++) {
      var a = atoms[i];
      var ra = COVALENT_RADII[a.element] || 1.5;
      var cx = Math.floor(a.x / cellSize);
      var cy = Math.floor(a.y / cellSize);
      var cz = Math.floor(a.z / cellSize);

      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          for (var dz = -1; dz <= 1; dz++) {
            var nkey = (cx + dx) + ',' + (cy + dy) + ',' + (cz + dz);
            var cell = grid[nkey];
            if (!cell) continue;
            for (var ci = 0; ci < cell.length; ci++) {
              var j = cell[ci];
              if (j <= i) continue;
              var b = atoms[j];
              var rb = COVALENT_RADII[b.element] || 1.5;
              var maxDist = ra + rb + BOND_TOLERANCE;
              var ddx = a.x - b.x, ddy = a.y - b.y, ddz = a.z - b.z;
              var dist2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (dist2 < maxDist * maxDist && dist2 > 0.16) {
                bonds.push({ atomIndex1: i, atomIndex2: j, order: 1 });
              }
            }
          }
        }
      }
    }
    return bonds;
  }

  return { parse: parse, detectBondsByDistance: detectBondsByDistance };
})();
