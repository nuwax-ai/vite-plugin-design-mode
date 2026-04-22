#!/usr/bin/env bash

set -euo pipefail

# 一次性同步多包版本号与内部依赖版本。
# 这样可以避免手工修改多个 package.json 时漏改或改错。
#
# 用法：
#   ./scripts/release-version-sync.sh 1.1.0-beta.6

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>"
  exit 1
fi

NEW_VERSION="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[version-sync] syncing all package versions to $NEW_VERSION..."
node - "$NEW_VERSION" <<'NODE'
const fs = require("fs");
const path = require("path");

const newVersion = process.argv[2];
const root = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + "\n");
}

const files = {
  root: "package.json",
  shared: "packages/client-shared/package.json",
  react: "packages/client-react/package.json",
  vue: "packages/client-vue/package.json",
  plugin: "packages/plugin/package.json",
};

const rootPkg = readJson(files.root);
const sharedPkg = readJson(files.shared);
const reactPkg = readJson(files.react);
const vuePkg = readJson(files.vue);
const pluginPkg = readJson(files.plugin);

rootPkg.version = newVersion;
sharedPkg.version = newVersion;
reactPkg.version = newVersion;
vuePkg.version = newVersion;
pluginPkg.version = newVersion;

reactPkg.dependencies = reactPkg.dependencies || {};
vuePkg.dependencies = vuePkg.dependencies || {};
pluginPkg.dependencies = pluginPkg.dependencies || {};

reactPkg.dependencies["@xagi/design-mode-shared"] = newVersion;
vuePkg.dependencies["@xagi/design-mode-shared"] = newVersion;
pluginPkg.dependencies["@xagi/design-mode-shared"] = newVersion;
pluginPkg.dependencies["@xagi/design-mode-client-react"] = newVersion;
pluginPkg.dependencies["@xagi/design-mode-client-vue"] = newVersion;

writeJson(files.root, rootPkg);
writeJson(files.shared, sharedPkg);
writeJson(files.react, reactPkg);
writeJson(files.vue, vuePkg);
writeJson(files.plugin, pluginPkg);
NODE

echo "[version-sync] done."
