#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { buildGraphFromFile } = require("../mcp-server/pipeline");
const { startUIServer } = require("../mcp-server/server/http-server");

const args = process.argv.slice(2);
let dataPath = null;
let port = 0;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (!args[i].startsWith("-")) {
    dataPath = args[i];
  }
}

if (!dataPath) {
  console.error("Usage: node scripts/launch.js <data.json> [--port 3000]");
  process.exit(1);
}

const resolved = path.resolve(dataPath);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

const { graphData, config, stats } = buildGraphFromFile(resolved);

if (stats.nodes === 0) {
  console.error("No nodes found in data file.");
  process.exit(1);
}

console.log(`Loading: ${path.basename(resolved)}`);
console.log(`  Nodes: ${stats.nodes}  Edges: ${stats.totalEdges} (${stats.sourceEdges} explicit + ${stats.autoEdges} auto + ${stats.temporalEdges} temporal)`);

startUIServer(graphData, config, { port })
  .then((url) => {
    console.log(`\nVisualization ready: ${url}\n`);
    const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${openCmd} "${url}"`);
  })
  .catch((err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });
