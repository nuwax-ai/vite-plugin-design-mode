import * as babel from '@babel/standalone';
import { createSourceMappingPlugin } from './sourceMapper';
import type { DesignModeOptions } from '../types';

export function transformSourceCode(
  code: string,
  id: string,
  options: Required<DesignModeOptions>
): string {
  try {
    // Handle ESM/CJS interop
    const babelApi = (babel as any).default || babel;



    // Parse source into AST (via Babel transform)
    // Use a single transform call to ensure our plugin runs before presets compile JSX
    const result = babelApi.transform(code, {
      ast: false, // We don't need the AST output
      code: true,
      sourceType: 'module',
      filename: id,
      presets: [
        'typescript',
        ['react', {
          runtime: 'automatic', // Use automatic JSX runtime (React 17+)
          development: false,   // Use production runtime for better performance
        }]
      ],
      plugins: [
        createSourceMappingPlugin(id, options)
      ],
      parserOpts: {
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        createParenthesizedExpressions: true
      }
    });

    return (result && result.code) || code;
  } catch (error) {
    if (options.verbose) {
      console.warn(`[appdev-design-mode] AST transformation failed for ${id}:`, error);
    }
    return code;
  }
}
