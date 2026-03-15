function normalizeNode(raw, config) {
  const typeKeys = Object.keys(config.nodeTypes);
  const type = typeKeys.includes(raw.type) ? raw.type : (typeKeys[0] || "entity");
  return {
    id: raw.id,
    name: raw.name || "Untitled",
    type,
    nodeType: raw.nodeType || type,
    project: raw.project || "default",
    description: raw.description || "",
    body: raw.body || "",
    modifiedAt: raw.modifiedAt || new Date().toISOString(),
    file: raw.file || null,
    path: raw.path || null,
    // Pass through any extra fields
    ...(raw.startedAt && { startedAt: raw.startedAt }),
    ...(raw.endedAt && { endedAt: raw.endedAt }),
    ...(raw.messageCount && { messageCount: raw.messageCount }),
    ...(raw.fileSize && { fileSize: raw.fileSize }),
    ...(raw.toolsUsed && { toolsUsed: raw.toolsUsed }),
    ...(raw.sessionId && { sessionId: raw.sessionId }),
    ...(raw.slug && { slug: raw.slug }),
    ...(raw.gitBranch && { gitBranch: raw.gitBranch }),
    ...(raw.version && { version: raw.version }),
    ...(raw.cwd && { cwd: raw.cwd }),
    ...(raw.turnCount && { turnCount: raw.turnCount }),
    ...(raw.duration && { duration: raw.duration }),
    ...(raw.summary && { summary: raw.summary }),
    ...(raw.firstMessage && { firstMessage: raw.firstMessage }),
    ...(raw._filePath && { _filePath: raw._filePath }),
  };
}

function validateNode(node) {
  return node && typeof node.id === "string" && typeof node.name === "string";
}

module.exports = { normalizeNode, validateNode };
