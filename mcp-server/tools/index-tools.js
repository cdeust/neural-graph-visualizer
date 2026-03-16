const { loadFromSources } = require("../data/data-source-factory");
const { loadBrainIndex, saveBrainIndex, simpleHash, ensureIndexed } = require("../index/brain-index");
const { createCategorizer } = require("../index/categorizer");
const { autoTag } = require("../index/tagger");

function createIndexTools(config) {
  const categorizer = createCategorizer(config);

  return {
    reindex_brain: {
      description: "Full reindex of the brain index. Use force to rebuild everything.",
      inputSchema: {
        type: "object",
        properties: {
          force: { type: "boolean", description: "Force rebuild all (default: false)" },
        },
        required: [],
      },
      handler: async ({ force } = {}) => {
        const { nodes } = loadFromSources(config);
        const index = loadBrainIndex();
        let indexed = 0, updated = 0;

        for (const node of nodes) {
          const key = node.path || node.sessionId || node.id;
          const text = `${node.name} ${node.description || ""} ${node.body || ""}`;
          const hash = simpleHash(text);

          if (!index.nodes[key]) {
            index.nodes[key] = {
              category: categorizer.categorize(text),
              tags: autoTag(text),
              customTags: [],
              status: "active",
              threadId: null,
              crossRefs: [],
              contentHash: hash,
            };
            indexed++;
          } else if (force || index.nodes[key].contentHash !== hash) {
            index.nodes[key].category = categorizer.categorize(text);
            index.nodes[key].tags = autoTag(text);
            index.nodes[key].contentHash = hash;
            updated++;
          }
        }

        saveBrainIndex(index);
        return { indexed, updated, total: nodes.length };
      },
    },

    get_brain_index: {
      description: "Returns brain index entries with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string" },
          tag: { type: "string" },
          status: { type: "string" },
          thread: { type: "string" },
        },
        required: [],
      },
      handler: async ({ category, tag, status, thread } = {}) => {
        const { nodes } = loadFromSources(config);
        const index = ensureIndexed(nodes, categorizer, autoTag);
        const results = [];

        for (const node of nodes) {
          const key = node.path || node.sessionId || node.id;
          const entry = index.nodes[key];
          if (!entry) continue;
          if (category && entry.category !== category) continue;
          if (tag && !(entry.tags || []).includes(tag) && !(entry.customTags || []).includes(tag)) continue;
          if (status && entry.status !== status) continue;
          if (thread && entry.threadId !== thread) continue;
          const { body, ...rest } = node;
          results.push({ ...rest, ...entry, indexKey: key });
        }

        return { entries: results, count: results.length };
      },
    },

    update_brain_entry: {
      description: "Manually override fields on a brain index entry",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Index key" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          customTags: { type: "array", items: { type: "string" } },
          status: { type: "string" },
          threadId: { type: "string" },
        },
        required: ["key"],
      },
      handler: async ({ key, category, tags, customTags, status, threadId }) => {
        const index = loadBrainIndex();
        const entry = index.nodes[key];
        if (!entry) throw new Error(`Entry not found: ${key}`);

        if (category !== undefined) entry.category = category;
        if (tags !== undefined) entry.tags = tags;
        if (customTags !== undefined) entry.customTags = customTags;
        if (status !== undefined) entry.status = status;
        if (threadId !== undefined) entry.threadId = threadId;

        saveBrainIndex(index);
        return { key, entry };
      },
    },

    manage_thread: {
      description: "CRUD for thread groups",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list"] },
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string" },
        },
        required: ["action"],
      },
      handler: async ({ action, id, name, description, color }) => {
        const index = loadBrainIndex();
        if (!index.threads) index.threads = {};

        switch (action) {
          case "create": {
            const tid = `thread_${Date.now().toString(36)}`;
            index.threads[tid] = { name: name || tid, description: description || "", color: color || "#888", createdAt: new Date().toISOString() };
            saveBrainIndex(index);
            return { id: tid, ...index.threads[tid] };
          }
          case "update": {
            if (!id || !index.threads[id]) throw new Error(`Thread not found: ${id}`);
            if (name !== undefined) index.threads[id].name = name;
            if (description !== undefined) index.threads[id].description = description;
            if (color !== undefined) index.threads[id].color = color;
            saveBrainIndex(index);
            return { id, ...index.threads[id] };
          }
          case "delete": {
            if (!id || !index.threads[id]) throw new Error(`Thread not found: ${id}`);
            const del = index.threads[id];
            delete index.threads[id];
            saveBrainIndex(index);
            return { id, deleted: del };
          }
          case "list":
            return { threads: Object.entries(index.threads).map(([tid, t]) => ({ id: tid, ...t })) };
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      },
    },

    add_cross_reference: {
      description: "Adds a bidirectional cross-reference",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
        },
        required: ["source", "target"],
      },
      handler: async ({ source, target }) => {
        const index = loadBrainIndex();
        const s = index.nodes[source];
        const t = index.nodes[target];
        if (!s) throw new Error(`Source not found: ${source}`);
        if (!t) throw new Error(`Target not found: ${target}`);

        if (!s.crossRefs) s.crossRefs = [];
        if (!t.crossRefs) t.crossRefs = [];
        if (!s.crossRefs.includes(target)) s.crossRefs.push(target);
        if (!t.crossRefs.includes(source)) t.crossRefs.push(source);

        saveBrainIndex(index);
        return { source: { key: source, crossRefs: s.crossRefs }, target: { key: target, crossRefs: t.crossRefs } };
      },
    },

    remove_cross_reference: {
      description: "Removes a bidirectional cross-reference",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
        },
        required: ["source", "target"],
      },
      handler: async ({ source, target }) => {
        const index = loadBrainIndex();
        const s = index.nodes[source];
        const t = index.nodes[target];
        if (!s) throw new Error(`Source not found: ${source}`);
        if (!t) throw new Error(`Target not found: ${target}`);

        if (s.crossRefs) s.crossRefs = s.crossRefs.filter((r) => r !== target);
        if (t.crossRefs) t.crossRefs = t.crossRefs.filter((r) => r !== source);

        saveBrainIndex(index);
        return { source: { key: source, crossRefs: s.crossRefs || [] }, target: { key: target, crossRefs: t.crossRefs || [] } };
      },
    },
  };
}

module.exports = { createIndexTools };
