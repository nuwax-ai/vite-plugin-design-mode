import { SourceInfo } from './messages';
/**
 * Whether the element carries the compact JSON `{prefix}-info` attribute.
 */
export declare function hasSourceMapping(element: HTMLElement): boolean;
/**
 * Parse `{prefix}-info` JSON into `SourceInfo`, or null when missing/invalid.
 */
export declare function extractSourceInfo(element: HTMLElement): SourceInfo | null;
//# sourceMappingURL=sourceInfo.d.ts.map