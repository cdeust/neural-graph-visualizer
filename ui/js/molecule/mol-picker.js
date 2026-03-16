// ═══════════════════════════════════════════════════════════════════
// Atom Picker — raycasting, hover, selection, measurements
// ═══════════════════════════════════════════════════════════════════

window.MolPicker = (function() {
  'use strict';

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var selectedAtoms = [];
  var highlightMeshes = [];
  var measurementObjects = [];
  var hoveredAtom = null;
  var molecule = null;
  var scene = null;
  var camera = null;
  var container = null;
  var tooltip = null;
  var onSelectionChange = null;

  function init(opts) {
    scene = opts.scene;
    camera = opts.camera;
    container = opts.container;
    molecule = opts.molecule;
    onSelectionChange = opts.onSelectionChange || null;

    createTooltip();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('click', onClick, false);
  }

  function setMolecule(mol) {
    molecule = mol;
    clearSelection();
  }

  function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.className = 'mol-tooltip';
    tooltip.style.cssText =
      'position: absolute; display: none; pointer-events: none;' +
      'font-family: "JetBrains Mono", monospace; font-size: 11px;' +
      'color: #c8d6e5; background: rgba(3,5,8,0.9);' +
      'padding: 6px 10px; border-radius: 6px;' +
      'border: 1px solid rgba(0,210,255,0.2);' +
      'box-shadow: 0 4px 20px rgba(0,0,0,0.5);' +
      'z-index: 100; max-width: 250px;';
    container.appendChild(tooltip);
  }

  function onMouseMove(e) {
    var rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    var hit = pick();
    if (hit) {
      if (hoveredAtom !== hit.atomIndex) {
        hoveredAtom = hit.atomIndex;
        var atom = molecule.atoms[hit.atomIndex];
        showTooltip(e, atom);
        if (window.MolLabels) {
          window.MolLabels.removeHoverLabels(scene);
          window.MolLabels.showLabelForAtom(scene, atom);
        }
      } else {
        moveTooltip(e);
      }
      container.style.cursor = 'pointer';
    } else {
      if (hoveredAtom !== null) {
        hoveredAtom = null;
        hideTooltip();
        if (window.MolLabels) window.MolLabels.removeHoverLabels(scene);
      }
      container.style.cursor = 'default';
    }
  }

  function onClick(e) {
    if (!molecule) return;
    var hit = pick();
    if (!hit) return;

    var atomIndex = hit.atomIndex;
    var shiftKey = e.shiftKey;

    if (shiftKey) {
      // Multi-select
      var existing = selectedAtoms.indexOf(atomIndex);
      if (existing >= 0) {
        selectedAtoms.splice(existing, 1);
      } else {
        selectedAtoms.push(atomIndex);
      }
    } else {
      selectedAtoms = [atomIndex];
    }

    updateHighlights();
    updateMeasurements();
    if (onSelectionChange) onSelectionChange(selectedAtoms);
  }

  function pick() {
    if (!molecule || !scene || !camera) return null;
    raycaster.setFromCamera(mouse, camera);

    // Find all InstancedMesh children
    var meshes = [];
    scene.traverse(function(obj) {
      if (obj.isInstancedMesh && obj.userData.atomIndices) meshes.push(obj);
    });

    var intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;

    var hit = intersects[0];
    var mesh = hit.object;
    var instanceId = hit.instanceId;
    if (instanceId === undefined || !mesh.userData.atomIndices) return null;

    var atomIndex = mesh.userData.atomIndices[instanceId];
    return { atomIndex: atomIndex, point: hit.point };
  }

  function updateHighlights() {
    // Remove old highlights
    for (var i = 0; i < highlightMeshes.length; i++) {
      scene.remove(highlightMeshes[i]);
    }
    highlightMeshes = [];

    var highlightGeo = new THREE.IcosahedronGeometry(1, 1);
    var highlightMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });

    for (var i = 0; i < selectedAtoms.length; i++) {
      var atom = molecule.atoms[selectedAtoms[i]];
      if (!atom) continue;

      var radius = (window.MolRenderer.getRadius(atom.element) || 1.7) * 0.45;
      var mesh = new THREE.Mesh(highlightGeo, highlightMat);
      mesh.position.set(atom.x, atom.y, atom.z);
      mesh.scale.setScalar(radius);
      mesh.userData.isHighlight = true;
      scene.add(mesh);
      highlightMeshes.push(mesh);
    }
  }

  function updateMeasurements() {
    // Remove old measurements
    for (var i = 0; i < measurementObjects.length; i++) {
      scene.remove(measurementObjects[i]);
    }
    measurementObjects = [];

    // Distance measurement (2 atoms)
    if (selectedAtoms.length === 2) {
      var a1 = molecule.atoms[selectedAtoms[0]];
      var a2 = molecule.atoms[selectedAtoms[1]];
      if (a1 && a2) {
        var dist = Math.sqrt(
          Math.pow(a2.x - a1.x, 2) + Math.pow(a2.y - a1.y, 2) + Math.pow(a2.z - a1.z, 2)
        );

        // Line
        var lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([
          a1.x, a1.y, a1.z, a2.x, a2.y, a2.z
        ], 3));
        var lineMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });
        var line = new THREE.Line(lineGeo, lineMat);
        line.userData.isMeasurement = true;
        scene.add(line);
        measurementObjects.push(line);

        // Label
        if (THREE.CSS2DObject) {
          var div = document.createElement('div');
          div.style.cssText =
            'font-family: "JetBrains Mono", monospace; font-size: 11px;' +
            'color: #ffaa00; background: rgba(3,5,8,0.85);' +
            'padding: 2px 6px; border-radius: 4px;' +
            'border: 1px solid rgba(255,170,0,0.3);';
          div.textContent = dist.toFixed(2) + ' \u00C5';
          var label = new THREE.CSS2DObject(div);
          label.position.set((a1.x + a2.x) / 2, (a1.y + a2.y) / 2 + 0.5, (a1.z + a2.z) / 2);
          label.userData.isMeasurement = true;
          scene.add(label);
          measurementObjects.push(label);
        }
      }
    }

    // Angle measurement (3 atoms)
    if (selectedAtoms.length === 3) {
      var a1 = molecule.atoms[selectedAtoms[0]];
      var a2 = molecule.atoms[selectedAtoms[1]]; // vertex
      var a3 = molecule.atoms[selectedAtoms[2]];
      if (a1 && a2 && a3) {
        var v1 = new THREE.Vector3(a1.x - a2.x, a1.y - a2.y, a1.z - a2.z);
        var v2 = new THREE.Vector3(a3.x - a2.x, a3.y - a2.y, a3.z - a2.z);
        var angle = v1.angleTo(v2) * (180 / Math.PI);

        // Lines
        var lineGeo1 = new THREE.BufferGeometry();
        lineGeo1.setAttribute('position', new THREE.Float32BufferAttribute([
          a1.x, a1.y, a1.z, a2.x, a2.y, a2.z
        ], 3));
        var lineGeo2 = new THREE.BufferGeometry();
        lineGeo2.setAttribute('position', new THREE.Float32BufferAttribute([
          a2.x, a2.y, a2.z, a3.x, a3.y, a3.z
        ], 3));
        var lineMat = new THREE.LineBasicMaterial({ color: 0x26de81, linewidth: 2 });
        var line1 = new THREE.Line(lineGeo1, lineMat);
        var line2 = new THREE.Line(lineGeo2, lineMat);
        line1.userData.isMeasurement = true;
        line2.userData.isMeasurement = true;
        scene.add(line1);
        scene.add(line2);
        measurementObjects.push(line1, line2);

        // Label
        if (THREE.CSS2DObject) {
          var div = document.createElement('div');
          div.style.cssText =
            'font-family: "JetBrains Mono", monospace; font-size: 11px;' +
            'color: #26de81; background: rgba(3,5,8,0.85);' +
            'padding: 2px 6px; border-radius: 4px;' +
            'border: 1px solid rgba(38,222,129,0.3);';
          div.textContent = angle.toFixed(1) + '\u00B0';
          var label = new THREE.CSS2DObject(div);
          label.position.set(a2.x, a2.y + 0.8, a2.z);
          label.userData.isMeasurement = true;
          scene.add(label);
          measurementObjects.push(label);
        }
      }
    }
  }

  function showTooltip(e, atom) {
    var html =
      '<div style="color:#00d2ff;font-weight:bold;margin-bottom:2px">' + atom.element + ' — ' + atom.name + '</div>' +
      '<div>Residue: ' + atom.resName + ' ' + atom.resSeq + '</div>' +
      '<div>Chain: ' + atom.chainId + '</div>' +
      '<div style="color:#7a8a9a;margin-top:2px">(' +
        atom.x.toFixed(2) + ', ' + atom.y.toFixed(2) + ', ' + atom.z.toFixed(2) + ')</div>';
    if (atom.bfactor) html += '<div style="color:#7a8a9a">B-factor: ' + atom.bfactor.toFixed(1) + '</div>';
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    moveTooltip(e);
  }

  function moveTooltip(e) {
    var rect = container.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
    tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  function clearSelection() {
    selectedAtoms = [];
    updateHighlights();
    updateMeasurements();
    if (onSelectionChange) onSelectionChange(selectedAtoms);
  }

  function getSelectedAtoms() {
    return selectedAtoms.slice();
  }

  function destroy() {
    if (container) {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onClick);
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    }
    clearSelection();
  }

  return {
    init: init,
    setMolecule: setMolecule,
    clearSelection: clearSelection,
    getSelectedAtoms: getSelectedAtoms,
    destroy: destroy
  };
})();
