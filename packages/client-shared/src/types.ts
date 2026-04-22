// Import shared types from messages
import type { SourceInfo, ElementInfo } from './messages';

// Re-export for convenience
export type { SourceInfo, ElementInfo };

/** High-level update kind tracked by `UpdateManager`. */
export type UpdateOperation =
  | 'style_update'
  | 'content_update'
  | 'attribute_update'
  | 'class_update'
  | 'batch_update';

/** One in-flight or historical mutation. */
export interface UpdateState {
  id: string;
  operation: UpdateOperation;
  sourceInfo: SourceInfo;
  element: HTMLElement;
  oldValue: string;
  newValue: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reverted';
  timestamp: number;
  error?: string;
  retryCount: number;
  persist?: boolean;
}

/** Result of persisting / previewing an update. */
export interface UpdateResult {
  success: boolean;
  element: HTMLElement;
  updateId: string;
  error?: string;
  serverResponse?: any;
}

/** One row in a batch POST body for UpdateManager. */
export interface UpdateManagerBatchItem {
  element: HTMLElement;
  type: 'style' | 'content' | 'attribute';
  sourceInfo: SourceInfo;
  newValue: string;
  originalValue?: string;
  selector?: string;
}

/** `UpdateManager` runtime options. */
export interface UpdateManagerConfig {
  enableDirectEdit: boolean;
  enableBatching: boolean;
  batchDebounceMs: number;
  maxRetries: number;
  autoSave: boolean;
  saveDelay: number;
  validation: {
    validateSource: boolean;
    validateValue: boolean;
    maxLength: number;
  };
}
