const http = require("http");
const fs = require("fs");
const path = require("path");
const { injectGraphData } = require("./graph-injector");

let activeServer = null;
let idleTimer = null;

function startUIServer(graphData, config, options) {
  return new Promise((resolve, reject) => {
    if (activeServer) {
      resetIdleTimer();
      resolve(activeServer.url);
      return;
    }

    const htmlPath = path.join(__dirname, "..", "..", "ui", "index.html");
    let html;
    try {
      html = fs.readFileSync(htmlPath, "utf-8");
    } catch (e) {
      reject(new Error(`Could not read UI file: ${e.message}`));
      return;
    }

    html = injectGraphData(html, graphData, config);

    const server = http.createServer((req, res) => {
      resetIdleTimer();
      const url = new URL(req.url, "http://localhost");

      if (url.pathname === "/api/detail") {
        const nodeId = url.searchParams.get("id");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        try {
          const node = graphData.nodes.find(
            (n) => n.id === nodeId || n.sessionId === nodeId || n.path === nodeId
          );
          if (!node) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: "Node not found" }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({
            type: node.nodeType || node.type,
            body: node.body || "",
            description: node.description || "",
            summary: node.summary || null,
            firstMessage: node.firstMessage || null,
          }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      if (url.pathname === "/api/analytics") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.writeHead(200);
        res.end(JSON.stringify({ nodes: graphData.nodes.length, edges: graphData.edges.length }));
        return;
      }

      // Serve molecule viewer page
      if (url.pathname === "/molecule.html") {
        const molPath = path.join(__dirname, "..", "..", "ui", "molecule.html");
        try {
          const molHtml = fs.readFileSync(molPath, "utf-8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(molHtml);
        } catch (_) {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      // Serve CSS file
      if (url.pathname === "/css/theme.css") {
        const cssPath = path.join(__dirname, "..", "..", "ui", "css", "theme.css");
        try {
          const css = fs.readFileSync(cssPath, "utf-8");
          res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
          res.end(css);
        } catch (_) {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      // Serve JS files
      if (url.pathname.startsWith("/js/")) {
        const jsPath = path.join(__dirname, "..", "..", "ui", url.pathname);
        try {
          const js = fs.readFileSync(jsPath, "utf-8");
          res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
          res.end(js);
        } catch (_) {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      // Serve data files (molecules, etc.) — 404 if not found
      if (url.pathname.startsWith("/data/")) {
        const dataPath = path.join(__dirname, "..", "..", url.pathname);
        try {
          const data = fs.readFileSync(dataPath);
          const ext = path.extname(dataPath).toLowerCase();
          const mimeTypes = { ".pdb": "chemical/x-pdb", ".sdf": "chemical/x-mdl-sdfile", ".mol": "chemical/x-mdl-molfile", ".json": "application/json" };
          res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
          res.end(data);
        } catch (_) {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(html);
    });

    const requestedPort = (options && options.port) || 0;
    server.listen(requestedPort, "127.0.0.1", () => {
      const assignedPort = server.address().port;
      const url = `http://127.0.0.1:${assignedPort}`;
      activeServer = { server, url, port: assignedPort };
      resetIdleTimer();
      resolve(url);
    });

    server.on("error", reject);
  });
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (activeServer) {
      activeServer.server.close();
      activeServer = null;
      process.stderr.write("[ngv] UI server closed (idle timeout)\n");
    }
  }, 5 * 60 * 1000);
}

function getActiveServer() {
  return activeServer;
}

module.exports = { startUIServer, getActiveServer };
