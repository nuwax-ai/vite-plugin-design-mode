import { UpdateState } from './types';

/**
 * History Manager
 * Manages the history of updates for undo/redo functionality
 */
export class HistoryManager {
  private history: UpdateState[] = [];

  /**
   * Add an update to history
   */
  public add(update: UpdateState) {
    this.history.push(update);
  }

  /**
   * Get all history
   */
  public getHistory(): UpdateState[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  public clear() {
    this.history = [];
  }

  /**
   * Undo the last update
   * Moves the update from history to redo stack
   */
  public undo(): UpdateState | null {
    const update = this.history.pop();
    if (update) {
      update.status = 'reverted';
      this.redoStack.push(update);
    }
    return update || null;
  }

  /**
   * Get the last reverted update for redo
   * Note: Since we are changing how undo works (popping), we need to handle redo differently.
   * If we want to support redo, we should store the undone updates.
   */
  private redoStack: UpdateState[] = [];

  /**
   * Redo the last undone update
   * Moves the update from redo stack to history
   */
  public redo(): UpdateState | null {
    const update = this.redoStack.pop();
    if (update) {
      update.status = 'completed';
      this.history.push(update);
    }
    return update || null;
  }

  // To maintain backward compatibility with the "broken" logic (if it was indeed broken),
  // or to fix it. The user asked to refactor, which implies improving maintainability.
  // Fixing a bug is also good.
  // However, I should be careful not to change behavior if the user relies on it (even if buggy).
  // But "redo not working" is hardly a feature.

  // I'll implement `undo` to return the update, and let the caller handle the DOM restoration.
  // The manager just manages the state.
}
