import { SourceInfo } from './types';
/**
 * Resolve the **usage-site** `SourceInfo` for an element.
 *
 * Pass-through/static-content nodes may be compiled inside a UI-kit file; this walks
 * parents / `children-source` / cross-file children so selections map to the caller file.
 */
export declare function resolveSourceInfo(element: HTMLElement): SourceInfo | null;
/**
 * Heuristic: node lives in a component **definition** (both parent/child static, same file).
 */
export declare function isInComponentDefinition(element: HTMLElement): boolean;
//# sourceMappingURL=sourceInfoResolver.d.ts.map