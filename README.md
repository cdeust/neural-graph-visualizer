# Neural Graph Visualizer

Interactive 3D knowledge graph visualization with pathway-aware layouts, molecule viewer, and biomedical research templates. Built with Three.js — zero dependencies.

![cascade](https://img.shields.io/badge/layout-cascade-blue) ![pipeline](https://img.shields.io/badge/layout-pipeline-green) ![radial](https://img.shields.io/badge/layout-radial-orange) ![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Installation

### Claude Code Marketplace (recommended)

```
/plugin marketplace add cdeust/neural-graph-visualizer
/plugin install neural-graph-visualizer
```

### Manual Setup

```bash
git clone https://github.com/cdeust/neural-graph-visualizer.git
cd neural-graph-visualizer
./scripts/setup.sh
```

Restart Claude Code after installation.

## Quick Start

### From Claude Code

```
/neural-graph
```

Or ask Claude to visualize your data:

> "Open the neural graph visualization"
> "Import my research data from data.json"

### From CLI

```bash
# Launch a research template
node scripts/launch.js research-templates/psoriasis/data.json

# Launch the oncology pathway
node scripts/launch.js research-templates/oncology-immunotherapy/data.json

# Launch the drug discovery pipeline
node scripts/launch.js research-templates/drug-discovery-generic/data.json

# Create your own from a template
node scripts/create-research.js --template blank --name "My Study"
```

## Features

### Pathway-Aware Layouts

Nodes are positioned by topology, not just physics. The layout engine computes hierarchical ranks from directed edge types.

| Strategy | Axis | Best For |
|----------|------|----------|
| **cascade** | Y (top → bottom) | Signaling pathways, immunotherapy cascades |
| **pipeline** | X (left → right) | Drug discovery stages, clinical trials |
| **radial** | Center → out | Target-centric views, interaction networks |
| **force** | Physics-based | Generic graphs, exploration |
| **auto** | Detected | Picks strategy from edge type distribution |

Configure in your data JSON:

```json
"_config": {
  "_layout": { "strategy": "cascade" }
}
```

### Molecule Viewer

Nodes with `pdbId` or `smiles` fields get a "View 3D Structure" button in the detail panel.

- **Proteins/biologics** — PDB viewer with ribbon, ball-and-stick, and surface modes
- **Small molecules** — SMILES-based 2D/3D rendering

### Research Templates

Ready-to-use biomedical datasets:

| Template | Nodes | Edges | Layout | Description |
|----------|-------|-------|--------|-------------|
| `psoriasis` | 29 | 43 | cascade | Full immunopathology cascade with 13 biologics |
| `oncology-immunotherapy` | 21 | 24 | cascade | PD-1/PD-L1 checkpoint pathway |
| `drug-discovery-generic` | 11 | 12 | pipeline | Target → approval pipeline |
| `blank` | 3 | 2 | force | Starter template |

### Visual Features

- **Bloom post-processing** — Cinematic glow on all nodes
- **Flow particles** — Synaptic pulses traveling along edges
- **Holographic grid** — Animated floor grid
- **Ambient dust** — 4000 floating particles for depth
- **Hex/sphere shapes** — Config-driven per node type
- **Analytics dashboard** — Activity heatmap, type distribution, project breakdown

### Interaction

- **Hover** — Tooltip with node name, type, and project
- **Click** — Detail panel with description, tags, cross-references, and molecule viewer
- **Search** — Real-time full-text filtering
- **Filter** — By type, category, status
- **Layout toggle** — Cycle between Cluster / Timeline / Pathway (keyboard: `T`)
- **Analytics** — Toggle dashboard (keyboard: `A`)

## MCP Tools

Available when installed as a Claude Code plugin:

| Tool | Description |
|------|-------------|
| `open_visualization` | Launch the 3D graph in browser |
| `get_graph` | Return graph data as JSON |
| `get_stats` | Summary statistics |
| `search` | Full-text search across nodes |
| `import_json` | Import graph from JSON file |
| `import_csv` | Import from CSV files |
| `reindex_brain` | Rebuild the brain index |
| `get_brain_index` | Query the brain index |
| `update_brain_entry` | Override brain index fields |
| `manage_thread` | CRUD for thread groups |
| `add_cross_reference` | Add bidirectional cross-reference |
| `remove_cross_reference` | Remove cross-reference |

## Data Format

A research graph is a single JSON file:

```json
{
  "_config": {
    "name": "My Research Graph",
    "accentColor": "#00d2ff",
    "nodeTypes": {
      "protein": { "color": "#ff4081", "shape": "hex", "label": "Protein" },
      "drug":    { "color": "#00d2ff", "shape": "sphere", "label": "Drug" }
    },
    "_layout": { "strategy": "cascade" }
  },
  "nodes": [
    {
      "id": "egfr",
      "name": "EGFR",
      "type": "protein",
      "description": "Epidermal growth factor receptor",
      "tags": ["receptor", "tyrosine-kinase"],
      "pdbId": "1NQL"
    }
  ],
  "edges": [
    {
      "source": "egfr",
      "target": "erlotinib",
      "weight": 0.95,
      "edgeType": "inhibition"
    }
  ]
}
```

### Edge Types for Layout

The layout engine classifies edges to compute topology:

**Flow** (drives cascade/pipeline ordering): `activation`, `production`, `differentiation`, `proceeds_to`, `validates`, `recruitment`, `amplification`, `transcription`, `intracellular_signaling`, `causes`

**Inhibition** (drugs flank their targets): `inhibition`

**Proximity** (no layout effect): `binding`, `expression`, `synergy`, `measured_by`, `relates_to`, `participates_in`

## Configuration

### Environment Variable

```bash
NGV_CONFIG=./config/presets/psoriasis.json node mcp-server/index.js
```

### Layout Strategies

| Strategy | Auto-Detected When |
|----------|-------------------|
| `cascade` | >40% of typed edges are flow types |
| `pipeline` | Graph contains `proceeds_to` edges |
| `force` | Default fallback |

Set `"strategy": "auto"` (or omit `_layout`) to let the system choose.

## Requirements

- Node.js >= 18
- Modern browser with WebGL support

## License

MIT
