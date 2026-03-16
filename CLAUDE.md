# Neural Graph Visualizer

Interactive 3D knowledge graph with pathway-aware layouts, molecule viewer, and biomedical research templates.

## Installation

### Via Marketplace (recommended)
```
/install cdeust/neural-graph-visualizer
```

### Manual Setup
```bash
git clone https://github.com/cdeust/neural-graph-visualizer.git
cd neural-graph-visualizer
./scripts/setup.sh
```

## Slash Commands

- `/neural-graph` — Launch the interactive visualization

## MCP Tools

- **get_graph** — Returns graph data as JSON
- **get_stats** — Summary statistics
- **search** — Full-text search
- **open_visualization** — Launch the 3D visualization
- **import_json** — Import from JSON file
- **import_csv** — Import from CSV files
- **reindex_brain** — Rebuild the brain index
- **get_brain_index** — Query the brain index
- **update_brain_entry** — Override brain index fields
- **manage_thread** — CRUD for thread groups
- **add_cross_reference** — Add bidirectional cross-reference
- **remove_cross_reference** — Remove cross-reference

## Research Templates

Launch pre-built datasets:
```bash
node scripts/launch.js research-templates/psoriasis/data.json
node scripts/launch.js research-templates/oncology-immunotherapy/data.json
node scripts/launch.js research-templates/drug-discovery-generic/data.json
```

## Layout System

Pathway-aware layouts: `cascade` (top→bottom), `pipeline` (left→right), `radial` (center→out), `force` (physics), `auto` (detected from edges).

Configure via `_config._layout.strategy` in data JSON.
