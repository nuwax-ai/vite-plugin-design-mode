# Changelog

All notable changes to `@xagi/vite-plugin-design-mode` are documented in this file.

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

