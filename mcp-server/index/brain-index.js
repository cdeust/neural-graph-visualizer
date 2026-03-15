const fs = require("fs");
const path = require("path");
const os = require("os");

const BRAIN_INDEX_PATH = path.join(os.homedir(), ".claude", "ngv-brain-index.json");

function loadBrainIndex() {
  try {
    if (fs.existsSync(BRAIN_INDEX_PATH)) {
      return JSON.parse(fs.readFileSync(BRAIN_INDEX_PATH, "utf-8"));
    }
  } catch (e) {
    process.stderr.write(`[ngv] Failed to load brain index: ${e.message}\n`);
  }
  return { version: 1, updatedAt: null, nodes: {}, threads: {} };
}

function saveBrainIndex(index) {
  index.updatedAt = new Date().toISOString();
  const dir = path.dirname(BRAIN_INDEX_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BRAIN_INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

function simpleHash(text) {
  const str = text.slice(0, 500);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

function ensureIndexed(nodes, categorizer, tagger) {
  const index = loadBrainIndex();
  let dirty = false;

  for (const node of nodes) {
    const key = node.path || node.sessionId || node.id;
    const textForAnalysis = `${node.name} ${node.description || ""} ${node.body || ""}`;
    const hash = simpleHash(textForAnalysis);

    if (!index.nodes[key]) {
      index.nodes[key] = {
        category: categorizer.categorize(textForAnalysis),
        tags: tagger(textForAnalysis),
        customTags: [],
        status: "active",
        threadId: null,
        crossRefs: [],
        contentHash: hash,
      };
      dirty = true;
    } else if (index.nodes[key].contentHash !== hash) {
      const existing = index.nodes[key];
      existing.category = categorizer.categorize(textForAnalysis);
      existing.tags = tagger(textForAnalysis);
      existing.contentHash = hash;
      dirty = true;
    }
  }

  if (dirty) saveBrainIndex(index);
  return index;
}

function enrichNodes(nodes, brainIndex) {
  return nodes.map((node) => {
    const key = node.path || node.sessionId || node.id;
    const entry = brainIndex.nodes[key];
    if (entry) {
      return {
        ...node,
        category: entry.category,
        tags: entry.tags,
        customTags: entry.customTags,
        status: entry.status,
        threadId: entry.threadId,
        crossRefs: entry.crossRefs || [],
      };
    }
    return node;
  });
}

module.exports = {
  loadBrainIndex,
  saveBrainIndex,
  simpleHash,
  ensureIndexed,
  enrichNodes,
  BRAIN_INDEX_PATH,
};
