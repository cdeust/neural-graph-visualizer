#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const args = process.argv.slice(2);
const ROOT = path.join(__dirname, "..");
const TEMPLATES_DIR = path.join(ROOT, "research-templates");
const DATA_DIR = path.join(ROOT, "data");

// Parse flags
let templateName = null;
let projectName = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--template" && args[i + 1]) { templateName = args[i + 1]; i++; }
  else if (args[i] === "--name" && args[i + 1]) { projectName = args[i + 1]; i++; }
}

if (templateName && projectName) {
  // Template mode
  copyTemplate(templateName, projectName);
} else {
  // Interactive mode
  interactiveMode();
}

function copyTemplate(template, name) {
  // Find matching template directory
  const dirs = fs.readdirSync(TEMPLATES_DIR).filter((d) =>
    fs.statSync(path.join(TEMPLATES_DIR, d)).isDirectory() && d.includes(template)
  );

  if (dirs.length === 0) {
    console.error(`No template matching "${template}". Available:`);
    fs.readdirSync(TEMPLATES_DIR)
      .filter((d) => fs.statSync(path.join(TEMPLATES_DIR, d)).isDirectory())
      .forEach((d) => console.error(`  ${d}`));
    process.exit(1);
  }

  const srcDir = dirs[0];
  const srcPath = path.join(TEMPLATES_DIR, srcDir, "data.json");
  if (!fs.existsSync(srcPath)) {
    console.error(`Template "${srcDir}" has no data.json`);
    process.exit(1);
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const destPath = path.join(DATA_DIR, `${slug}.json`);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Copy and update name
  const data = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
  if (data._config) data._config.name = name;
  fs.writeFileSync(destPath, JSON.stringify(data, null, 2), "utf-8");

  console.log(`Created: ${path.relative(ROOT, destPath)}`);
  console.log(`\nLaunch with:\n  node scripts/launch.js ${path.relative(ROOT, destPath)}`);
}

function interactiveMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  (async () => {
    const domain = await ask("Domain name (e.g., 'Cardiology Study'): ");
    const typesStr = await ask("Node types (comma-separated, e.g., 'gene, protein, drug, pathway'): ");
    rl.close();

    const types = typesStr.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
    if (types.length === 0) {
      console.error("At least one node type is required.");
      process.exit(1);
    }

    const { generateConfig } = require("../mcp-server/config-generator");
    // Create placeholder nodes — one per type
    const nodes = types.map((t, i) => ({
      id: `${t}_1`,
      name: `Example ${t.replace(/_/g, " ")}`,
      type: t,
      project: domain.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: `A ${t.replace(/_/g, " ")} in your domain`,
      body: "Replace with your data.",
    }));

    const config = generateConfig(nodes);
    config.name = domain;

    const edges = nodes.length > 1
      ? [{ source: nodes[0].id, target: nodes[1].id, weight: 0.5, edgeType: "relates_to" }]
      : [];

    const data = { _config: { name: config.name, accentColor: config.accentColor, nodeTypes: config.nodeTypes }, nodes, edges };

    const slug = domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const destPath = path.join(DATA_DIR, `${slug}.json`);

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(data, null, 2), "utf-8");

    console.log(`\nCreated: ${path.relative(ROOT, destPath)}`);
    console.log(`  ${nodes.length} placeholder node(s), ${edges.length} edge(s)`);
    console.log(`\nLaunch with:\n  node scripts/launch.js ${path.relative(ROOT, destPath)}`);
  })();
}
