import { SourceInfo } from '../../types/messages';
import { AttributeNames } from './attributeNames';

/**
 * Whether the element carries the compact JSON `{prefix}-info` attribute.
 */
export function hasSourceMapping(element: HTMLElement): boolean {
  return element.hasAttribute(AttributeNames.info);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeSourceInfo(raw: Record<string, unknown>): SourceInfo | null {
  const fileName = typeof raw.fileName === 'string' ? raw.fileName : null;
  const lineNumber = toNumber(raw.lineNumber ?? raw.line);
  const columnNumber = toNumber(raw.columnNumber ?? raw.column);

  if (!fileName || lineNumber === null || columnNumber === null) {
    return null;
  }

  return {
    fileName,
    lineNumber,
    columnNumber,
    elementType: typeof raw.elementType === 'string' ? raw.elementType : undefined,
    componentName: typeof raw.componentName === 'string' ? raw.componentName : undefined,
    functionName: typeof raw.functionName === 'string' ? raw.functionName : undefined,
    elementId: typeof raw.elementId === 'string' ? raw.elementId : undefined,
    importPath: typeof raw.importPath === 'string' ? raw.importPath : undefined,
    isUIComponent: typeof raw.isUIComponent === 'boolean' ? raw.isUIComponent : undefined,
  };
}

/**
 * Parse `{prefix}-info` JSON into `SourceInfo`, or null when missing/invalid.
 */
export function extractSourceInfo(element: HTMLElement): SourceInfo | null {
  const sourceInfoStr = element.getAttribute(AttributeNames.info);
  if (sourceInfoStr) {
    try {
      const parsed = JSON.parse(sourceInfoStr) as Record<string, unknown>;
      const normalized = normalizeSourceInfo(parsed);
      if (normalized) {
        return normalized;
      }
    } catch (e) {
      console.warn(`[sourceInfo] Failed to parse ${AttributeNames.info}:`, e);
    }
  }

  // Legacy per-field attrs.
  const fileName = element.getAttribute(AttributeNames.file);
  const line = toNumber(element.getAttribute(AttributeNames.line));
  const column = toNumber(element.getAttribute(AttributeNames.column));

  if (fileName && line !== null && column !== null) {
    return {
      fileName,
      lineNumber: line,
      columnNumber: column,
    };
  }

  return null;
}
