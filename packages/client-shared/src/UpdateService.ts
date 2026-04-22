import { UpdateState, UpdateResult, UpdateManagerConfig } from './types';

/**
 * UpdateService
 * Handles update processing, validation, and server synchronization
 */
export class UpdateService {
  private processingUpdates = new Set<string>();

  constructor(
    private config: UpdateManagerConfig,
    private onComplete: (update: UpdateState) => void,
    private onFail: (update: UpdateState) => void
  ) { }

  /**
   * Process a single update
   */
  public async processUpdate(update: UpdateState): Promise<UpdateResult> {
    // Validate update
    if (!this.validateUpdate(update)) {
      return {
        success: false,
        element: update.element,
        updateId: update.id,
        error: 'Update validation failed',
      };
    }

    // Mark as processing
    update.status = 'processing';
    this.processingUpdates.add(update.id);

    try {
      // Apply DOM update
      this.applyUpdateToDOM(update);

      let serverResponse;
      // Save to source via API (only if persist is true)
      if (update.persist) {
        serverResponse = await this.saveToSource(update);
      } else {
        serverResponse = { success: true, preview: true };
      }

      // Mark as completed
      update.status = 'completed';
      this.onComplete(update);

      return {
        success: true,
        element: update.element,
        updateId: update.id,
        serverResponse,
      };
    } catch (error) {
      update.status = 'failed';
      update.error = error instanceof Error ? error.message : 'Unknown error';

      // Retry mechanism
      if (update.retryCount < this.config.maxRetries) {
        update.retryCount++;
        return this.processUpdate(update);
      }

      this.onFail(update);

      return {
        success: false,
        element: update.element,
        updateId: update.id,
        error: update.error,
      };
    } finally {
      this.processingUpdates.delete(update.id);
    }
  }

  /**
   * Process batch update
   */
  public async processBatchUpdate(
    updates: UpdateState[]
  ): Promise<UpdateResult[]> {
    try {
      // Build batch API request
      const batchRequest = {
        updates: updates.map(update => ({
          filePath: update.sourceInfo.fileName,
          line: update.sourceInfo.lineNumber,
          column: update.sourceInfo.columnNumber,
          type: (update.operation === 'style_update' || update.operation === 'class_update') ? 'style' : 'content',
          newValue: update.newValue,
          originalValue: update.oldValue,
        })),
      };

      // Call batch API
      const response = await fetch('/__appdev_design_mode/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchRequest),
      });

      if (!response.ok) {
        throw new Error(`Batch update failed: ${response.statusText}`);
      }

      const results = await response.json();

      // Mark all updates as completed
      updates.forEach(update => {
        update.status = 'completed';
        this.onComplete(update);
      });

      return results.map((result: any, index: number) => ({
        success: result.success,
        element: updates[index].element,
        updateId: updates[index].id,
        serverResponse: result,
      }));
    } catch (error) {
      // Mark all updates as failed
      updates.forEach(update => {
        update.status = 'failed';
        update.error = error instanceof Error ? error.message : 'Unknown error';
        this.onFail(update);
      });

      return updates.map(update => ({
        success: false,
        element: update.element,
        updateId: update.id,
        error: update.error,
      }));
    }
  }

  /**
   * Apply update to DOM
   */
  private applyUpdateToDOM(update: UpdateState) {
    const { element, operation, newValue } = update;

    switch (operation) {
      case 'style_update':
      case 'class_update':
        element.className = newValue;
        break;
      case 'content_update':
        element.innerText = newValue;
        break;
      case 'attribute_update':
        // This should get attribute name from sourceInfo
        // Currently simplified to set data-attribute
        element.setAttribute('data-updated-value', newValue);
        break;
    }
  }

  /**
   * Save to source file via API
   */
  private async saveToSource(update: UpdateState): Promise<any> {
    const response = await fetch('/__appdev_design_mode/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: update.sourceInfo.fileName,
        line: update.sourceInfo.lineNumber,
        column: update.sourceInfo.columnNumber,
        newValue: update.newValue,
        originalValue: update.oldValue,
        type: (update.operation === 'style_update' || update.operation === 'class_update') ? 'style' : 'content',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save source: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Validate update before processing
   */
  private validateUpdate(update: UpdateState): boolean {
    // Validate source mapping
    if (this.config.validation.validateSource) {
      if (
        !update.sourceInfo.fileName ||
        update.sourceInfo.lineNumber === null ||
        update.sourceInfo.columnNumber === null
      ) {
        return false;
      }
    }

    // Validate value
    if (this.config.validation.validateValue) {
      if (update.newValue.length > this.config.validation.maxLength) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if update is processing
   */
  public isProcessing(updateId: string): boolean {
    return this.processingUpdates.has(updateId);
  }
}
