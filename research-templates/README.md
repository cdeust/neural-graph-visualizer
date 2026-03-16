# Research Templates

Ready-to-launch templates for the Neural Graph Visualizer. Each is a self-contained JSON file.

## Usage

```bash
node scripts/launch.js research-templates/<template>/data.json
```

## Templates

| Template | Nodes | Domain | Description |
|----------|-------|--------|-------------|
| `blank` | 3 | Generic | Placeholder — start here and replace with your data |
| `oncology-immunotherapy` | 20 | Oncology | PD-1/PD-L1 checkpoint immunotherapy pathway |
| `drug-discovery-generic` | 12 | Pharma | Abstract target → approval pipeline |
| `psoriasis` | 36 | Immunology | Full psoriasis immunopathology cascade with therapies |

## Creating Your Own

Option 1 — Copy a template:
```bash
node scripts/create-research.js --template blank --name "my-study"
node scripts/launch.js data/my-study.json
```

Option 2 — Start from scratch:
```bash
node scripts/create-research.js
# Follow the prompts
```

## Data Format

Each template is a JSON file with optional `_config` and required `nodes`/`edges`:

```json
{
  "_config": {
    "name": "My Graph",
    "nodeTypes": {
      "my_type": { "color": "#ff6b35", "shape": "sphere", "label": "My Type" }
    }
  },
  "nodes": [
    { "id": "n1", "name": "Node 1", "type": "my_type", "description": "..." }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "weight": 0.8, "edgeType": "relates_to" }
  ]
}
```

If `_config` is omitted, colors and shapes are auto-generated from your node types.
