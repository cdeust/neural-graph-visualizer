// ═══════════════════════════════════════════════════════════════════
// Atom Labels — CSS2DRenderer overlay
// ═══════════════════════════════════════════════════════════════════

window.MolLabels = (function() {
  'use strict';

  var LABEL_MODES = {
    NONE: 'none',
    ELEMENT: 'element',
    RESIDUE: 'residue',
    FULL: 'full'
  };

  var labelObjects = [];
  var labelRenderer = null;
  var currentMode = LABEL_MODES.NONE;
  var visibleIndices = null; // null = show all (filtered), Set = specific atoms

  function initRenderer(container) {
    if (labelRenderer) return labelRenderer;
    if (!THREE.CSS2DRenderer) return null;

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    return labelRenderer;
  }

  function createLabelText(atom, mode) {
    switch (mode) {
      case LABEL_MODES.ELEMENT:
        return atom.element;
      case LABEL_MODES.RESIDUE:
        return atom.resName + ' ' + atom.resSeq;
      case LABEL_MODES.FULL:
        return atom.name + ' ' + atom.resName + ' ' + atom.resSeq;
      default:
        return '';
    }
  }

  function createLabelElement(text) {
    var div = document.createElement('div');
    div.className = 'mol-atom-label';
    div.textContent = text;
    div.style.cssText =
      'font-family: "JetBrains Mono", monospace;' +
      'font-size: 10px;' +
      'color: #c8d6e5;' +
      'background: rgba(3,5,8,0.75);' +
      'padding: 1px 4px;' +
      'border-radius: 3px;' +
      'border: 1px solid rgba(0,210,255,0.15);' +
      'white-space: nowrap;' +
      'pointer-events: none;';
    return div;
  }

  function buildLabels(scene, molecule, mode, indices) {
    clearLabels(scene);
    if (mode === LABEL_MODES.NONE) return;

    currentMode = mode;
    visibleIndices = indices || null;
    var atoms = molecule.atoms;

    // Limit labels to avoid performance issues
    var maxLabels = 200;
    var shown = 0;

    for (var i = 0; i < atoms.length; i++) {
      if (shown >= maxLabels) break;
      var a = atoms[i];

      // If specific indices provided, only show those
      if (visibleIndices && !visibleIndices.has(i)) continue;

      // Skip hydrogens for labels
      if (a.element === 'H') continue;

      var text = createLabelText(a, mode);
      if (!text) continue;

      var el = createLabelElement(text);
      var label = new THREE.CSS2DObject(el);
      label.position.set(a.x, a.y + 0.5, a.z);
      label.userData.atomIndex = i;
      scene.add(label);
      labelObjects.push(label);
      shown++;
    }
  }

  function clearLabels(scene) {
    for (var i = 0; i < labelObjects.length; i++) {
      scene.remove(labelObjects[i]);
      if (labelObjects[i].element && labelObjects[i].element.parentNode) {
        labelObjects[i].element.parentNode.removeChild(labelObjects[i].element);
      }
    }
    labelObjects = [];
  }

  function showLabelForAtom(scene, atom) {
    var text = atom.element + ' ' + atom.name + ' (' + atom.resName + ' ' + atom.resSeq + ')';
    var el = createLabelElement(text);
    el.style.fontSize = '11px';
    el.style.borderColor = 'rgba(0,210,255,0.4)';
    var label = new THREE.CSS2DObject(el);
    label.position.set(atom.x, atom.y + 0.8, atom.z);
    label.userData.isHoverLabel = true;
    scene.add(label);
    labelObjects.push(label);
    return label;
  }

  function removeHoverLabels(scene) {
    var remaining = [];
    for (var i = 0; i < labelObjects.length; i++) {
      if (labelObjects[i].userData.isHoverLabel) {
        scene.remove(labelObjects[i]);
        if (labelObjects[i].element && labelObjects[i].element.parentNode) {
          labelObjects[i].element.parentNode.removeChild(labelObjects[i].element);
        }
      } else {
        remaining.push(labelObjects[i]);
      }
    }
    labelObjects = remaining;
  }

  function render(scene, camera) {
    if (labelRenderer) labelRenderer.render(scene, camera);
  }

  function resize(w, h) {
    if (labelRenderer) labelRenderer.setSize(w, h);
  }

  return {
    LABEL_MODES: LABEL_MODES,
    initRenderer: initRenderer,
    buildLabels: buildLabels,
    clearLabels: clearLabels,
    showLabelForAtom: showLabelForAtom,
    removeHoverLabels: removeHoverLabels,
    render: render,
    resize: resize
  };
})();
