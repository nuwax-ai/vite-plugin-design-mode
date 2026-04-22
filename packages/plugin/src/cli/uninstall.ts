#!/usr/bin/env node

/**
 * Uninstall: remove devDependency and strip plugin from vite.config.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';

const PLUGIN_NAME = '@xagi/vite-plugin-design-mode';
const VITE_CONFIG_FILES = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];

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

function isPluginInstalled(packageJson: PackageJson): boolean {
  return !!packageJson.dependencies?.[PLUGIN_NAME] || !!packageJson.devDependencies?.[PLUGIN_NAME];
}

function removePluginFromPackageJson(packageJson: PackageJson): PackageJson {
  if (!isPluginInstalled(packageJson)) {
    return packageJson;
  }

  if (packageJson.dependencies?.[PLUGIN_NAME]) {
    delete packageJson.dependencies[PLUGIN_NAME];
    if (Object.keys(packageJson.dependencies).length === 0) {
      delete packageJson.dependencies;
    }
  }

  if (packageJson.devDependencies?.[PLUGIN_NAME]) {
    delete packageJson.devDependencies[PLUGIN_NAME];
    if (Object.keys(packageJson.devDependencies).length === 0) {
      delete packageJson.devDependencies;
    }
  }

  return packageJson;
}

function findViteConfig(projectRoot: string): string | null {
  for (const file of VITE_CONFIG_FILES) {
    const configPath = join(projectRoot, file);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

function removeImport(content: string): string {
  const importPatterns = [
    /import\s+appdevDesignMode\s+from\s+['"]@xagi\/vite-plugin-design-mode['"];?\s*\n?/g,
    /import\s+\{\s*default\s+as\s+appdevDesignMode\s*\}\s+from\s+['"]@xagi\/vite-plugin-design-mode['"];?\s*\n?/g,
  ];

  let result = content;
  for (const pattern of importPatterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

function removePluginConfig(content: string): string {
  const pluginCallPattern = /appdevDesignMode\s*\([^)]*\)/g;
  let result = content.replace(pluginCallPattern, '');
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/,\s*\]/g, ']');
  result = result.replace(/\[\s*,/g, '[');
  result = result.replace(/,\s*}/g, '}');
  result = result.replace(/\/\/\s*appdevDesignMode.*?\n/g, '');
  result = result.replace(/\/\*\s*appdevDesignMode.*?\*\//g, '');
  result = result.replace(/,\s*plugins\s*:\s*\[\s*\]/g, '');
  result = result.replace(/plugins\s*:\s*\[\s*\]\s*,?/g, '');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/[ \t]+$/gm, '');
  return result;
}

function main() {
  console.log('Removing @xagi/vite-plugin-design-mode...\n');
  const projectRoot = findProjectRoot();
  const packageJsonPath = join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.error('Error: package.json not found');
    process.exit(1);
  }

  const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (!isPluginInstalled(packageJson)) {
    console.log('Plugin not listed in package.json, nothing to remove.');
    return;
  }

  const updatedPackageJson = removePluginFromPackageJson(packageJson);
  if (updatedPackageJson !== packageJson) {
    writeFileSync(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2) + '\n', 'utf-8');
  }

  const viteConfigPath = findViteConfig(projectRoot);
  if (!viteConfigPath) {
    console.log('Done.');
    return;
  }

  let configContent = readFileSync(viteConfigPath, 'utf-8');
  const originalContent = configContent;
  configContent = removeImport(configContent);
  configContent = removePluginConfig(configContent);

  if (configContent !== originalContent) {
    writeFileSync(viteConfigPath, configContent, 'utf-8');
  }

  console.log('Done.');
}

export { main };
