#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
ZIP_NAME="neural-graph-visualizer.zip"

echo "=== Building Neural Graph Visualizer Plugin ZIP ==="

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR/$ZIP_NAME"

cd "$PROJECT_DIR"

zip -r "$DIST_DIR/$ZIP_NAME" \
  .claude-plugin/ \
  .mcp.json \
  LICENSE \
  CLAUDE.md \
  mcp-server/ \
  ui/ \
  config/ \
  skills/ \
  commands/ \
  package.json \
  -x '*.DS_Store' \
  -x 'mcp-server/*.test.js' \
  -x 'ui/js/lib/addons/*'

echo ""
echo "Built: $DIST_DIR/$ZIP_NAME"
echo "Size: $(du -h "$DIST_DIR/$ZIP_NAME" | cut -f1)"
