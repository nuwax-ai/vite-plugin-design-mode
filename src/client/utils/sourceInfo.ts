import { SourceInfo } from '../../types/messages';
import { AttributeNames } from './attributeNames';

/**
 * Whether the element carries the compact JSON `{prefix}-info` attribute.
 */
export function hasSourceMapping(element: HTMLElement): boolean {
  return element.hasAttribute(AttributeNames.info);
}

/**
 * Parse `{prefix}-info` JSON into `SourceInfo`, or null when missing/invalid.
 */
export function extractSourceInfo(element: HTMLElement): SourceInfo | null {
  const sourceInfoStr = element.getAttribute(AttributeNames.info);
  if (sourceInfoStr) {
    try {
      return JSON.parse(sourceInfoStr) as SourceInfo;
    } catch (e) {
      console.warn(`[sourceInfo] Failed to parse ${AttributeNames.info}:`, e);
    }
  }

  return null;
}
