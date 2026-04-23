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

# npm 注册表在刚 publish 后可能短暂不一致；这里做有限次重试，避免 release:next 误报失败。
MAX_TRIES="${VERIFY_NEXT_MAX_TRIES:-18}"
SLEEP_SECS="${VERIFY_NEXT_SLEEP_SECS:-2}"

all_checks_ok() {
  local current_next
  current_next="$(npm view @xagi/vite-plugin-design-mode dist-tags.next 2>/dev/null || true)"
  if [[ "$current_next" != "$TARGET_VERSION" ]]; then
    return 1
  fi
  npm view "@xagi/design-mode-shared@$TARGET_VERSION" version >/dev/null 2>&1 || return 1
  npm view "@xagi/design-mode-client-react@$TARGET_VERSION" version >/dev/null 2>&1 || return 1
  npm view "@xagi/design-mode-client-vue@$TARGET_VERSION" version >/dev/null 2>&1 || return 1
  npm view "@xagi/vite-plugin-design-mode@$TARGET_VERSION" version >/dev/null 2>&1 || return 1
  return 0
}

try=1
while [[ "$try" -le "$MAX_TRIES" ]]; do
  if all_checks_ok; then
    echo "[verify-next] checking plugin dist-tags..."
    npm view @xagi/vite-plugin-design-mode dist-tags
    echo "[verify-next] checking published versions exist..."
    npm view "@xagi/design-mode-shared@$TARGET_VERSION" version
    npm view "@xagi/design-mode-client-react@$TARGET_VERSION" version
    npm view "@xagi/design-mode-client-vue@$TARGET_VERSION" version
    npm view "@xagi/vite-plugin-design-mode@$TARGET_VERSION" version
    echo "[verify-next] all checks passed (attempt $try/$MAX_TRIES)."
    echo "[verify-next] hint for consumers: pnpm add @xagi/vite-plugin-design-mode@next -D"
    exit 0
  fi
  echo "[verify-next] registry not fully consistent yet (attempt $try/$MAX_TRIES), sleeping ${SLEEP_SECS}s..."
  sleep "$SLEEP_SECS"
  try=$((try + 1))
done

echo "[verify-next] error: after $MAX_TRIES attempts, dist-tag next or one of the packages is not visible for $TARGET_VERSION"
echo "[verify-next] current dist-tags:"
npm view @xagi/vite-plugin-design-mode dist-tags 2>/dev/null || true
echo "[verify-next] hint: wait and re-run: ./scripts/release-verify-next.sh $TARGET_VERSION"
echo "[verify-next] or: npm dist-tag add @xagi/vite-plugin-design-mode@$TARGET_VERSION next"
exit 1
