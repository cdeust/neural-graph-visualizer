# Neural Graph Visualizer

Generic neural graph visualization — configurable 3D knowledge graph with Three.js.

## Installation

### Via Marketplace (recommended)
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

## Configuration

Set `NGV_CONFIG` environment variable to point to a config JSON:
```bash
NGV_CONFIG=./config/presets/healthcare.json node mcp-server/index.js
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
