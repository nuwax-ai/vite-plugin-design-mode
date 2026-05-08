import { SourceInfo } from './types';
import { AttributeNames } from './attributeNames';
import { extractSourceInfo } from './sourceInfo';

/**
 * BFS for the first descendant whose `{prefix}-info` points at a different file than `currentFile`.
 * Used to detect wrapper components (e.g. `<button>` inside a design-system `Button`).
 *
 * @param element Root to search under
 * @param currentFile File path of the current element’s mapping
 */
function findChildFromDifferentFile(element: HTMLElement, currentFile: string): HTMLElement | null {
    const queue: HTMLElement[] = [];

    for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        if (child instanceof HTMLElement) {
            queue.push(child);
        }
    }

    let depth = 0;
    const maxDepth = 5;

    while (queue.length > 0 && depth < maxDepth) {
        const levelSize = queue.length;

        for (let i = 0; i < levelSize; i++) {
            const child = queue.shift();
            if (!child) continue;

            const childInfo = extractSourceInfo(child);
            if (childInfo && childInfo.fileName !== currentFile) {
                return child;
            }

            for (let j = 0; j < child.children.length; j++) {
                const grandChild = child.children[j];
                if (grandChild instanceof HTMLElement) {
                    queue.push(grandChild);
                }
            }
        }

        depth++;
    }

    return null;
}

/**
 * Resolve the **usage-site** `SourceInfo` for an element.
 *
 * Pass-through/static-content nodes may be compiled inside a UI-kit file; this walks
 * parents / `children-source` / cross-file children so selections map to the caller file.
 */
export function resolveSourceInfo(element: HTMLElement): SourceInfo | null {
    const hasStaticContent = element.hasAttribute(AttributeNames.staticContent);
    const currentInfo = extractSourceInfo(element);
    const currentFile = currentInfo?.fileName;

    if (currentInfo?.isUIComponent) {
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 20) {
            const parentInfo = extractSourceInfo(parent);
            if (parentInfo?.fileName && !parentInfo.isUIComponent) {
                return {
                    fileName: parentInfo.fileName,
                    lineNumber: parentInfo.lineNumber,
                    columnNumber: parentInfo.columnNumber,
                    elementType: element.tagName?.toLowerCase() || 'unknown',
                    componentName: currentInfo?.componentName,
                    functionName: currentInfo?.functionName
                };
            }
            parent = parent.parentElement;
            depth++;
        }
    }

    const candidates = [
        'data-xagi-children-source',
        'data-source-children-source',
        AttributeNames.childrenSource
    ];

    let childrenSource: string | null = null;
    for (const attr of candidates) {
        const val = element.getAttribute(attr);
        if (val) {
            childrenSource = val;
            break;
        }
    }

    if (childrenSource) {
        const parts = childrenSource.split(':');
        if (parts.length >= 3) {
            const fileName = parts.slice(0, -2).join(':'); // Paths may contain `:`
            const lineNumber = parseInt(parts[parts.length - 2], 10);
            const columnNumber = parseInt(parts[parts.length - 1], 10);

            if (!isNaN(lineNumber) && !isNaN(columnNumber)) {
                return {
                    fileName,
                    lineNumber,
                    columnNumber,
                    elementType: element.tagName?.toLowerCase() || 'unknown',
                    componentName: currentInfo?.componentName,
                    functionName: currentInfo?.functionName
                };
            }
        }
    }

    if (currentFile) {
        const childWithDifferentSource = findChildFromDifferentFile(element, currentFile);
        if (childWithDifferentSource) {
            const childInfo = extractSourceInfo(childWithDifferentSource);
            if (childInfo && childInfo.fileName !== currentFile) {
                return {
                    fileName: childInfo.fileName,
                    lineNumber: childInfo.lineNumber,
                    columnNumber: childInfo.columnNumber,
                    elementType: element.tagName?.toLowerCase() || 'unknown',
                    componentName: currentInfo?.componentName,
                    functionName: currentInfo?.functionName
                };
            }
        }
    }

    if (!hasStaticContent) {
        return extractSourceInfo(element);
    }

    // Only walk up for elements inside component definitions (both parent and child
    // have static-content in the same file). Regular nested HTML should use its own sourceInfo.
    if (!isInComponentDefinition(element)) {
        return extractSourceInfo(element);
    }

    let currentElement: HTMLElement | null = element;
    let depth = 0;

    while (currentElement && depth < 20) {
        const parent: HTMLElement | null = currentElement.parentElement;
        if (!parent) {
            break;
        }

        const parentInfo = extractSourceInfo(parent);
        const parentFile = parentInfo?.fileName;
        const parentHasStaticContent = parent.hasAttribute(AttributeNames.staticContent);

        if (parentFile && (!parentHasStaticContent || parentFile !== currentFile)) {
            return parentInfo;
        }

        currentElement = parent;
        depth++;
    }

    return extractSourceInfo(element);
}

/**
 * Heuristic: node lives in a component **definition** (both parent/child static, same file).
 */
export function isInComponentDefinition(element: HTMLElement): boolean {
    const hasStaticContent = element.hasAttribute(AttributeNames.staticContent);
    const sourceInfo = extractSourceInfo(element);
    const sourceFile = sourceInfo?.fileName;

    if (!hasStaticContent || !sourceFile) {
        return false;
    }

    const parent = element.parentElement;
    if (!parent) {
        return false;
    }

    const parentInfo = extractSourceInfo(parent);
    const parentFile = parentInfo?.fileName;
    const parentHasStaticContent = parent.hasAttribute(AttributeNames.staticContent);

    return parentHasStaticContent && parentFile === sourceFile;
}
