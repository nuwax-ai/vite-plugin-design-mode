#!/usr/bin/env bash

set -euo pipefail

# 这个脚本按依赖拓扑发布到 npm next tag。
# 发布顺序不能乱：
# 1) shared 必须先发布（react/vue/plugin 都依赖它）
# 2) react 与 vue 互不依赖，可以并发发布提升速度
# 3) plugin 最后发布（依赖 shared + react + vue）

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[publish-next] publishing @xagi/design-mode-shared..."
(
  cd packages/client-shared
  npm publish --access=public --tag next
)

echo "[publish-next] publishing @xagi/design-mode-client-react and @xagi/design-mode-client-vue in parallel..."
(
  cd packages/client-react
  npm publish --access=public --tag next
) &
PID_REACT=$!

(
  cd packages/client-vue
  npm publish --access=public --tag next
) &
PID_VUE=$!

wait "$PID_REACT"
wait "$PID_VUE"

echo "[publish-next] publishing @xagi/vite-plugin-design-mode..."
(
  cd packages/plugin
  npm publish --access=public --tag next
)

echo "[publish-next] done."
echo ""
echo "[publish-next] --- 给集成方 / 模板维护者（复制即可）---"
echo "  pnpm add @xagi/vite-plugin-design-mode@next -D"
echo "  请勿在 README 中写死 beta.N；next 即当前灰度线。"
echo "[publish-next] ---"
