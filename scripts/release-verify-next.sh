#!/usr/bin/env bash

set -euo pipefail

# 这个脚本用于发布后验证：
# 1) 核验 plugin 的 next dist-tag 是否指向目标版本
# 2) 核验 4 个发布包在 registry 上可见
#
# 用法：
#   ./scripts/release-verify-next.sh              # 默认读取根 package.json 版本
#   ./scripts/release-verify-next.sh 1.1.0-beta.5 # 手动指定版本

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_VERSION="${1:-}"
if [[ -z "$TARGET_VERSION" ]]; then
  TARGET_VERSION="$(node -p "require('./package.json').version")"
fi

echo "[verify-next] target version: $TARGET_VERSION"
echo "[verify-next] checking plugin dist-tags..."
npm view @xagi/vite-plugin-design-mode dist-tags

CURRENT_NEXT="$(npm view @xagi/vite-plugin-design-mode dist-tags.next)"
if [[ "$CURRENT_NEXT" != "$TARGET_VERSION" ]]; then
  echo "[verify-next] error: dist-tags.next is '$CURRENT_NEXT', expected '$TARGET_VERSION'"
  echo "[verify-next] hint: run 'npm dist-tag add @xagi/vite-plugin-design-mode@$TARGET_VERSION next'"
  exit 1
fi

echo "[verify-next] checking published versions exist..."
npm view "@xagi/design-mode-shared@$TARGET_VERSION" version
npm view "@xagi/design-mode-client-react@$TARGET_VERSION" version
npm view "@xagi/design-mode-client-vue@$TARGET_VERSION" version
npm view "@xagi/vite-plugin-design-mode@$TARGET_VERSION" version

echo "[verify-next] all checks passed."
