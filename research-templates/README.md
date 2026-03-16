# Research Templates

Starter templates for the Neural Graph Visualizer. Each is a self-contained JSON file.

## Usage

```bash
node scripts/launch.js research-templates/<template>/data.json
```

## Templates

| Template | Nodes | Layout | Description |
|----------|-------|--------|-------------|
| `blank` | 3 | force | Starter — replace with your own data |
| `drug-discovery-generic` | 11 | pipeline | Example target → approval pipeline |

## Creating Your Own

Copy a template and edit:
```bash
node scripts/create-research.js --template blank --name "my-study"
node scripts/launch.js data/my-study.json
```

Or start interactively:
```bash
node scripts/create-research.js
```

## Data Format

Each template is a JSON file with optional `_config` and required `nodes`/`edges`:

```json
{
  "_config": {
    "name": "My Graph",
    "nodeTypes": {
      "my_type": { "color": "#ff6b35", "shape": "sphere", "label": "My Type" }
    },
    "_layout": { "strategy": "auto" }
  },
  "nodes": [
    { "id": "n1", "name": "Node 1", "type": "my_type", "description": "..." }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "weight": 0.8, "edgeType": "activation" }
  ]
}
```

If `_config` is omitted, colors and shapes are auto-generated from your node types.
