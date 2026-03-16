// ═══════════════════════════════════════════════════════════════════
// SMILES Parser — tokenize, build graph, generate 2D/3D coordinates
// ═══════════════════════════════════════════════════════════════════

window.MolSMILESParser = (function() {
  'use strict';

  var ORGANIC_SUBSET = { B: 3, C: 4, N: 3, O: 2, P: 3, S: 2, F: 1, Cl: 1, Br: 1, I: 1 };
  var AROMATIC_SET = { b: 'B', c: 'C', n: 'N', o: 'O', p: 'P', s: 'S' };
  var BOND_CHARS = { '-': 1, '=': 2, '#': 3, ':': 1 };

  function tokenize(smiles) {
    var tokens = [];
    var i = 0;
    while (i < smiles.length) {
      var ch = smiles[i];

      // Bracket atom [...]
      if (ch === '[') {
        var j = smiles.indexOf(']', i);
        if (j === -1) j = smiles.length;
        tokens.push({ type: 'atom', value: smiles.substring(i, j + 1), bracket: true });
        i = j + 1;
        continue;
      }

      // Branch
      if (ch === '(' || ch === ')') {
        tokens.push({ type: ch === '(' ? 'branch_open' : 'branch_close' });
        i++; continue;
      }

      // Bond
      if (BOND_CHARS[ch] !== undefined) {
        tokens.push({ type: 'bond', order: BOND_CHARS[ch] });
        i++; continue;
      }

      // Ring closure (digit or %)
      if (ch >= '0' && ch <= '9') {
        tokens.push({ type: 'ring', num: parseInt(ch, 10) });
        i++; continue;
      }
      if (ch === '%' && i + 2 < smiles.length) {
        tokens.push({ type: 'ring', num: parseInt(smiles.substring(i + 1, i + 3), 10) });
        i += 3; continue;
      }

      // Two-letter elements (Cl, Br)
      if (i + 1 < smiles.length) {
        var two = smiles.substring(i, i + 2);
        if (two === 'Cl' || two === 'Br') {
          tokens.push({ type: 'atom', value: two, element: two });
          i += 2; continue;
        }
      }

      // Aromatic
      if (AROMATIC_SET[ch]) {
        tokens.push({ type: 'atom', value: ch, element: AROMATIC_SET[ch], aromatic: true });
        i++; continue;
      }

      // Organic subset single letter
      if (ORGANIC_SUBSET[ch] !== undefined) {
        tokens.push({ type: 'atom', value: ch, element: ch });
        i++; continue;
      }

      // Dot (disconnected)
      if (ch === '.') {
        tokens.push({ type: 'dot' });
        i++; continue;
      }

      // Skip unknown
      i++;
    }
    return tokens;
  }

  function parseBracketAtom(str) {
    // [12C@@H] => { element: 'C', hCount, charge, isotope, chiral }
    var inner = str.substring(1, str.length - 1);
    var idx = 0;
    var isotope = '';
    while (idx < inner.length && inner[idx] >= '0' && inner[idx] <= '9') {
      isotope += inner[idx]; idx++;
    }
    var element = '';
    if (idx < inner.length) {
      // Aromatic lowercase
      if (AROMATIC_SET[inner[idx]]) {
        element = AROMATIC_SET[inner[idx]]; idx++;
      } else {
        element = inner[idx]; idx++;
        if (idx < inner.length && inner[idx] >= 'a' && inner[idx] <= 'z') {
          element += inner[idx]; idx++;
        }
      }
    }
    // Skip chirality
    while (idx < inner.length && inner[idx] === '@') idx++;
    // H count
    var hCount = 0;
    if (idx < inner.length && inner[idx] === 'H') {
      idx++;
      if (idx < inner.length && inner[idx] >= '0' && inner[idx] <= '9') {
        hCount = parseInt(inner[idx], 10); idx++;
      } else {
        hCount = 1;
      }
    }
    return { element: element || 'C', hCount: hCount };
  }

  function buildGraph(tokens) {
    var atoms = [];
    var bonds = [];
    var stack = [];
    var current = -1;
    var pendingBond = 1;
    var ringOpens = {};

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];

      if (tok.type === 'atom') {
        var el, hCount = -1;
        if (tok.bracket) {
          var parsed = parseBracketAtom(tok.value);
          el = parsed.element;
          hCount = parsed.hCount;
        } else {
          el = tok.element || 'C';
        }
        var atomIdx = atoms.length;
        atoms.push({ element: el, aromatic: !!tok.aromatic, hCount: hCount, bonds: [] });

        if (current >= 0) {
          bonds.push({ atomIndex1: current, atomIndex2: atomIdx, order: pendingBond });
          atoms[current].bonds.push(bonds.length - 1);
          atoms[atomIdx].bonds.push(bonds.length - 1);
        }
        current = atomIdx;
        pendingBond = 1;
      }

      else if (tok.type === 'bond') {
        pendingBond = tok.order;
      }

      else if (tok.type === 'branch_open') {
        stack.push(current);
      }

      else if (tok.type === 'branch_close') {
        current = stack.pop();
        pendingBond = 1;
      }

      else if (tok.type === 'ring') {
        if (ringOpens[tok.num] !== undefined) {
          var openAtom = ringOpens[tok.num];
          bonds.push({ atomIndex1: openAtom, atomIndex2: current, order: pendingBond });
          atoms[openAtom].bonds.push(bonds.length - 1);
          atoms[current].bonds.push(bonds.length - 1);
          delete ringOpens[tok.num];
        } else {
          ringOpens[tok.num] = current;
        }
        pendingBond = 1;
      }

      else if (tok.type === 'dot') {
        current = -1;
        pendingBond = 1;
      }
    }

    // Add implicit hydrogens
    addImplicitHydrogens(atoms, bonds);

    return { atoms: atoms, bonds: bonds };
  }

  function addImplicitHydrogens(atoms, bonds) {
    var heavyCount = atoms.length;
    for (var i = 0; i < heavyCount; i++) {
      var a = atoms[i];
      if (a.hCount >= 0) {
        // Explicit H count from bracket atom
        for (var h = 0; h < a.hCount; h++) {
          var hi = atoms.length;
          atoms.push({ element: 'H', aromatic: false, hCount: 0, bonds: [] });
          bonds.push({ atomIndex1: i, atomIndex2: hi, order: 1 });
          atoms[i].bonds.push(bonds.length - 1);
          atoms[hi].bonds.push(bonds.length - 1);
        }
        continue;
      }

      // Compute implicit H for organic subset
      var valence = ORGANIC_SUBSET[a.element];
      if (valence === undefined) continue;
      var bondOrder = 0;
      for (var bi = 0; bi < a.bonds.length; bi++) {
        bondOrder += bonds[a.bonds[bi]].order;
      }
      if (a.aromatic) bondOrder += 1;
      var implicitH = Math.max(0, valence - bondOrder);
      for (var h = 0; h < implicitH; h++) {
        var hi = atoms.length;
        atoms.push({ element: 'H', aromatic: false, hCount: 0, bonds: [] });
        bonds.push({ atomIndex1: i, atomIndex2: hi, order: 1 });
        atoms[i].bonds.push(bonds.length - 1);
        atoms[hi].bonds.push(bonds.length - 1);
      }
    }
  }

  // Find smallest set of smallest rings (SSSR) using BFS
  function findRings(atoms, bonds) {
    var n = atoms.length;
    var adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    for (var i = 0; i < bonds.length; i++) {
      adj[bonds[i].atomIndex1].push(bonds[i].atomIndex2);
      adj[bonds[i].atomIndex2].push(bonds[i].atomIndex1);
    }

    var rings = [];
    var visited = {};

    for (var start = 0; start < n; start++) {
      if (atoms[start].element === 'H') continue;
      // BFS to find shortest rings through this atom
      var parent = new Int32Array(n).fill(-1);
      var dist = new Int32Array(n).fill(-1);
      var queue = [start];
      dist[start] = 0;

      while (queue.length > 0 && rings.length < 50) {
        var u = queue.shift();
        for (var ni = 0; ni < adj[u].length; ni++) {
          var v = adj[u][ni];
          if (dist[v] === -1) {
            dist[v] = dist[u] + 1;
            parent[v] = u;
            if (dist[v] <= 4) queue.push(v);
          } else if (parent[u] !== v && dist[v] + dist[u] + 1 <= 8) {
            // Found a ring
            var ring1 = [], ring2 = [];
            var a = u, b = v;
            while (a !== start && a !== -1) { ring1.push(a); a = parent[a]; }
            ring1.push(start);
            while (b !== start && b !== -1) { ring2.push(b); b = parent[b]; }
            ring2.push(start);
            ring1.reverse();
            var fullRing = ring1.concat(ring2.slice(0, -1).reverse());
            if (fullRing.length >= 3 && fullRing.length <= 8) {
              var key = fullRing.slice().sort().join(',');
              if (!visited[key]) {
                visited[key] = true;
                rings.push(fullRing);
              }
            }
          }
        }
      }
    }
    return rings;
  }

  // 2D coordinate generation
  function generate2DCoords(graphAtoms, graphBonds) {
    var n = graphAtoms.length;
    if (n === 0) return [];

    var coords = [];
    for (var i = 0; i < n; i++) coords.push({ x: 0, y: 0 });

    var bondLength = 1.5;
    var placed = new Uint8Array(n);

    // Build adjacency for heavy atoms
    var heavyAdj = [];
    for (var i = 0; i < n; i++) heavyAdj.push([]);
    for (var i = 0; i < graphBonds.length; i++) {
      var b = graphBonds[i];
      if (graphAtoms[b.atomIndex1].element !== 'H' && graphAtoms[b.atomIndex2].element !== 'H') {
        heavyAdj[b.atomIndex1].push(b.atomIndex2);
        heavyAdj[b.atomIndex2].push(b.atomIndex1);
      }
    }

    // Find rings for ring-aware layout
    var rings = findRings(graphAtoms, graphBonds);

    // Place ring atoms as regular polygons
    var ringPlaced = {};
    for (var ri = 0; ri < rings.length; ri++) {
      var ring = rings[ri];
      var allPlaced = true;
      for (var j = 0; j < ring.length; j++) {
        if (!placed[ring[j]]) { allPlaced = false; break; }
      }
      if (allPlaced) continue;

      // Find center based on already-placed atoms, or use origin
      var cx = 0, cy = 0;
      var hasPlaced = false;
      for (var j = 0; j < ring.length; j++) {
        if (placed[ring[j]]) { cx = coords[ring[j]].x; cy = coords[ring[j]].y; hasPlaced = true; break; }
      }
      if (!hasPlaced && ri > 0) { cx = ri * 3; }

      for (var j = 0; j < ring.length; j++) {
        if (!placed[ring[j]]) {
          var angle = (2 * Math.PI * j / ring.length) - Math.PI / 2;
          var radius = bondLength / (2 * Math.sin(Math.PI / ring.length));
          coords[ring[j]].x = cx + radius * Math.cos(angle);
          coords[ring[j]].y = cy + radius * Math.sin(angle);
          placed[ring[j]] = 1;
          ringPlaced[ring[j]] = true;
        }
      }
    }

    // Place remaining heavy atoms by BFS
    // Find first unplaced heavy atom
    for (var start = 0; start < n; start++) {
      if (graphAtoms[start].element === 'H' || placed[start]) continue;

      placed[start] = 1;
      var queue = [start];
      while (queue.length > 0) {
        var u = queue.shift();
        var neighbors = heavyAdj[u];
        var placedNeighbors = 0;
        for (var ni = 0; ni < neighbors.length; ni++) {
          if (placed[neighbors[ni]]) placedNeighbors++;
        }
        var angleStart = Math.random() * Math.PI * 2;
        var angleStep = (2 * Math.PI) / Math.max(1, neighbors.length - placedNeighbors);
        var angleIdx = 0;

        for (var ni = 0; ni < neighbors.length; ni++) {
          var v = neighbors[ni];
          if (placed[v]) continue;
          var angle = angleStart + angleStep * angleIdx;
          coords[v].x = coords[u].x + bondLength * Math.cos(angle);
          coords[v].y = coords[u].y + bondLength * Math.sin(angle);
          placed[v] = 1;
          angleIdx++;
          queue.push(v);
        }
      }
    }

    // Place hydrogens near their parent
    for (var i = 0; i < graphBonds.length; i++) {
      var b = graphBonds[i];
      var hi = -1, pi = -1;
      if (graphAtoms[b.atomIndex1].element === 'H' && !placed[b.atomIndex1]) { hi = b.atomIndex1; pi = b.atomIndex2; }
      if (graphAtoms[b.atomIndex2].element === 'H' && !placed[b.atomIndex2]) { hi = b.atomIndex2; pi = b.atomIndex1; }
      if (hi >= 0 && pi >= 0) {
        var angle = Math.random() * 2 * Math.PI;
        coords[hi].x = coords[pi].x + 0.8 * Math.cos(angle);
        coords[hi].y = coords[pi].y + 0.8 * Math.sin(angle);
        placed[hi] = 1;
      }
    }

    // Simple force-directed refinement (few iterations)
    for (var iter = 0; iter < 50; iter++) {
      for (var i = 0; i < n; i++) {
        if (ringPlaced[i]) continue;
        var fx = 0, fy = 0;
        // Repulsion from nearby atoms
        for (var j = 0; j < n; j++) {
          if (i === j) continue;
          var dx = coords[i].x - coords[j].x;
          var dy = coords[i].y - coords[j].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 0.01) d2 = 0.01;
          if (d2 < 9) {
            var f = 0.5 / d2;
            fx += dx * f;
            fy += dy * f;
          }
        }
        // Attraction along bonds
        for (var bi = 0; bi < graphAtoms[i].bonds.length; bi++) {
          var bond = graphBonds[graphAtoms[i].bonds[bi]];
          var j = bond.atomIndex1 === i ? bond.atomIndex2 : bond.atomIndex1;
          var dx = coords[j].x - coords[i].x;
          var dy = coords[j].y - coords[i].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0) {
            var target = graphAtoms[i].element === 'H' || graphAtoms[j].element === 'H' ? 0.8 : bondLength;
            var f = (d - target) * 0.1;
            fx += dx / d * f;
            fy += dy / d * f;
          }
        }
        coords[i].x += fx * 0.3;
        coords[i].y += fy * 0.3;
      }
    }

    return coords;
  }

  // Promote 2D coordinates to 3D using tetrahedral geometry and force-directed Z
  function promote3D(coords2D, graphAtoms, graphBonds) {
    var n = coords2D.length;
    var coords = [];
    for (var i = 0; i < n; i++) {
      coords.push({ x: coords2D[i].x, y: coords2D[i].y, z: 0 });
    }

    // Build adjacency
    var adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    for (var i = 0; i < graphBonds.length; i++) {
      var b = graphBonds[i];
      adj[b.atomIndex1].push(b.atomIndex2);
      adj[b.atomIndex2].push(b.atomIndex1);
    }

    // Assign Z based on tetrahedral geometry for sp3 carbons
    // Atoms with 4 bonds (sp3) get alternating Z displacement
    var visited = new Uint8Array(n);
    var queue = [0];
    visited[0] = 1;
    var bondLength = 1.5;
    var tetraZ = bondLength * 0.8; // tetrahedral out-of-plane

    while (queue.length > 0) {
      var u = queue.shift();
      var neighbors = adj[u];
      var uBonds = neighbors.length;
      var isRingAtom = false;

      // Check if atom is in a ring (ring atoms stay planar)
      for (var ni = 0; ni < neighbors.length; ni++) {
        var v = neighbors[ni];
        for (var ni2 = ni + 1; ni2 < neighbors.length; ni2++) {
          var w = neighbors[ni2];
          if (adj[v].indexOf(w) >= 0) { isRingAtom = true; break; }
        }
        if (isRingAtom) break;
      }

      for (var ni = 0; ni < neighbors.length; ni++) {
        var v = neighbors[ni];
        if (visited[v]) continue;
        visited[v] = 1;

        if (graphAtoms[v].element === 'H') {
          // Hydrogens: push out of plane alternating
          coords[v].z = coords[u].z + (ni % 2 === 0 ? tetraZ * 0.5 : -tetraZ * 0.5);
        } else if (!isRingAtom && uBonds >= 3) {
          // sp3 atoms: tetrahedral displacement
          coords[v].z = coords[u].z + (ni % 2 === 0 ? tetraZ : -tetraZ);
        } else {
          // sp2 / ring atoms: slight Z variation based on connectivity
          coords[v].z = coords[u].z + (ni % 2 === 0 ? tetraZ * 0.15 : -tetraZ * 0.15);
        }

        queue.push(v);
      }
    }

    // Force-directed refinement in 3D (few iterations)
    for (var iter = 0; iter < 30; iter++) {
      for (var i = 0; i < n; i++) {
        if (graphAtoms[i].element === 'H') continue;
        var fz = 0;

        // Repulsion in Z from nearby atoms
        for (var j = 0; j < n; j++) {
          if (i === j || graphAtoms[j].element === 'H') continue;
          var dx = coords[i].x - coords[j].x;
          var dy = coords[i].y - coords[j].y;
          var dz = coords[i].z - coords[j].z;
          var d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 4 && d2 > 0.01) {
            fz += dz / d2 * 0.3;
          }
        }

        // Attraction along bonds in Z
        for (var bi = 0; bi < graphAtoms[i].bonds.length; bi++) {
          var bond = graphBonds[graphAtoms[i].bonds[bi]];
          var j = bond.atomIndex1 === i ? bond.atomIndex2 : bond.atomIndex1;
          var dz = coords[j].z - coords[i].z;
          fz += dz * 0.05;
        }

        coords[i].z += fz * 0.2;
      }
    }

    return coords;
  }

  function parse(smiles) {
    var tokens = tokenize(smiles);
    var graph = buildGraph(tokens);

    var coords2D = generate2DCoords(graph.atoms, graph.bonds);
    var coords = promote3D(coords2D, graph.atoms, graph.bonds);

    var atoms = [];
    for (var i = 0; i < graph.atoms.length; i++) {
      var ga = graph.atoms[i];
      var c = coords[i] || { x: 0, y: 0, z: 0 };
      atoms.push({
        index: i,
        serial: i + 1,
        name: ga.element + (i + 1),
        element: ga.element,
        resName: 'LIG',
        chainId: 'A',
        resSeq: 1,
        x: c.x,
        y: c.y,
        z: c.z,
        bfactor: 0,
        isHet: true
      });
    }

    var bonds = [];
    for (var i = 0; i < graph.bonds.length; i++) {
      bonds.push({
        atomIndex1: graph.bonds[i].atomIndex1,
        atomIndex2: graph.bonds[i].atomIndex2,
        order: graph.bonds[i].order
      });
    }

    return {
      atoms: atoms,
      bonds: bonds,
      secondaryStructure: { helices: [], sheets: [] },
      meta: { title: smiles, smiles: smiles }
    };
  }

  return { parse: parse, tokenize: tokenize };
})();
