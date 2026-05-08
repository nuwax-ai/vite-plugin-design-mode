// 构建后把 src 下所有 .vue 复制到 dist，与 tsc 输出目录一致。
//
// 背景：tsc 只编译 .ts 为 dist 下的 .js，不会复制 .vue；但 dist/index.js 仍 import './DesignModeApp.vue'。
// Vite 虚拟模块会把相对路径改成绝对路径，若 dist 里没有对应 .vue 会报 Failed to resolve import。
//
// 用法：package.json 的 build 在 tsc 之后执行本脚本。
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');
const srcDir = join(pkgRoot, 'src');
const distDir = join(pkgRoot, 'dist');

/**
 * 递归遍历目录，将每个 `.vue` 复制到 dist 中相同相对路径。
 * @param {string} dir 当前正在扫描的目录（绝对路径，位于 src 下）
 */
function copyVueFiles(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      copyVueFiles(full);
      continue;
    }
    if (!ent.name.endsWith('.vue')) {
      continue;
    }
    const rel = relative(srcDir, full);
    const outPath = join(distDir, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(full, outPath);
  }
}

if (!statSync(srcDir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('[copy-vue-to-dist] src directory not found:', srcDir);
  process.exit(1);
}
if (!statSync(distDir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('[copy-vue-to-dist] dist directory not found; run tsc first:', distDir);
  process.exit(1);
}

copyVueFiles(srcDir);
console.log('[copy-vue-to-dist] Copied all .vue files from src to dist.');
