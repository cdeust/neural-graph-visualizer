const { buildGraphFromConfig } = require("../pipeline");

function createExportTools(config) {
  return {
    export_graph: {
      description:
        "Export graph data in JSON, CSV, or GEXF format. GEXF is compatible with Gephi for academic analysis.",
      inputSchema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["json", "csv", "gexf"],
            description: "Export format: json, csv, or gexf (Gephi-compatible)",
          },
          type_filter: {
            type: "string",
            description: "Optional: filter to nodes of this type",
          },
        },
        required: ["format"],
      },
      handler: async ({ format, type_filter }) => {
        const { graphData } = buildGraphFromConfig(config);
        let nodes = graphData.nodes;
        let edges = graphData.edges;

        if (type_filter) {
          const nodeIds = new Set();
          nodes = nodes.filter((n) => {
            if (n.type === type_filter) {
              nodeIds.add(n.id);
              return true;
            }
            return false;
          });
          edges = edges.filter(
            (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
          );
        }

        if (format === "json") {
          return {
            nodes: nodes.map(
              ({ x, y, z, tx, ty, tz, vx, vy, vz, visible, ...rest }) => rest,
            ),
            edges,
            exportedAt: new Date().toISOString(),
          };
        }

        if (format === "csv") {
          let nodeCSV =
            "id,name,type,project,description,category,status,connections\n";
          nodes.forEach((n) => {
            nodeCSV +=
              [
                n.id,
                `"${(n.name || "").replace(/"/g, '""')}"`,
                n.type,
                `"${(n.project || "").replace(/"/g, '""')}"`,
                `"${(n.description || "").replace(/"/g, '""')}"`,
                n.category || "",
                n.status || "active",
                n.connections || 0,
              ].join(",") + "\n";
          });
          let edgeCSV = "source,target,weight,edgeType\n";
          edges.forEach((e) => {
            edgeCSV +=
              [e.source, e.target, (e.weight || 0).toFixed(3), e.edgeType || ""].join(",") + "\n";
          });
          return { nodes_csv: nodeCSV, edges_csv: edgeCSV };
        }

        if (format === "gexf") {
          const esc = (s) =>
            String(s || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
          let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
          xml +=
            '<gexf xmlns="http://gexf.net/1.3" xmlns:viz="http://gexf.net/1.3/viz" version="1.3">\n';
          xml += `  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">\n`;
          xml += "    <creator>Neural Graph Visualizer</creator>\n";
          xml += "  </meta>\n";
          xml +=
            '  <graph defaultedgetype="directed" mode="static">\n';
          xml += '    <attributes class="node">\n';
          xml +=
            '      <attribute id="0" title="type" type="string"/>\n';
          xml +=
            '      <attribute id="1" title="category" type="string"/>\n';
          xml +=
            '      <attribute id="2" title="project" type="string"/>\n';
          xml += "    </attributes>\n";
          xml += '    <attributes class="edge">\n';
          xml +=
            '      <attribute id="0" title="edgeType" type="string"/>\n';
          xml += "    </attributes>\n";
          xml += "    <nodes>\n";
          nodes.forEach((n) => {
            xml += `      <node id="${esc(n.id)}" label="${esc(n.name)}">\n`;
            xml += "        <attvalues>\n";
            xml += `          <attvalue for="0" value="${esc(n.type)}"/>\n`;
            xml += `          <attvalue for="1" value="${esc(n.category)}"/>\n`;
            xml += `          <attvalue for="2" value="${esc(n.project)}"/>\n`;
            xml += "        </attvalues>\n";
            xml += "      </node>\n";
          });
          xml += "    </nodes>\n";
          xml += "    <edges>\n";
          edges.forEach((e, i) => {
            xml += `      <edge id="${i}" source="${esc(e.source)}" target="${esc(e.target)}" weight="${(e.weight || 0).toFixed(3)}">\n`;
            if (e.edgeType) {
              xml += `        <attvalues><attvalue for="0" value="${esc(e.edgeType)}"/></attvalues>\n`;
            }
            xml += "      </edge>\n";
          });
          xml += "    </edges>\n";
          xml += "  </graph>\n";
          xml += "</gexf>";
          return { gexf: xml };
        }

        return { error: "Unknown format: " + format };
      },
    },
  };
}

module.exports = { createExportTools };
