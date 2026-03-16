# Neural Graph Visualizer

Interactive 3D knowledge graph visualization with pathway-aware layouts, molecule viewer, and configurable templates. Built with Three.js — zero dependencies.

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
# Launch the example pipeline
node scripts/launch.js research-templates/drug-discovery-generic/data.json

# Launch the blank starter
node scripts/launch.js research-templates/blank/data.json

# Create your own from a template
node scripts/create-research.js --template blank --name "My Study"
```

## Features

### Pathway-Aware Layouts

Nodes are positioned by topology, not just physics. The layout engine computes hierarchical ranks from directed edge types.

| Strategy | Axis | Best For |
|----------|------|----------|
| **cascade** | Y (top → bottom) | Signaling pathways, dependency chains |
| **pipeline** | X (left → right) | Sequential stages, workflows |
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

### Templates

| Template | Nodes | Layout | Description |
|----------|-------|--------|-------------|
| `drug-discovery-generic` | 11 | pipeline | Target → approval pipeline example |
| `blank` | 3 | force | Starter template — replace with your data |

Use these as starting points. Copy, edit the JSON, and launch.

### Visual Features

- **Bloom post-processing** — Cinematic glow on all nodes
- **Flow particles** — Synaptic pulses traveling along edges
- **Holographic grid** — Animated floor grid
- **Ambient dust** — 4000 floating particles for depth
- **Hex/sphere shapes** — Config-driven per node type
- **Analytics dashboard** — Type distribution, project breakdown

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

A graph is a single JSON file with three sections:

```json
{
  "_config": {
    "name": "My Graph",
    "accentColor": "#00d2ff",
    "nodeTypes": {
      "concept":  { "color": "#45aaf2", "shape": "sphere", "label": "Concept" },
      "entity":   { "color": "#26de81", "shape": "hex",    "label": "Entity" },
      "process":  { "color": "#ff4081", "shape": "sphere", "label": "Process" }
    },
    "categoryRules": {
      "group_a": ["keyword1", "keyword2"],
      "group_b": ["keyword3", "keyword4"]
    },
    "_layout": { "strategy": "auto" }
  },
  "nodes": [
    {
      "id": "node_1",
      "name": "My Node",
      "type": "concept",
      "project": "my-project",
      "description": "Short summary shown on hover",
      "body": "Detailed content shown in the side panel",
      "tags": ["tag1", "tag2"],
      "pdbId": "5DK3",
      "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O"
    }
  ],
  "edges": [
    {
      "source": "node_1",
      "target": "node_2",
      "weight": 0.8,
      "edgeType": "activation"
    }
  ]
}
```

### Node Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique identifier (used in edges) |
| `name` | yes | Display name |
| `type` | yes | Must match a key in `nodeTypes` |
| `project` | no | Grouping label |
| `description` | no | Short summary (hover tooltip) |
| `body` | no | Full detail (side panel) |
| `tags` | no | Array of keywords |
| `pdbId` | no | PDB ID for 3D protein viewer |
| `smiles` | no | SMILES string for molecule viewer |

### Edge Types

The layout engine classifies edges to compute topology:

**Flow** (drives cascade/pipeline ordering): `activation`, `production`, `differentiation`, `proceeds_to`, `validates`, `recruitment`, `amplification`, `transcription`, `intracellular_signaling`, `causes`

**Inhibition** (positions nodes flanking their targets): `inhibition`

**Proximity** (no layout effect): `binding`, `expression`, `synergy`, `measured_by`, `relates_to`, `participates_in`

### Layout Auto-Detection

| Strategy | Auto-Detected When |
|----------|-------------------|
| `cascade` | >40% of typed edges are flow types |
| `pipeline` | Graph contains `proceeds_to` edges |
| `force` | Default fallback |

Set `"strategy": "auto"` (or omit `_layout`) to let the system choose.

## Configuration

```bash
# Set config via environment variable
NGV_CONFIG=./my-config.json node mcp-server/index.js

# Or use the launch script with any JSON file
node scripts/launch.js my-data.json
```

## Requirements

- Node.js >= 18
- Modern browser with WebGL support

## License

MIT
