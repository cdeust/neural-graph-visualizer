---
name: neural-graph
description: Visualize any knowledge graph as an interactive 3D neural map
tools:
  - neural-graph-visualizer:get_graph
  - neural-graph-visualizer:get_stats
  - neural-graph-visualizer:search
  - neural-graph-visualizer:open_visualization
  - neural-graph-visualizer:import_json
  - neural-graph-visualizer:import_csv
  - neural-graph-visualizer:reindex_brain
  - neural-graph-visualizer:get_brain_index
  - neural-graph-visualizer:update_brain_entry
  - neural-graph-visualizer:manage_thread
  - neural-graph-visualizer:add_cross_reference
  - neural-graph-visualizer:remove_cross_reference
---

# Neural Graph Visualizer

Visualize and explore any knowledge graph as an interactive 3D neural map.

## Available Tools

- **get_graph** — Returns nodes and edges as graph JSON
- **get_stats** — Summary counts by type, project, and recency
- **search** — Full-text search across all nodes
- **open_visualization** — Launch the 3D visualization in browser
- **import_json** — Import graph from JSON file
- **import_csv** — Import nodes/edges from CSV files
- **reindex_brain** — Rebuild the brain index
- **get_brain_index** — Query the brain index
- **update_brain_entry** — Override brain index fields
- **manage_thread** — CRUD for thread groups
- **add_cross_reference** — Add bidirectional cross-ref
- **remove_cross_reference** — Remove cross-ref

## Usage

Use `open_visualization` to launch the interactive graph in a browser. Use `import_json` or `import_csv` to load custom data. Configure via `NGV_CONFIG` environment variable.
