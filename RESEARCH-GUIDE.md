# Research Visualization Guide

Turn any research domain into an interactive 3D graph — no code required.

## Quick Start

### 1. Pick a template
```bash
ls research-templates/
```

### 2. Launch it
```bash
node scripts/launch.js research-templates/oncology-immunotherapy/data.json
```

### 3. Customize
Edit the JSON, re-run the command. That's it.

## Create Your Own

### From a template
```bash
node scripts/create-research.js --template blank --name "My Study"
node scripts/launch.js data/my-study.json
```

### From scratch (interactive)
```bash
node scripts/create-research.js
```

## Data Format Reference

A research graph is a single JSON file with three sections:

### `_config` (optional)
Controls appearance. Omit it and colors/shapes are auto-generated.

```json
{
  "_config": {
    "name": "My Research Graph",
    "accentColor": "#00d2ff",
    "nodeTypes": {
      "gene":    { "color": "#26de81", "shape": "sphere", "label": "Gene" },
      "protein": { "color": "#ff4081", "shape": "hex",    "label": "Protein" },
      "drug":    { "color": "#00d2ff", "shape": "sphere", "label": "Drug" }
    },
    "categoryRules": {
      "kinase": ["kinase", "phosphorylation", "ATP"],
      "receptor": ["receptor", "ligand", "binding"]
    }
  }
}
```

**Shapes**: `sphere`, `hex`
**Colors**: any hex color

### `nodes` (required)

```json
{
  "id": "egfr",
  "name": "EGFR",
  "type": "protein",
  "project": "lung-cancer",
  "description": "Epidermal growth factor receptor",
  "body": "Detailed notes, references, mechanism details...",
  "tags": ["receptor", "tyrosine-kinase", "oncogene"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique identifier (used in edges) |
| `name` | yes | Display name |
| `type` | yes | Must match a key in `_config.nodeTypes` |
| `project` | no | Grouping label (default: "default") |
| `description` | no | Short summary (shown on hover) |
| `body` | no | Full detail (shown in detail panel) |
| `tags` | no | Array of keywords |
| `pdbId` | no | PDB ID for 3D molecule viewer (e.g., "5DK3") |
| `smiles` | no | SMILES string for 2D molecule viewer |

### `edges` (required)

```json
{
  "source": "egfr",
  "target": "erlotinib",
  "weight": 0.95,
  "edgeType": "inhibition"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `source` | yes | Source node `id` |
| `target` | yes | Target node `id` |
| `weight` | no | 0.0–1.0, affects edge brightness (default: 0.5) |
| `edgeType` | no | Semantic label (default: "link") |

## Edge Type Vocabulary

Use consistent edge types across your graph:

### Biological
- `activation` — A activates B
- `inhibition` — A inhibits/blocks B
- `binding` — A physically binds B
- `expression` — A is expressed on/by B
- `production` — A produces/secretes B
- `differentiation` — A drives B's differentiation

### Regulatory
- `amplification` — A amplifies B's effect
- `synergy` — A and B have synergistic effects
- `recruitment` — A recruits B to a site
- `transcription` — A drives transcription of B

### Clinical / Pipeline
- `proceeds_to` — sequential pipeline stages
- `validates` — A provides evidence for B
- `measured_by` — A is measured/tracked by B
- `causes` — A causes/triggers B

### Generic
- `relates_to` — generic relationship
- `part_of` — A is a component of B
- `regulates` — A regulates B

## Node Type Patterns

### Biological Research
`gene`, `protein`, `receptor`, `ligand`, `enzyme`, `metabolite`, `pathway`, `cell`, `tissue`, `organ`

### Drug Development
`compound`, `target`, `biomarker`, `trial`, `endpoint`, `adverse_event`, `indication`

### Clinical
`condition`, `symptom`, `diagnosis`, `treatment`, `outcome`, `guideline`, `risk_factor`

### Evidence
`study`, `publication`, `dataset`, `method`, `result`, `hypothesis`

## Adding Molecule Data

Nodes with `pdbId` or `smiles` fields get a "View Molecule" button in the detail panel.

### For proteins and biologics (3D viewer)
```json
{
  "id": "pembrolizumab",
  "name": "Pembrolizumab",
  "type": "drug",
  "pdbId": "5DK3"
}
```

### For small molecules (2D/3D viewer)
```json
{
  "id": "aspirin",
  "name": "Aspirin",
  "type": "compound",
  "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O"
}
```

## From Paper to Graph in 10 Minutes

### Step 1: Identify entities (2 min)
Read the abstract and figures. List key entities: proteins, drugs, pathways, cell types, outcomes.

### Step 2: Define types (1 min)
Group entities into 3-6 types. Example: `protein`, `drug`, `pathway`, `outcome`.

### Step 3: Create the file (5 min)
```bash
node scripts/create-research.js --template blank --name "Paper X"
```
Open the generated JSON. Replace placeholder nodes with your entities. Add edges for each relationship mentioned in the paper.

### Step 4: Launch and iterate (2 min)
```bash
node scripts/launch.js data/paper-x.json
```
See what's missing. Add nodes/edges. Re-launch. The graph auto-refreshes on each launch.

## CLI Reference

```bash
# Launch any data file
node scripts/launch.js <data.json> [--port 3000]

# Create from template
node scripts/create-research.js --template <name> --name "My Study"

# Interactive creation
node scripts/create-research.js

# NPM shortcuts
npm run launch -- research-templates/blank/data.json
npm run create -- --template oncology --name "My Study"
```

## Tips

- **Start small**: 5-10 nodes is enough to see structure. Add detail later.
- **Use explicit edges**: The system auto-generates edges from text similarity, but explicit edges with semantic types (`inhibition`, `activation`) are far more informative.
- **Weight matters**: Higher weight = brighter edge. Use 0.9+ for strong/validated relationships, 0.5 for hypothesized ones.
- **PDB IDs**: Find them at [RCSB PDB](https://www.rcsb.org/). Search by protein name.
- **SMILES**: Find them at [PubChem](https://pubchem.ncbi.nlm.nih.gov/). Copy the "Canonical SMILES" field.
