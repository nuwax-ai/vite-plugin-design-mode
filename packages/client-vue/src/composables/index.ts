/**
 * Vue3 Composables for Design Mode
 *
 * These composables provide Vue3 equivalents to the React hooks
 * for managing design mode functionality.
 */

export { createDesignMode, useDesignMode } from './useDesignMode';
export type { DesignModeConfig, Modification } from './useDesignMode';

export { useSelectionManager } from './useSelectionManager';
export type { SelectionManagerConfig } from './useSelectionManager';

export { useEditManager } from './useEditManager';

export { useObserverManager } from './useObserverManager';
