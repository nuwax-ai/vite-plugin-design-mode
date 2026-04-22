#!/usr/bin/env bash

set -euo pipefail

# 这个脚本用于发布前演练，不会执行真实 npm publish。
# 目标是提前发现“构建、打包内容、依赖声明、发布前校验”类问题。
#
# 演练内容：
# 1) 运行 release-preflight（registry / 版本一致 / workspace 协议）
# 2) 构建所有包
# 3) 在每个发布包目录执行 npm publish --dry-run，检查将发布的 tarball 内容

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[dry-run] step 1/3: preflight checks..."
bash ./scripts/release-preflight.sh

echo "[dry-run] step 2/3: build all packages..."
pnpm -r --filter './packages/**' build

echo "[dry-run] step 3/3: simulate npm publish..."
(
  cd packages/client-shared
  npm publish --access=public --tag next --dry-run
)
(
  cd packages/client-react
  npm publish --access=public --tag next --dry-run
)
(
  cd packages/client-vue
  npm publish --access=public --tag next --dry-run
)
(
  cd packages/plugin
  npm publish --access=public --tag next --dry-run
)

echo "[dry-run] done. no package was actually published."
