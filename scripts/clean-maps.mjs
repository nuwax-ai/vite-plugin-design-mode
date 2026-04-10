import { rm } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);
const distDir = join(root, 'dist');

/**
 * Recursively remove all `.map` files.
 */
async function removeMapFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await removeMapFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.map')) {
      await rm(fullPath);
      console.log(`[clean-maps] Removed ${fullPath.replace(root + '/', '')}`);
    }
  }
}

try {
  await removeMapFiles(distDir);
  console.log(`[clean-maps] Cleaned all .map files from dist directory`);
} catch (error) {
  console.error(`[clean-maps] Error:`, error);
  process.exit(1);
}

