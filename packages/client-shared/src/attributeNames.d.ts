/**
 * Resolved `data-*` names for source mapping (prefix from global config or meta tag).
 */
/** e.g. `data-xagi` */
export declare function getPrefix(): string;
/** Call after changing `window.__APPDEV_DESIGN_MODE_CONFIG__` in tests. */
export declare function resetPrefixCache(): void;
/** `{prefix}-{suffix}` */
export declare function getAttributeName(suffix: string): string;
/** Lazy getters so prefix changes propagate */
export declare const AttributeNames: {
    readonly file: string;
    readonly line: string;
    readonly column: string;
    readonly info: string;
    readonly elementId: string;
    readonly component: string;
    readonly function: string;
    readonly position: string;
    readonly staticContent: string;
    /**
     * Get the children source attribute name (for tracking where static children come from)
     * Example: data-xagi-children-source
     */
    readonly childrenSource: string;
    readonly contextMenu: string;
    readonly contextMenuHover: string;
    readonly import: string;
    /**
     * Get the static-class attribute name (for tracking if className is a pure static string)
     * Example: data-xagi-static-class
     */
    readonly staticClass: string;
};
/** True for any `{prefix}-*` */
export declare function isSourceMappingAttribute(attributeName: string): boolean;
//# sourceMappingURL=attributeNames.d.ts.map