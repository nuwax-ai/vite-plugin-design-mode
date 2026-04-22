/**
 * Resolved `data-*` names for source mapping (prefix from global config or meta tag).
 */

const DEFAULT_PREFIX = 'data-xagi';

function getAttributePrefix(): string {
  if (typeof window !== 'undefined') {
    const globalConfig = (window as any).__APPDEV_DESIGN_MODE_CONFIG__;
    if (globalConfig?.attributePrefix) {
      return globalConfig.attributePrefix;
    }

    const metaTag = document.querySelector('meta[name="appdev-design-mode:attribute-prefix"]');
    if (metaTag) {
      const prefix = metaTag.getAttribute('content');
      if (prefix) {
        return prefix;
      }
    }
  }

  return DEFAULT_PREFIX;
}

/** Cached prefix */
let cachedPrefix: string | null = null;

/** e.g. `data-xagi` */
export function getPrefix(): string {
  if (cachedPrefix === null) {
    cachedPrefix = getAttributePrefix();
  }
  return cachedPrefix;
}

/** Call after changing `window.__APPDEV_DESIGN_MODE_CONFIG__` in tests. */
export function resetPrefixCache(): void {
  cachedPrefix = null;
}

/** `{prefix}-{suffix}` */
export function getAttributeName(suffix: string): string {
  const prefix = getPrefix();
  return `${prefix}-${suffix}`;
}

/** Lazy getters so prefix changes propagate */
export const AttributeNames = {
  get file() {
    return getAttributeName('file');
  },
  get line() {
    return getAttributeName('line');
  },
  get column() {
    return getAttributeName('column');
  },
  get info() {
    return getAttributeName('info');
  },
  get elementId() {
    return getAttributeName('element-id');
  },
  get component() {
    return getAttributeName('component');
  },
  get function() {
    return getAttributeName('function');
  },
  get position() {
    return getAttributeName('position');
  },
  get staticContent() {
    return getAttributeName('static-content');
  },
  /**
   * Get the children source attribute name (for tracking where static children come from)
   * Example: data-xagi-children-source
   */
  get childrenSource() {
    return getAttributeName('children-source');
  },
  get contextMenu() {
    return getAttributeName('context-menu');
  },
  get contextMenuHover() {
    return getAttributeName('context-menu-hover');
  },
  get import() {
    return getAttributeName('import');
  },
  /**
   * Get the static-class attribute name (for tracking if className is a pure static string)
   * Example: data-xagi-static-class
   */
  get staticClass() {
    return getAttributeName('static-class');
  },
} as const;

/** True for any `{prefix}-*` */
export function isSourceMappingAttribute(attributeName: string): boolean {
  const prefix = getPrefix();
  return attributeName.startsWith(`${prefix}-`);
}

