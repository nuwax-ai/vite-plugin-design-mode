#!/usr/bin/env node

/**
 * CLI entry: parse argv and dispatch install / uninstall.
 */

import { main as installMain } from './install.js';
import { main as uninstallMain } from './uninstall.js';

const command = process.argv[2];

switch (command) {
  case 'install':
    installMain();
    break;
  case 'uninstall':
    uninstallMain();
    break;
  case undefined:
  case '--help':
  case '-h':
    console.log(`
@xagi/vite-plugin-design-mode CLI

Usage:
  npx @xagi/vite-plugin-design-mode <command>
  pnpm dlx @xagi/vite-plugin-design-mode <command>

Commands:
  install     Add the plugin to package.json and vite.config
  uninstall   Remove the plugin from package.json and vite.config

Notes:
  - Only edits config files; it does not run your package manager.
  - After install/uninstall, run install/remove yourself to sync node_modules.

Examples:
  pnpm dlx @xagi/vite-plugin-design-mode install
  npx @xagi/vite-plugin-design-mode install

  pnpm dlx @xagi/vite-plugin-design-mode uninstall
  npx @xagi/vite-plugin-design-mode uninstall

More info: https://www.npmjs.com/package/@xagi/vite-plugin-design-mode
`);
    break;
  default:
    console.error(`✗ Unknown command: ${command}`);
    console.error('Run with --help to see available commands.');
    process.exit(1);
}
