# Changelog

All notable changes to `@xagi/vite-plugin-design-mode` are documented in this file.

## [1.1.0-beta.5] - 2026-04-22

### Fixed
- Replaced published package workspace protocol dependencies with explicit semver versions to avoid `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` in external installs.
- Aligned internal package dependency graph for published artifacts:
  - `@xagi/vite-plugin-design-mode -> @xagi/design-mode-client-react/@xagi/design-mode-client-vue/@xagi/design-mode-shared`
  - `@xagi/design-mode-client-react -> @xagi/design-mode-shared`
  - `@xagi/design-mode-client-vue -> @xagi/design-mode-shared`

## [1.1.0-beta.4] - 2026-04-22

### Fixed
- Plugin runtime entry resolution now prefers installed client packages (`@xagi/design-mode-client-react` / `@xagi/design-mode-client-vue`) to avoid publish-time client loading failures.
- Hardened file path validation in update middleware and code updater to prevent path-prefix traversal bypass.
- Updated and stabilized test suites after monorepo migration; full test run passes.

### Changed
- Published `1.1.0-beta.4` to `next` tag for prerelease consumption.

## [1.1.0-beta.3] - 2026-04-22

### Changed
- Migrated repository to pnpm workspace multi-package layout under `packages/*`.
- Removed legacy root `src` implementation and moved active sources to package-local directories.
- Updated examples/tests to consume package-based paths.

### Added
- Kept CLI support in the plugin package and included CLI entry in published artifacts.

## [1.1.0-beta.2] - 2026-04-22

### Added
- Dynamic framework support for both `react-vite` and `vue3-vite` projects.
- Vue 3 peer dependency declaration (`vue: ^3.0.0`, optional peer).
- Release tag strategy documentation (`latest` stable only, `beta/next` for prerelease).

### Changed
- `framework: 'auto'` behavior is documented as React/Vue 3 auto-detection.
- CLI install flow now accepts Vue 3 projects (not only React projects).

### Fixed
- Vue 2 guard: plugin now fails fast when detecting `vue@2` or `@vitejs/plugin-vue2`.
- npm release workflow now defaults to beta publishing via `npm run release`.

## [1.1.0-beta.1] - 2026-04-22

### Added
- Initial beta channel release for the Vue SFC support line.

## [1.0.37] - 2026-04-22

### Changed
- Translated source comments and CLI/user-facing strings to English in core plugin scope.

## [1.0.36] - 2026-04-10

### Added
- Batch update endpoints and optional history/backup controls.
- Validation endpoint and enhanced source metadata return payload.

### Changed
- Default source attribute prefix updated to `data-xagi`.

