#!/usr/bin/env bash

set -euo pipefail

# 这个脚本用于发布前的硬性校验。
# 设计目标：尽量在真正 npm publish 之前发现问题，避免发布一半才失败。
#
# 校验项：
# 1) 当前 npm registry 必须是 npmjs 官方源（防止发到镜像源）
# 2) 根包与 4 个发布包版本号必须完全一致（统一版本策略）
# 3) 发布包 package.json 中禁止出现 workspace:*（外部安装无法解析）

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[preflight] checking npm registry..."
REGISTRY="$(npm config get registry)"
if [[ "$REGISTRY" != "https://registry.npmjs.org/" ]]; then
  echo "[preflight] error: registry is '$REGISTRY', expected 'https://registry.npmjs.org/'"
  echo "[preflight] hint: run 'nrm use npm' first."
  exit 1
fi

echo "[preflight] checking version consistency..."
node <<'NODE'
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const packageFiles = [
  "package.json",
  "packages/client-shared/package.json",
  "packages/client-react/package.json",
  "packages/client-vue/package.json",
  "packages/plugin/package.json",
];

const versions = packageFiles.map((file) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  return { file, version: pkg.version };
});

const uniqueVersions = [...new Set(versions.map((item) => item.version))];
if (uniqueVersions.length !== 1) {
  console.error("[preflight] error: versions are not aligned:");
  for (const item of versions) {
    console.error(`  - ${item.file}: ${item.version}`);
  }
  process.exit(1);
}

console.log(`[preflight] version aligned: ${uniqueVersions[0]}`);
NODE

echo "[preflight] checking workspace protocol leakage..."
if rg "workspace:\\*" packages/*/package.json >/dev/null; then
  echo "[preflight] error: found 'workspace:*' in publishable package dependencies."
  echo "[preflight] hint: replace with explicit semver before publish."
  exit 1
fi

echo "[preflight] all checks passed."
