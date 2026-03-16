// ═══════════════════════════════════════════════════════════════════
// SDF/MOL V2000 Parser
// ═══════════════════════════════════════════════════════════════════

window.MolSDFParser = (function() {
  'use strict';

  function parse(text) {
    var molecules = text.split('$$$$');
    // Parse the first molecule (or only molecule in .mol files)
    return parseMolBlock(molecules[0].trim());
  }

  function parseMolBlock(block) {
    var lines = block.split('\n');
    if (lines.length < 4) return { atoms: [], bonds: [], secondaryStructure: { helices: [], sheets: [] }, meta: {} };

    var meta = {
      title: (lines[0] || '').trim(),
      program: (lines[1] || '').trim(),
      comment: (lines[2] || '').trim()
    };

    // Counts line (line index 3)
    var countsLine = lines[3];
    var atomCount = parseInt(countsLine.substring(0, 3).trim(), 10) || 0;
    var bondCount = parseInt(countsLine.substring(3, 6).trim(), 10) || 0;

    var atoms = [];
    var bonds = [];

    // Parse atom block (starts at line 4)
    for (var i = 0; i < atomCount; i++) {
      var line = lines[4 + i];
      if (!line) continue;

      var x = parseFloat(line.substring(0, 10).trim());
      var y = parseFloat(line.substring(10, 20).trim());
      var z = parseFloat(line.substring(20, 30).trim());
      var element = line.substring(31, 34).trim();

      atoms.push({
        index: i,
        serial: i + 1,
        name: element + (i + 1),
        element: element,
        resName: 'LIG',
        chainId: 'A',
        resSeq: 1,
        x: x, y: y, z: z,
        bfactor: 0,
        isHet: true
      });
    }

    // Parse bond block
    for (var i = 0; i < bondCount; i++) {
      var line = lines[4 + atomCount + i];
      if (!line) continue;

      var a1 = parseInt(line.substring(0, 3).trim(), 10) - 1;
      var a2 = parseInt(line.substring(3, 6).trim(), 10) - 1;
      var order = parseInt(line.substring(6, 9).trim(), 10) || 1;

      // SDF bond type 4 = aromatic
      if (order === 4) order = 1;

      if (a1 >= 0 && a1 < atomCount && a2 >= 0 && a2 < atomCount) {
        bonds.push({ atomIndex1: a1, atomIndex2: a2, order: Math.min(order, 3) });
      }
    }

    // Parse properties block for additional info
    for (var i = 4 + atomCount + bondCount; i < lines.length; i++) {
      var line = lines[i];
      if (line && line.startsWith('M  CHG')) {
        // Could parse charges if needed
      }
      if (line && line.startsWith('M  END')) break;
    }

    return {
      atoms: atoms,
      bonds: bonds,
      secondaryStructure: { helices: [], sheets: [] },
      meta: meta
    };
  }

  return { parse: parse, parseMolBlock: parseMolBlock };
})();
