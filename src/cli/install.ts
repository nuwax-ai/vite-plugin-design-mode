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
    
    // Typical under npx: .../node_modules/@xagi/.../dist/cli/install.js
    // /Users/xxx/.npm/_npx/xxx/node_modules/@xagi/vite-plugin-design-mode/dist/cli/install.js
    let currentDir = resolve(__dirname);
    const root = resolve('/');
    
    // Max 5 parents
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
        } catch (e) {
          // Invalid JSON — keep walking
        }
      }
      currentDir = dirname(currentDir);
      depth++;
    }
  } catch (e) {
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

/** package.json lists vite */
function hasVite(packageJson: PackageJson): boolean {
  return (
    !!packageJson.dependencies?.vite ||
    !!packageJson.devDependencies?.vite
  );
}

/** package.json lists react */
function hasReact(packageJson: PackageJson): boolean {
  return (
    !!packageJson.dependencies?.react ||
    !!packageJson.devDependencies?.react
  );
}

/** PLUGIN_NAME present in deps */
function isPluginInstalled(packageJson: PackageJson): boolean {
  return (
    !!packageJson.dependencies?.[PLUGIN_NAME] ||
    !!packageJson.devDependencies?.[PLUGIN_NAME]
  );
}

function addPluginToPackageJson(packageJson: PackageJson, version: string): PackageJson {
  const isInstalled = isPluginInstalled(packageJson);

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
  const pluginPatterns = [
    /appdevDesignMode\s*\(/,
    /appdevDesignMode\s*\(\s*\{/,
  ];
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
    
    // Match quote style of last import
    const useSingleQuote = lastImport.includes("'");
    const quote = useSingleQuote ? "'" : '"';
    
    const newImport = `\nimport appdevDesignMode from ${quote}@xagi/vite-plugin-design-mode${quote};`;
    return content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
  }
  
  // No imports — prepend
  const useSingleQuote = content.includes("'");
  const quote = useSingleQuote ? "'" : '"';
  return `import appdevDesignMode from ${quote}@xagi/vite-plugin-design-mode${quote};\n${content}`;
}

function addPluginConfig(content: string): string {
  if (hasPluginConfig(content)) {
    return content.replace(
      /appdevDesignMode\s*\([^)]*\)/g,
      'appdevDesignMode()'
    );
  }

  // Find `plugins: [` … `]` with bracket depth + string awareness
  const pluginsArrayRegex = /plugins\s*:\s*\[/;
  const match = content.match(pluginsArrayRegex);
  
  if (match) {
    const startIndex = match.index! + match[0].length;
    
    // Scan for matching `]`
    let depth = 1;
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    let inTemplateString = false;
    
    while (i < content.length && depth > 0) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      // String literals
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString && !inTemplateString) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
      
      // Template literals
      if (char === '`' && prevChar !== '\\') {
        inTemplateString = !inTemplateString;
      }
      
      // Brackets outside strings
      if (!inString && !inTemplateString) {
        if (char === '[') {
          depth++;
        } else if (char === ']') {
          depth--;
          if (depth === 0) {
            // Closing `]` of plugins array
            const beforeClosing = content.substring(startIndex, i);
            const afterClosing = content.substring(i);
            
            const cleanedBefore = beforeClosing
              .replace(/\/\/.*$/gm, '')
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .trim();
            
            const hasOtherPlugins = cleanedBefore.length > 0;
            
            // Indent from `plugins:` line
            const beforePlugins = content.substring(0, match.index!);
            const lastNewlineIndex = beforePlugins.lastIndexOf('\n');
            const pluginsLine = beforePlugins.substring(lastNewlineIndex + 1);
            const indent = pluginsLine.match(/^(\s*)/)?.[1] || '  ';
            
            let newContent;
            if (hasOtherPlugins) {
              let lastNonWhitespace = beforeClosing.length - 1;
              while (lastNonWhitespace >= 0 && /\s/.test(beforeClosing[lastNonWhitespace])) {
                lastNonWhitespace--;
              }
              
              const lastChar = lastNonWhitespace >= 0 ? beforeClosing[lastNonWhitespace] : '';
              const needsComma = lastChar !== ',';
              
              const insertText = (needsComma ? ',' : '') + '\n' + indent + '    appdevDesignMode()';
              
              newContent = content.substring(0, startIndex + lastNonWhitespace + 1) + 
                          insertText + 
                          '\n' + indent + afterClosing;
            } else {
              newContent = content.substring(0, startIndex) + 
                          '\n' + indent + '    appdevDesignMode()\n' + indent + afterClosing;
            }
            
            return newContent;
          }
        }
      }
      
      i++;
    }
  }
  
  // Fallback: inject into defineConfig({ ... })
  const defineConfigRegex = /defineConfig\s*\(\s*\{([\s\S]*?)\}\s*\)/;
  const configMatch = content.match(defineConfigRegex);
  
  if (configMatch) {
    const configContent = configMatch[1];
    const configObject = configMatch[0];
    
    const pluginsConfig = `\n  plugins: [\n    appdevDesignMode()\n  ],`;
    const newConfigObject = configObject.replace(
      /\}\s*\)$/,
      `${pluginsConfig}\n}`
    );
    
    return content.replace(defineConfigRegex, newConfigObject);
  }
  
  return `${content}\n\n// appdevDesignMode plugin\nplugins: [appdevDesignMode()],`;
}

function main() {
  console.log('🚀 Installing @xagi/vite-plugin-design-mode...\n');

  const projectRoot = findProjectRoot();
  console.log(`📁 Project root: ${projectRoot}\n`);

  const packageJsonPath = join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.error('✗ Error: package.json not found');
    console.error(`  Directory: ${projectRoot}`);
    console.error('  Run this command from your project root.');
    process.exit(1);
  }

  const packageJson: PackageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf-8')
  );

  const hasViteDep = hasVite(packageJson);
  const hasReactDep = hasReact(packageJson);
  
  if (!hasViteDep) {
    console.error('✗ Error: Vite not found in package.json');
    console.error('  This plugin requires a Vite project.');
    console.error('  Install Vite: npm install vite --save-dev');
    process.exit(1);
  }
  
  if (!hasReactDep) {
    console.error('✗ Error: React not found in package.json');
    console.error('  This plugin targets React + Vite.');
    console.error('  Install: npm install react react-dom');
    process.exit(1);
  }
  
  console.log('✓ Detected Vite + React');

  const pluginVersion = getPluginVersion();
  console.log(`📦 Plugin version: ${pluginVersion}`);

  const isInstalled = isPluginInstalled(packageJson);
  console.log(`🔍 Plugin in package.json: ${isInstalled ? 'yes' : 'no'}`);

  const updatedPackageJson = addPluginToPackageJson(packageJson, pluginVersion);
  const versionString = `^${pluginVersion}`;
  const currentVersion = packageJson.devDependencies?.[PLUGIN_NAME] || packageJson.dependencies?.[PLUGIN_NAME];
  
  if (!isInstalled || currentVersion !== versionString) {
    writeFileSync(
      packageJsonPath,
      JSON.stringify(updatedPackageJson, null, 2) + '\n',
      'utf-8'
    );
    if (isInstalled) {
      console.log(`✓ Updated package.json: ${PLUGIN_NAME}@${versionString}`);
    } else {
      console.log(`✓ Added to package.json: ${PLUGIN_NAME}@${versionString}`);
    }
  } else {
    console.log(`ℹ️  package.json already has ${PLUGIN_NAME}@${currentVersion}`);
  }

  const viteConfigPath = findViteConfig(projectRoot);
  if (!viteConfigPath) {
    console.warn('\n⚠️  No vite.config.ts/js/mjs found');
    console.warn('  Add manually:');
    console.warn('  import appdevDesignMode from "@xagi/vite-plugin-design-mode";');
    console.warn('  plugins: [appdevDesignMode()]');
    console.log('\n✅ Done.');
    console.log('Run your package manager (e.g. pnpm install) to fetch deps.\n');
    return;
  }

  console.log(`📝 Vite config: ${viteConfigPath}`);

  let configContent = readFileSync(viteConfigPath, 'utf-8');
  const originalContent = configContent;

  configContent = addImport(configContent);

  configContent = addPluginConfig(configContent);

  if (configContent !== originalContent) {
    writeFileSync(viteConfigPath, configContent, 'utf-8');
    console.log(`✓ Updated ${viteConfigPath}`);
  } else {
    console.log(`ℹ️  Vite config already references the plugin`);
  }

  console.log('\n✅ Done.');
  console.log('\n📦 Next: install dependencies, e.g.:');
  console.log('  - pnpm install');
  console.log('  - npm install');
  console.log('  - yarn install');
  console.log('\nThe plugin is intended for dev; production builds omit it unless you enable that in options.\n');
}

export { main };
