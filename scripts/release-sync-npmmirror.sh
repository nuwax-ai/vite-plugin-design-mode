#!/usr/bin/env bash

set -euo pipefail

# -----------------------------------------------------------------------------
# 手动触发 npmmirror 同步（适用于当前 monorepo 的 4 个发布包）。
#
# 目标：
# 1) 发布完成后，主动触发 npmmirror 拉取 npm 官方源的最新包元数据与 tarball
# 2) 可选做只读校验，确认镜像上是否已经可见指定版本
#
# 接口：
#   PUT https://registry.npmmirror.com/<包名>/sync
#
# 模式：
#   默认        sync  - 对目标包执行 PUT .../sync
#   --dry       dry   - 仅打印将调用的 URL，不发请求
#   --check     check - 不发 PUT，仅检查镜像 registry 是否已有该版本
#
# 包列表：
#   - 不传包名：使用默认 4 包（shared/react/vue/plugin）
#   - 传包名参数：仅处理传入包名（可多个）
#
# 环境变量：
#   NPM_MIRROR_VERSION    目标版本；未设置时读取根 package.json version
#   NPM_MIRROR_REGISTRY   镜像 registry；默认 https://registry.npmmirror.com
#   NPM_MIRROR_RETRIES    失败重试次数；默认 3
#   NPM_MIRROR_SLEEP_SECS 重试间隔秒数；默认 2
# -----------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REGISTRY="${NPM_MIRROR_REGISTRY:-https://registry.npmmirror.com}"
RETRIES="${NPM_MIRROR_RETRIES:-3}"
SLEEP_SECS="${NPM_MIRROR_SLEEP_SECS:-2}"

MODE="sync"
declare -a USER_PACKAGES=()

print_help() {
  cat <<'EOF'
用法:
  ./scripts/release-sync-npmmirror.sh [--dry | --check] [package...]

示例:
  ./scripts/release-sync-npmmirror.sh
  ./scripts/release-sync-npmmirror.sh --dry
  ./scripts/release-sync-npmmirror.sh --check
  ./scripts/release-sync-npmmirror.sh @xagi/vite-plugin-design-mode

说明:
  默认模式会对每个包调用 PUT <registry>/<pkg>/sync
  --dry   仅打印将调用的 URL
  --check 使用 npm view --registry=<npmmirror> 校验版本是否可见

环境变量:
  NPM_MIRROR_VERSION    目标版本（默认读取根 package.json version）
  NPM_MIRROR_REGISTRY   默认 https://registry.npmmirror.com
  NPM_MIRROR_RETRIES    默认 3
  NPM_MIRROR_SLEEP_SECS 默认 2
EOF
}

# 参数解析：支持模式参数与可选包名参数混合。
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry)
      MODE="dry"
      shift
      ;;
    --check)
      MODE="check"
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    --)
      # 兼容 pnpm `script -- --flag` 形式：仅丢弃分隔符，后续参数继续按正常规则解析。
      shift
      ;;
    -*)
      echo "未知参数: $1（支持 --dry / --check / --help）" >&2
      exit 2
      ;;
    *)
      USER_PACKAGES+=("$1")
      shift
      ;;
  esac
done

TARGET_VERSION="${NPM_MIRROR_VERSION:-}"
if [[ -z "$TARGET_VERSION" ]]; then
  TARGET_VERSION="$(node -pe "require('./package.json').version")"
fi

# 默认发布包列表与 release 脚本保持一致。
declare -a DEFAULT_PACKAGES=(
  "@xagi/design-mode-shared"
  "@xagi/design-mode-client-react"
  "@xagi/design-mode-client-vue"
  "@xagi/vite-plugin-design-mode"
)

declare -a PACKAGES=()
if [[ "${#USER_PACKAGES[@]}" -gt 0 ]]; then
  PACKAGES=("${USER_PACKAGES[@]}")
else
  PACKAGES=("${DEFAULT_PACKAGES[@]}")
fi

echo "版本: ${TARGET_VERSION}"
echo "模式: ${MODE}"
echo "镜像: ${REGISTRY}"
echo "包数: ${#PACKAGES[@]}"
echo "----------"

sync_one() {
  local pkg="$1"
  local url="${REGISTRY%/}/${pkg}/sync"
  local body_file
  body_file="$(mktemp)"

  local attempt=1
  while [[ "$attempt" -le "$RETRIES" ]]; do
    if curl -fsS -X PUT "$url" -o "$body_file" 2>/dev/null; then
      local body
      body="$(tr -d '\n' < "$body_file" || true)"
      rm -f "$body_file"
      echo "OK   ${pkg} (attempt ${attempt}/${RETRIES}) ${body}"
      return 0
    fi
    if [[ "$attempt" -lt "$RETRIES" ]]; then
      echo "RETRY ${pkg} (attempt ${attempt}/${RETRIES}), sleep ${SLEEP_SECS}s..."
      sleep "$SLEEP_SECS"
    fi
    attempt=$((attempt + 1))
  done

  echo "FAIL ${pkg}"
  cat "$body_file" 2>/dev/null || true
  rm -f "$body_file"
  return 1
}

check_one() {
  local pkg="$1"
  local got
  got="$(npm view "${pkg}@${TARGET_VERSION}" version --registry="${REGISTRY}" 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$got" == "$TARGET_VERSION" ]]; then
    echo "OK   ${pkg}@${TARGET_VERSION}"
    return 0
  fi
  echo "MISS ${pkg}@${TARGET_VERSION} (镜像返回: ${got:-无/404})"
  return 1
}

FAILED=0
declare -a FAILED_PACKAGES=()

for pkg in "${PACKAGES[@]}"; do
  case "$MODE" in
    dry)
      echo "PUT ${REGISTRY%/}/${pkg}/sync"
      ;;
    sync)
      if ! sync_one "$pkg"; then
        FAILED=1
        FAILED_PACKAGES+=("$pkg")
      fi
      ;;
    check)
      if ! check_one "$pkg"; then
        FAILED=1
        FAILED_PACKAGES+=("$pkg")
      fi
      ;;
  esac
done

echo "----------"
if [[ "$FAILED" -ne 0 ]]; then
  echo "失败包:"
  for pkg in "${FAILED_PACKAGES[@]}"; do
    echo " - ${pkg}"
  done
  if [[ "$MODE" == "check" ]]; then
    echo "提示: npm 官方可能已发布但镜像尚未同步，先执行 sync 模式后再 check。"
  else
    echo "提示: 可稍后重试；也可先确认 npm 官方 registry 已存在对应版本。"
  fi
  exit 1
fi

echo "完成。"
