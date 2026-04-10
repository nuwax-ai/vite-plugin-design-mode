import type { Plugin } from 'vite';
import { createServerMiddleware } from './core/serverMiddleware';
import { transformSourceCode } from './core/astTransformer';


export interface DesignModeOptions {
  /**
   * Whether design mode is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to enable in production builds (usually false).
   * @default false
   */
  enableInProduction?: boolean;

  /**
   * Prefix for injected source-mapping attributes.
   * @default 'data-source'
   */
  attributePrefix?: string;

  /**
   * Verbose logging.
   * @default false
   */
  verbose?: boolean;

  /**
   * Glob/path patterns to exclude from transformation.
   */
  exclude?: string[];

  /**
   * Glob/path patterns to include.
   */
  include?: string[];

  /**
   * Enable backup copies before writes.
   * @default false
   */
  enableBackup?: boolean;

  /**
   * Enable update history / batch session tracking.
   * @default false
   */
  enableHistory?: boolean;
}

const DEFAULT_OPTIONS: Required<DesignModeOptions> = {
  enabled: true,
  enableInProduction: false,
  attributePrefix: 'data-xagi',
  verbose: true,
  exclude: ['node_modules', 'dist'],
  include: ['src/**/*.{ts,js,tsx,jsx}'],
  enableBackup: false,
  enableHistory: false,
};

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Virtual module id for loading client code in Vite
const VIRTUAL_CLIENT_MODULE_ID = 'virtual:appdev-design-mode-client';
const RESOLVED_VIRTUAL_CLIENT_MODULE_ID = '\0' + VIRTUAL_CLIENT_MODULE_ID + '.tsx';

function appdevDesignModePlugin(userOptions: DesignModeOptions = {}): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  // Resolved base URL for client script injection
  let basePath = '/';
  // Current Vite command (serve vs build)
  let currentCommand: 'serve' | 'build' = 'serve';

  // Whether the plugin should run (dev by default; prod only if allowed)
  const isPluginEnabled = () => {
    if (!options.enabled) {
      return false;
    }
    // Disable during build unless production is explicitly allowed
    if (currentCommand === 'build' && !options.enableInProduction) {
      return false;
    }
    return true;
  };

  return {
    name: '@xagi/vite-plugin-design-mode',
    enforce: 'pre',

    resolveId(id) {
      // Skip virtual module when plugin is off
      if (!isPluginEnabled()) {
        return null;
      }
      if (id === VIRTUAL_CLIENT_MODULE_ID) {
        return RESOLVED_VIRTUAL_CLIENT_MODULE_ID;
      }
      return null;
    },

    load(id) {
      // Skip when plugin is off
      if (!isPluginEnabled()) {
        return null;
      }

      if (id === RESOLVED_VIRTUAL_CLIENT_MODULE_ID) {
        const clientEntryPath = resolveClientEntryPath();
        if (!existsSync(clientEntryPath)) {
          throw new Error(
            `[appdev-design-mode] Client entry not found: ${clientEntryPath}`
          );
        }
        // Rewrite relative imports to absolute paths so the virtual module resolves deps
        const code = readFileSync(clientEntryPath, 'utf-8');
        const clientDir = dirname(clientEntryPath);

        // Rewrite relative imports to absolute paths
        const rewrittenCode = code.replace(
          /from ['"]\.\/([^'"]+)['"]/g,
          (match, moduleName) => {
            const absolutePath = resolve(clientDir, moduleName);
            return `from '${absolutePath}'`;
          }
        );

        return rewrittenCode;
      }

      // **NEW: Process tsx/jsx files in load hook BEFORE React plugin**
      // This allows us to add attributes to JSX elements before they are compiled
      const shouldProcess = shouldProcessFile(id, options);

      if (shouldProcess) {
        try {
          // Read the original file content
          const code = readFileSync(id, 'utf-8');

          // Transform the code to add data attributes
          const transformedCode = transformSourceCode(code, id, options);

          // Return the transformed code
          // React plugin will then process this code to compile JSX
          return transformedCode;
        } catch (error) {
          // Return null to let other plugins handle it
          return null;
        }
      }

      return null;
    },

    config(config, { command }) {
      currentCommand = command;

      basePath = config.base || '/';
      // Normalize base: leading slash; trailing slash unless root
      if (!basePath.startsWith('/')) {
        basePath = '/' + basePath;
      }
      if (basePath !== '/' && !basePath.endsWith('/')) {
        basePath = basePath + '/';
      }

      // No extra config when plugin disabled
      if (!isPluginEnabled()) {
        return {};
      }

      const projectRoot = config.root ?? process.cwd();

      // Merge with user fs.allow
      const existingAllow = config.server?.fs?.allow || [];
      const pluginDistPath = resolve(__dirname, '..');

      const allowedPaths = new Set<string>();

      existingAllow.forEach((path: string) => {
        // Normalize to absolute paths
        const normalizedPath = resolve(path);
        allowedPaths.add(normalizedPath);
      });

      allowedPaths.add(resolve(projectRoot));

      // node_modules (dependency resolution)
      const nodeModulesPath = resolve(projectRoot, 'node_modules');
      allowedPaths.add(nodeModulesPath);

      // Plugin package root (client bundle)
      allowedPaths.add(pluginDistPath);

      return {
        define: {
          __APPDEV_DESIGN_MODE__: true,
          __APPDEV_DESIGN_MODE_VERBOSE__: options.verbose,
        },
        esbuild: {
          logOverride: { 'this-is-undefined-in-esm': 'silent' },
          jsx: 'automatic', // Ensure JSX automatic mode for all projects
          jsxDev: false,    // Disable dev mode for better performance
        },
        optimizeDeps: {
          // Pre-bundle React for dev
          include: ['react', 'react-dom'],
        },
        server: {
          fs: {
            // User entries plus required plugin paths
            allow: Array.from(allowedPaths),
          },
        },
      };
    },

    configureServer(server) {
      // Skip middleware when plugin off
      if (!isPluginEnabled()) {
        return;
      }

      // Register client code middleware
      server.middlewares.use(async (req, res, next) => {
        // Match client script URL with or without base prefix
        const url = req.url || '';
        const isClientRequest =
          url === '/@appdev-design-mode/client.js' ||
          url.endsWith('/@appdev-design-mode/client.js') ||
          url.includes('@appdev-design-mode/client.js');

        if (isClientRequest) {
          try {
            // Load bundled client via virtual module (ssr: false = browser; React from app node_modules)
            const result = await server.transformRequest(
              VIRTUAL_CLIENT_MODULE_ID,
              { ssr: false }
            );

            if (result && result.code) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(result.code);
            } else {
              throw new Error('transformRequest returned no code');
            }
          } catch (error: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end(
              `[appdev-design-mode] Failed to load client bundle: ${error.message}`
            );
            if (options.verbose) {
              console.error(
                '[appdev-design-mode] Client bundle error:',
                error
              );
            }
          }
          return;
        }

        next();
      });

      // Register the main API middleware - this handles all /__appdev_design_mode/* endpoints
      server.middlewares.use(
        '/__appdev_design_mode',
        createServerMiddleware(options, server.config.root)
      );
    },

    transformIndexHtml(html, ctx) {
      if (!isPluginEnabled()) {
        return html;
      }

      // Client script URL respects Vite base (subpath deploys)
      const clientScriptPath = `${basePath}@appdev-design-mode/client.js`.replace(/\/+/g, '/');

      // HTTP endpoint avoids /@fs and some node_modules access edge cases
      return {
        html,
        tags: [
          // Inject prefix config for runtime client
          {
            tag: 'script',
            attrs: {
              type: 'text/javascript',
            },
            injectTo: 'head',
            children: `window.__APPDEV_DESIGN_MODE_CONFIG__ = ${JSON.stringify({
              attributePrefix: options.attributePrefix,
            })};`,
          },
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: clientScriptPath,
            },
            injectTo: 'body',
          },
        ],
      };
    },

    async transform(code, id, transformOptions) {
      if (!isPluginEnabled()) {
        return code;
      }

      // Virtual client module: compile TSX with esbuild (not user's React plugin)
      if (id === RESOLVED_VIRTUAL_CLIENT_MODULE_ID) {
        const { transformWithEsbuild } = await import('vite');
        const result = await transformWithEsbuild(code, id, {
          loader: 'tsx',
          jsx: 'automatic',
          format: 'esm',
        });
        return result.code;
      }

      // Plugin package sources: esbuild only (avoids duplicate Babel runs in pnpm, etc.)
      const pluginDistPath = resolve(__dirname, '..');
      if (id.startsWith(pluginDistPath) && (id.endsWith('.tsx') || id.endsWith('.ts'))) {
        const { transformWithEsbuild } = await import('vite');
        const result = await transformWithEsbuild(code, id, {
          loader: id.endsWith('.tsx') ? 'tsx' : 'ts',
          jsx: 'automatic',
          format: 'esm',
        });
        return result.code;
      }

      const shouldProcess = shouldProcessFile(id, options);

      if (!shouldProcess) {
        return code;
      }

      try {
        const transformedCode = transformSourceCode(code, id, options);
        return transformedCode;
      } catch (error) {
        return code;
      }
    },

    buildStart() {
      if (options.verbose) {
        console.log('[appdev-design-mode] Plugin started');
      }
    },

    buildEnd() {
      if (options.verbose) {
        console.log('[appdev-design-mode] Plugin ended');
      }
    },
  };
}

/** Whether `filePath` matches include globs and not exclude patterns. */
function shouldProcessFile(
  filePath: string,
  options: Required<DesignModeOptions>
): boolean {
  if (options.exclude.some(pattern => filePath.includes(pattern))) {
    return false;
  }

  // Include globs
  const isIncluded = options.include.some(pattern => {
    // Ignore negation patterns in include (rely on exclude option)
    if (pattern.startsWith('!')) {
      return false;
    }

    // Convert glob to regex using placeholders to avoid escaping issues
    let regex = pattern;

    // 1) Placeholders for glob tokens
    // IMPORTANT: Replace **/ as a unit first to avoid double slashes
    regex = regex.replace(/\*\*\//g, '%%GLOBSTAR_SLASH%%');
    regex = regex.replace(/\*\*/g, '%%GLOBSTAR%%');
    regex = regex.replace(/\*/g, '%%WILDCARD%%');
    regex = regex.replace(/\{([^}]+)\}/g, (_, group) =>
      `%%BRACE_START%%${group.replace(/,/g, '%%COMMA%%')}%%BRACE_END%%`
    );

    // 2. Escape special regex characters
    regex = regex.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // 3. Restore placeholders with regex equivalents
    // **/ matches zero or more path segments (e.g., "", "foo/", "foo/bar/")
    regex = regex.replace(/%%GLOBSTAR_SLASH%%/g, '(([^/]+/)*)');
    // ** alone (rare) matches any characters
    regex = regex.replace(/%%GLOBSTAR%%/g, '.*');
    regex = regex.replace(/%%WILDCARD%%/g, '[^/]*');
    regex = regex.replace(/%%BRACE_START%%/g, '(');
    regex = regex.replace(/%%BRACE_END%%/g, ')');
    regex = regex.replace(/%%COMMA%%/g, '|');

    // 4. Create RegExp
    // Allow partial match for absolute paths by prepending .* if not already there
    // and not anchored
    if (!regex.startsWith('.*') && !regex.startsWith('^')) {
      regex = '.*' + regex;
    }

    const re = new RegExp(regex + '$'); // Anchor to end
    return re.test(filePath);
  });

  return isIncluded;
}

export default appdevDesignModePlugin;

function resolveClientEntryPath(): string {
  const distClientPath = resolve(__dirname, 'client/index.tsx');
  const sourceClientPath = resolve(__dirname, '../src/client/index.tsx');

  if (existsSync(distClientPath)) {
    return distClientPath;
  }

  if (existsSync(sourceClientPath)) {
    return sourceClientPath;
  }

  throw new Error(
    '[appdev-design-mode] Cannot resolve client entry client/index.tsx'
  );
}

