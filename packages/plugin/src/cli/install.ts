#!/usr/bin/env node

/**
 * Install flow: add devDependency + wire `appdevDesignMode()` in Vite config.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const PLUGIN_NAME = '@xagi/vite-plugin-design-mode';
const VITE_CONFIG_FILES = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];

/**
 * Read plugin version by walking up from this file until the package named PLUGIN_NAME is found.
 */
function getPluginVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    let currentDir = resolve(__dirname);
    const root = resolve('/');
    let depth = 0;
    const maxDepth = 5;

    while (currentDir !== root && depth < maxDepth) {
      const packageJsonPath = join(currentDir, 'package.json');
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === PLUGIN_NAME && packageJson.version) {
            return packageJson.version;
          }
        } catch (_error) {
          // Invalid JSON — keep walking
        }
      }
      currentDir = dirname(currentDir);
      depth++;
    }
  } catch (_error) {
    // Fallback to latest below
  }

  return 'latest';
}

/** Walk up from startDir until package.json exists. */
function findProjectRoot(startDir: string = process.cwd()): string {
  let currentDir = resolve(startDir);
  const root = resolve('/');

  while (currentDir !== root) {
    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return startDir;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

function getDependencyVersion(packageJson: PackageJson, depName: string): string | undefined {
  return packageJson.dependencies?.[depName] || packageJson.devDependencies?.[depName];
}

/** package.json lists vite */
function hasVite(packageJson: PackageJson): boolean {
  return !!packageJson.dependencies?.vite || !!packageJson.devDependencies?.vite;
}

/** package.json lists react */
function hasReact(packageJson: PackageJson): boolean {
  return !!packageJson.dependencies?.react || !!packageJson.devDependencies?.react;
}

/** package.json lists vue */
function hasVue(packageJson: PackageJson): boolean {
  return !!getDependencyVersion(packageJson, 'vue');
}

/**
 * Returns false only when we can confidently identify a Vue 2 range.
 * Unknown or non-semver formats (workspace:, github:, file:) are treated as supported.
 */
function isVue3Version(version: string): boolean {
  const normalized = version.trim();
  if (!normalized) return true;

  if (/(^|[^\d])2\./.test(normalized) || /(^|[^\d])\^?~?2(\D|$)/.test(normalized)) {
    return false;
  }

  if (/(^|[^\d])3\./.test(normalized) || /(^|[^\d])\^?~?3(\D|$)/.test(normalized)) {
    return true;
  }

  return true;
}

/** PLUGIN_NAME present in deps */
function isPluginInstalled(packageJson: PackageJson): boolean {
  return !!packageJson.dependencies?.[PLUGIN_NAME] || !!packageJson.devDependencies?.[PLUGIN_NAME];
}

function addPluginToPackageJson(packageJson: PackageJson, version: string): PackageJson {
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  packageJson.devDependencies[PLUGIN_NAME] = `^${version}`;
  return packageJson;
}

/** First existing vite.config.{ts,js,mjs} */
function findViteConfig(projectRoot: string): string | null {
  for (const file of VITE_CONFIG_FILES) {
    const configPath = join(projectRoot, file);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

function hasImport(content: string): boolean {
  const importPatterns = [
    /import\s+appdevDesignMode\s+from\s+['"]@xagi\/vite-plugin-design-mode['"]/,
    /import\s+\{\s*default\s+as\s+appdevDesignMode\s*\}\s+from\s+['"]@xagi\/vite-plugin-design-mode['"]/,
  ];
  return importPatterns.some(pattern => pattern.test(content));
}

function hasPluginConfig(content: string): boolean {
  const pluginPatterns = [/appdevDesignMode\s*\(/, /appdevDesignMode\s*\(\s*\{/];
  return pluginPatterns.some(pattern => pattern.test(content));
}

function addImport(content: string): string {
  if (hasImport(content)) {
    return content;
  }

  const importRegex = /^import\s+.*?from\s+['"].*?['"];?$/gm;
  const imports = content.match(importRegex);

  if (imports && imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertIndex = lastImportIndex + lastImport.length;
    const useSingleQuote = lastImport.includes("'");
    const quote = useSingleQuote ? "'" : '"';

    const newImport = `\nimport appdevDesignMode from ${quote}@xagi/vite-plugin-design-mode${quote};`;
    return content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
  }

  const useSingleQuote = content.includes("'");
  const quote = useSingleQuote ? "'" : '"';
  return `import appdevDesignMode from ${quote}@xagi/vite-plugin-design-mode${quote};\n${content}`;
}

function addPluginConfig(content: string): string {
  if (hasPluginConfig(content)) {
    return content.replace(/appdevDesignMode\s*\([^)]*\)/g, 'appdevDesignMode()');
  }

  const pluginsArrayRegex = /plugins\s*:\s*\[/;
  const match = content.match(pluginsArrayRegex);

  if (match) {
    const startIndex = match.index! + match[0].length;
    let depth = 1;
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    let inTemplateString = false;

    while (i < content.length && depth > 0) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString && !inTemplateString) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      if (char === '`' && prevChar !== '\\') {
        inTemplateString = !inTemplateString;
      }

      if (!inString && !inTemplateString) {
        if (char === '[') {
          depth++;
        } else if (char === ']') {
          depth--;
          if (depth === 0) {
            const beforeClosing = content.substring(startIndex, i);
            const afterClosing = content.substring(i);

            const cleanedBefore = beforeClosing
              .replace(/\/\/.*$/gm, '')
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .trim();

            const hasOtherPlugins = cleanedBefore.length > 0;
            const beforePlugins = content.substring(0, match.index!);
            const lastNewlineIndex = beforePlugins.lastIndexOf('\n');
            const pluginsLine = beforePlugins.substring(lastNewlineIndex + 1);
            const indent = pluginsLine.match(/^(\s*)/)?.[1] || '  ';

            if (hasOtherPlugins) {
              let lastNonWhitespace = beforeClosing.length - 1;
              while (lastNonWhitespace >= 0 && /\s/.test(beforeClosing[lastNonWhitespace])) {
                lastNonWhitespace--;
              }

              const lastChar = lastNonWhitespace >= 0 ? beforeClosing[lastNonWhitespace] : '';
              const needsComma = lastChar !== ',';
              const insertText = (needsComma ? ',' : '') + '\n' + indent + '    appdevDesignMode()';

              return (
                content.substring(0, startIndex + lastNonWhitespace + 1) +
                insertText +
                '\n' +
                indent +
                afterClosing
              );
            }

            return (
              content.substring(0, startIndex) +
              '\n' +
              indent +
              '    appdevDesignMode()\n' +
              indent +
              afterClosing
            );
          }
        }
      }

      i++;
    }
  }

  const defineConfigRegex = /defineConfig\s*\(\s*\{([\s\S]*?)\}\s*\)/;
  const configMatch = content.match(defineConfigRegex);

  if (configMatch) {
    const configObject = configMatch[0];
    const pluginsConfig = `\n  plugins: [\n    appdevDesignMode()\n  ],`;
    const newConfigObject = configObject.replace(/\}\s*\)$/, `${pluginsConfig}\n}`);
    return content.replace(defineConfigRegex, newConfigObject);
  }

  return `${content}\n\n// appdevDesignMode plugin\nplugins: [appdevDesignMode()],`;
}

function main() {
  console.log('Installing @xagi/vite-plugin-design-mode...\n');
  const projectRoot = findProjectRoot();
  console.log(`Project root: ${projectRoot}\n`);

  const packageJsonPath = join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.error('Error: package.json not found');
    console.error(`Directory: ${projectRoot}`);
    console.error('Run this command from your project root.');
    process.exit(1);
  }

  const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const hasViteDep = hasVite(packageJson);
  const hasReactDep = hasReact(packageJson);
  const hasVueDep = hasVue(packageJson);
  const vueVersion = getDependencyVersion(packageJson, 'vue');
  const hasVue3Dep = hasVueDep && isVue3Version(vueVersion || '');

  if (!hasViteDep) {
    console.error('Error: Vite not found in package.json');
    process.exit(1);
  }
  if (!hasReactDep && !hasVueDep) {
    console.error('Error: neither React nor Vue found in package.json');
    process.exit(1);
  }
  if (!hasReactDep && hasVueDep && !hasVue3Dep) {
    console.error(`Error: unsupported Vue version: ${vueVersion}`);
    process.exit(1);
  }

  const pluginVersion = getPluginVersion();
  const isInstalled = isPluginInstalled(packageJson);
  const updatedPackageJson = addPluginToPackageJson(packageJson, pluginVersion);
  const versionString = `^${pluginVersion}`;
  const currentVersion =
    packageJson.devDependencies?.[PLUGIN_NAME] || packageJson.dependencies?.[PLUGIN_NAME];

  if (!isInstalled || currentVersion !== versionString) {
    writeFileSync(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2) + '\n', 'utf-8');
  }

  const viteConfigPath = findViteConfig(projectRoot);
  if (!viteConfigPath) {
    console.log('Done. Run your package manager install command.');
    return;
  }

  let configContent = readFileSync(viteConfigPath, 'utf-8');
  const originalContent = configContent;
  configContent = addImport(configContent);
  configContent = addPluginConfig(configContent);

  if (configContent !== originalContent) {
    writeFileSync(viteConfigPath, configContent, 'utf-8');
  }

  console.log('Done.');
}

export { main };
