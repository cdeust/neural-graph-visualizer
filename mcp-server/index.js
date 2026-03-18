#!/usr/bin/env node
// Neural Graph Visualizer — MCP Server
// Zero-dependency Node.js, stdio JSON-RPC 2.0

const { loadConfig } = require("./config-loader");
const { startUIServer, getActiveServer } = require("./server/http-server");
const { createGraphTools } = require("./tools/graph-tools");
const { createImportTools } = require("./tools/import-tools");
const { createVisualizationTools } = require("./tools/visualization-tools");
const { createIndexTools } = require("./tools/index-tools");
const { createExportTools } = require("./tools/export-tools");

const config = loadConfig();

const TOOLS = {
  ...createGraphTools(config),
  ...createImportTools(config),
  ...createVisualizationTools(config, { httpServer: { startUIServer } }),
  ...createIndexTools(config),
  ...createExportTools(config),
};

const SERVER_INFO = { name: "neural-graph-visualizer", version: "1.0.0" };

function makeResponse(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      return makeResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
      return null;

    case "tools/list":
      return makeResponse(id, {
        tools: Object.entries(TOOLS).map(([name, def]) => ({
          name,
          description: def.description,
          inputSchema: def.inputSchema,
        })),
      });

    case "tools/call": {
      const toolName = (params || {}).name;
      const toolArgs = (params || {}).arguments || {};
      const tool = TOOLS[toolName];

      if (!tool) {
        return makeResponse(id, {
          content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${toolName}` }, null, 2) }],
        });
      }

      try {
        const result = await tool.handler(toolArgs);
        return makeResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return makeResponse(id, {
          content: [{ type: "text", text: JSON.stringify({ error: err.message }, null, 2) }],
          isError: true,
        });
      }
    }

    default:
      if (id !== undefined) return makeError(id, -32601, `Method not found: ${method}`);
      return null;
  }
}

// stdio transport
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();
  let lines = buffer.split("\n");
  buffer = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Content-Length")) continue;
    try {
      const msg = JSON.parse(trimmed);
      handleRequest(msg)
        .then((response) => { if (response) process.stdout.write(response + "\n"); })
        .catch((e) => { process.stderr.write(`[ngv] Handler error: ${e.message}\n`); });
    } catch (e) {
      process.stderr.write(`[ngv] Parse error: ${e.message}\n`);
    }
  }
});

process.on("SIGTERM", () => { const s = getActiveServer(); if (s) s.server.close(); process.exit(0); });
process.on("SIGINT", () => { const s = getActiveServer(); if (s) s.server.close(); process.exit(0); });

process.stderr.write(`[ngv] MCP server started (v1.0.0) — config: ${config.name}\n`);
