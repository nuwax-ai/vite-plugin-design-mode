import React, { useRef, useState } from 'react';
import { useDesignMode } from './DesignModeContext';
import { SourceInfo, AddToChatMessage, CopyElementMessage } from '../types/messages';
import { extractSourceInfo, hasSourceMapping } from './utils/sourceInfo';
import { isPureStaticText } from './utils/elementUtils';
import { AttributeNames } from './utils/attributeNames';
import { showContextMenu, MenuItem } from './ui/ContextMenu';
import { UpdateOperation, UpdateState, UpdateResult, BatchUpdateItem, UpdateManagerConfig } from './types/UpdateTypes';
import { HistoryManager } from './managers/HistoryManager';
import { ObserverManager } from './managers/ObserverManager';
import { EditManager } from './managers/EditManager';
import { UpdateService } from './services/UpdateService';
import { bridge } from './bridge';
import { Toast } from './ui/Toast';





/**
 * Coordinates direct edit, context menu, batching, and persistence hooks.
 */
export class UpdateManager {
  private updateQueue: UpdateState[] = [];
  private historyManager: HistoryManager;
  private observerManager: ObserverManager;
  private editManager: EditManager;
  private updateService: UpdateService;
  private callbacks: Map<UpdateOperation, Set<(update: UpdateState) => void>> =
    new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  // Design mode state
  private isDesignMode: boolean = false;
  private selectedElement: HTMLElement | null = null;
  private selectElementCallback: ((element: HTMLElement | null) => void) | null = null;

  constructor(
    private config: UpdateManagerConfig = {
      enableDirectEdit: true,
      enableBatching: true,
      batchDebounceMs: 300,
      maxRetries: 3,
      autoSave: true,
      saveDelay: 1000,
      validation: {
        validateSource: true,
        validateValue: true,
        maxLength: 10000,
      },
    }
  ) {
    this.historyManager = new HistoryManager();
    this.observerManager = new ObserverManager(
      (target, type) => this.editManager.handleDirectEdit(target, type),
      (node) => this.setupElementEditHandlers(node)
    );
    this.editManager = new EditManager(
      (update) => this.updateService.processUpdate(update),
      this.config
    );
    this.updateService = new UpdateService(
      this.config,
      (update) => {
        this.historyManager.add(update);
        this.notifyCallbacks(update.operation, update);
        if (this.config.autoSave) {
          this.triggerAutoSave();
        }
      },
      (update) => {
        // onFail callback
        if (update.error) {
          Toast.error(`Update failed: ${update.error}`);
        }
      }
    );

    if (this.config.enableDirectEdit) {
      this.observerManager.enable();
    }

    this.initializeEventListeners();
  }

  /**
   * (Observer wired in ObserverManager)
   */


  /**
   * register dblclick / contextmenu
   */
  private initializeEventListeners() {
    if (!this.config.enableDirectEdit) return;

    // Double-click → edit
    document.addEventListener('dblclick', this.handleDblClick.bind(this));

    // Context menu
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));

    // Shortcuts (optional)
    // document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }



  /**
   * Double-click: only when design mode on
   */
  private handleDblClick(event: MouseEvent) {
    // Require design mode
    if (!this.isDesignMode) return;

    const target = event.target as HTMLElement;

    // Need source mapping
    if (!hasSourceMapping(target)) return;

    // Skip plugin UI
    if (target.closest('#__vite_plugin_design_mode__')) return;

    // Skip context menu DOM
    if (target.closest(`[${AttributeNames.contextMenu}="true"]`)) return;

    // static-content="true" only
    // Respects configurable attribute prefix
    const staticContentAttr = target.getAttribute(AttributeNames.staticContent);
    if (staticContentAttr !== 'true') {
      // Not editable without static text marker
      return;
    }

    // preventDefault for dblclick
    event.preventDefault();
    event.stopPropagation();

    // Check if it's pure static text - REMOVED to let EditManager handle validation
    // if (!isPureStaticText(target)) {
    //   console.log('[UpdateManager] Ignored dblclick on non-static text element');
    //   return;
    // }

    // Delegate to EditManager
    this.editManager.handleDirectEdit(target, 'content');
  }

  /**
   * Context menu: add to chat / copy
   */
  private handleContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Only show context menu if design mode is enabled
    if (!this.isDesignMode) return;

    // Exclude context menu
    if (target.closest(`[${AttributeNames.contextMenu}="true"]`)) return;

    // Must be mapped
    if (!hasSourceMapping(target)) return;

    // isSelected flag
    const isSelected = !!(this.selectedElement && target === this.selectedElement);

    // Preserve hover while menu opens
    const hadHoverState = target.hasAttribute('data-design-hover');
    if (hadHoverState) {
      // context-menu-hover marker
      target.setAttribute(AttributeNames.contextMenuHover, 'true');
      if (target.hasAttribute(AttributeNames.staticClass) || target.hasAttribute(AttributeNames.staticContent)) {
        // keep data-design-hover
        target.setAttribute('data-design-hover', 'true');

      }
    }

    event.preventDefault();

    // Custom menu for mapped nodes
    this.showContextMenu(target, event.clientX, event.clientY, isSelected);
  }

  /**
   * Update design mode state
   */
  public setDesignModeState(
    isDesignMode: boolean,
    selectedElement: HTMLElement | null = null,
    selectElementCallback?: (element: HTMLElement | null) => void
  ) {
    this.isDesignMode = isDesignMode;
    this.selectedElement = selectedElement;
    if (selectElementCallback) {
      this.selectElementCallback = selectElementCallback;
    }
  }

  /**
   * Whether design mode is active
   */
  public getDesignModeState(): boolean {
    return this.isDesignMode;
  }


  /**
   * Keyboard shortcuts (currently unused hook)
   */
  private handleKeyDown(event: KeyboardEvent) {
    // F2 → edit
    if (event.key === 'F2') {
      const selectedElement = document.activeElement as HTMLElement;
      if (selectedElement && hasSourceMapping(selectedElement)) {
        event.preventDefault();
        this.editManager.handleDirectEdit(selectedElement, 'content');
        // if (isPureStaticText(selectedElement)) {
        //   this.editManager.handleDirectEdit(selectedElement, 'content');
        // } else {
        //   console.log('[UpdateManager] Cannot edit non-static text element');
        // }
      }
    }

    // Save all
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.saveAllChanges();
    }

    // Undo
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === 'z' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      this.undoLastUpdate();
    }

    // Redo
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 'y' || (event.key === 'z' && event.shiftKey))
    ) {
      event.preventDefault();
      this.redoLastUpdate();
    }
  }

  /**
   * Observer callback: mark editable nodes
   */
  private setupElementEditHandlers(element: HTMLElement) {
    if (!hasSourceMapping(element)) return;

    // data-edit-enabled
    element.setAttribute('data-edit-enabled', 'true');

    // dashed outline on hover
    element.addEventListener('mouseenter', () => {
      if (this.config.enableDirectEdit && this.isDesignMode) {
        element.style.outline = '1px dashed #007acc';
      }
    });

    element.addEventListener('mouseleave', () => {
      if (!element.hasAttribute('data-selected')) {
        element.style.outline = '';
      }
    });
  }



  /**
   * Internal direct-edit path
   */
  private handleDirectEdit(
    element: HTMLElement,
    type: 'style' | 'content' | 'attribute'
  ) {
    if (!this.config.enableDirectEdit) return;

    const sourceInfo = extractSourceInfo(element);
    if (!sourceInfo) return;

    switch (type) {
      case 'content':
        this.updateContent(element, element.innerText, sourceInfo);
        break;
      case 'style':
        this.updateStyle(element, element.className, sourceInfo);
        break;
    }
  }

  /**
   * enterEditMode
   */
  public enterEditMode(
    element: HTMLElement,
    type: 'style' | 'content' | 'attribute'
  ) {
    const sourceInfo = extractSourceInfo(element);
    if (!sourceInfo) {
      console.warn('[UpdateManager] Element has no source mapping');
      return;
    }

    switch (type) {
      case 'content':
        this.editManager.handleDirectEdit(element, 'content');
        break;
      case 'style':
        this.editManager.editStyle(element);
        break;
      case 'attribute':
        this.editManager.editAttributes(element);
        break;
    }
  }



  /**
   * (reserved)
   */


  /**
   * showContextMenu
   */
  private showContextMenu(element: HTMLElement, x: number, y: number, isSelected: boolean) {
    const menuItems: MenuItem[] = [];

    // Built-in actions
    menuItems.push(
      {
        label: 'Add to chat',
        action: () => this.addToChat(element),
      },
      {
        label: 'Copy element',
        action: () => this.copyElement(element)
      }
    );

    showContextMenu(element, x, y, menuItems);
  }

  /**
   * (handled in ContextMenu)
   */


  /**
   * copyElement
   */
  private copyElement(element: HTMLElement) {
    const sourceInfo = extractSourceInfo(element);
    const content = element.innerText || element.textContent || '';

    // Copy element to clipboard (if possible)
    const elementInfo = {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      content: content,
      sourceInfo: sourceInfo ?? undefined
    };

    const textToCopy = JSON.stringify(elementInfo, null, 2);

    // sendCopyMessage helper
    const sendCopyMessage = (success: boolean, error?: string) => {
      const message: CopyElementMessage = {
        type: 'COPY_ELEMENT',
        payload: {
          elementInfo: {
            tagName: elementInfo.tagName,
            className: elementInfo.className,
            content: elementInfo.content,
            sourceInfo: elementInfo.sourceInfo
          },
          textContent: textToCopy,
          success,
          error
        },
        timestamp: Date.now()
      };

      // iframe: bridge; top: postMessage
      if (typeof window !== 'undefined' && window.self !== window.top) {

        bridge.send(message).catch(error => {
          console.error('[UpdateManager] Failed to send COPY_ELEMENT via bridge:', error);
          // fallback postMessage
          window.parent.postMessage(message, '*');
        });
      } else {

        window.postMessage(message, '*');
      }
    };

    // Clipboard API when available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        let alertMessage = 'Copied element info to clipboard:\n\n';
        if (sourceInfo) {
          alertMessage += `File: ${sourceInfo.fileName}\n`;
          alertMessage += `Line: L${sourceInfo.lineNumber}\n`;
          alertMessage += `\n`;
        }
        alertMessage += `Tag: <${elementInfo.tagName}>\n`;
        alertMessage += `className: ${elementInfo.className}\n`;
        alertMessage += `Text: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`;


        sendCopyMessage(true);
      }).catch(err => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[UpdateManager] Failed to copy to clipboard:', err);


        sendCopyMessage(false, errorMessage);
      });
    } else {

      sendCopyMessage(false, 'Clipboard API not available');
    }
  }

  /**
   * Add element content to chat
   */
  private addToChat(element: HTMLElement) {
    const sourceInfo = extractSourceInfo(element);
    const content = element.innerText || element.textContent || '';

    // console.log('[UpdateManager] Adding to chat:', { content, sourceInfo });



    const contextSourceInfo = sourceInfo ?? undefined;


    const elementInfo = sourceInfo ? {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      textContent: content,
      sourceInfo,
      isStaticText: isPureStaticText(element)
    } : undefined;

    const message: AddToChatMessage = {
      type: 'ADD_TO_CHAT',
      payload: {
        content,
        context: {
          sourceInfo: contextSourceInfo,
          elementInfo
        }
      },
      timestamp: Date.now()
    };

    // iframe vs top-level postMessage
    if (typeof window !== 'undefined' && window.self !== window.top) {

      bridge.send(message).catch(error => {
        console.error('[UpdateManager] Failed to send ADD_TO_CHAT via bridge:', error);

        window.parent.postMessage(message, '*');
      });
    } else {

      window.postMessage(message, '*');
    }

    // Format alert message with source info
    let alertMessage = 'Added to chat:\n\n';
    if (sourceInfo) {
      alertMessage += `File: ${sourceInfo.fileName}\n`;
      alertMessage += `Line: L${sourceInfo.lineNumber}\n`;
      alertMessage += `\n`;
    }
    alertMessage += `Text:\n${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`;
  }

  /**
   * deleteElement (stub)
   */
  private deleteElement(element: HTMLElement) {
    // Destructive edit not implemented
  }

  /**
   * updateStyle
   */
  public updateStyle(
    element: HTMLElement,
    newClass: string,
    sourceInfo: SourceInfo
  ): Promise<UpdateResult> {
    return this.editManager.updateStyle(element, newClass, sourceInfo);
  }

  /**
   * updateContent
   */
  public updateContent(
    element: HTMLElement,
    newContent: string,
    sourceInfo?: SourceInfo,
    oldValue?: string
  ): Promise<UpdateResult> {
    return this.editManager.updateContent(element, newContent, sourceInfo, oldValue);
  }

  /**
   * updateAttribute
   */
  public updateAttribute(
    element: HTMLElement,
    attributeName: string,
    newValue: string,
    sourceInfo: SourceInfo
  ): Promise<UpdateResult> {
    return this.editManager.updateAttribute(element, attributeName, newValue, sourceInfo);
  }

  /**
   * batchUpdate
   */
  public batchUpdate(updates: BatchUpdateItem[]): Promise<UpdateResult[]> {
    if (!this.config.enableBatching) {
      // Sequential when batching off
      return Promise.all(
        updates.map(item => {
          if (item.type === 'style') {
            return this.updateStyle(
              item.element,
              item.newValue,
              item.sourceInfo
            );
          } else if (item.type === 'content') {
            return this.updateContent(
              item.element,
              item.newValue,
              item.sourceInfo
            );
          } else {
            return this.updateAttribute(
              item.element,
              'data-test',
              item.newValue,
              item.sourceInfo
            );
          }
        })
      );
    }

    // Debounced batch
    return new Promise(resolve => {

      const updateStates: UpdateState[] = updates.map(item => ({
        id: this.generateUpdateId(),
        operation: item.type === 'style' ? 'style_update' : 'content_update',
        sourceInfo: item.sourceInfo,
        element: item.element,
        oldValue: item.originalValue || '',
        newValue: item.newValue,
        status: 'pending' as const,
        timestamp: Date.now(),
        retryCount: 0,
      }));


      this.updateQueue.push(...updateStates);


      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = setTimeout(async () => {
        const results = await this.processBatchUpdate(updateStates);
        resolve(results);
      }, this.config.batchDebounceMs);
    });
  }

  /**
   * processUpdate
   */
  private async processUpdate(update: UpdateState): Promise<UpdateResult> {
    return this.updateService.processUpdate(update);
  }

  /**
   * processBatchUpdate
   */
  private async processBatchUpdate(
    updates: UpdateState[]
  ): Promise<UpdateResult[]> {
    return this.updateService.processBatchUpdate(updates);
  }

  /**
   * (extract in service)
   */


  /**
   * generateUpdateId
   */
  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * triggerAutoSave
   */
  private triggerAutoSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveAllChanges();
    }, this.config.saveDelay);
  }

  /**
   * saveAllChanges
   */
  public async saveAllChanges(): Promise<void> {
    const pendingUpdates = this.updateQueue.filter(u => u.status === 'pending');
    if (pendingUpdates.length === 0) return;

    try {
      const results = await this.processBatchUpdate(pendingUpdates);
    } catch (error) {
      console.error('[UpdateManager] Failed to save changes:', error);
    }
  }

  /**
   * undoLastUpdate
   */
  public undoLastUpdate(): boolean {
    const lastUpdate = this.historyManager.undo();
    if (!lastUpdate) return false;

    // Restore DOM from history
    lastUpdate.element.innerText = lastUpdate.oldValue;
    lastUpdate.element.className = lastUpdate.oldValue;

    return true;
  }

  /**
   * redoLastUpdate
   */
  public redoLastUpdate(): boolean {
    const lastReverted = this.historyManager.redo();
    if (!lastReverted) return false;

    // Re-apply from history
    lastReverted.element.innerText = lastReverted.newValue;
    lastReverted.element.className = lastReverted.newValue;

    return true;
  }

  /**
   * addUpdateCallback
   */
  public addUpdateCallback(
    operation: UpdateOperation,
    callback: (update: UpdateState) => void
  ) {
    if (!this.callbacks.has(operation)) {
      this.callbacks.set(operation, new Set());
    }
    this.callbacks.get(operation)!.add(callback);


    return () => {
      this.callbacks.get(operation)?.delete(callback);
    };
  }

  /**
   * notifyCallbacks
   */
  private notifyCallbacks(operation: UpdateOperation, update: UpdateState) {
    const callbacks = this.callbacks.get(operation);
    if (callbacks) {
      callbacks.forEach(callback => callback(update));
    }
  }

  /**
   * getUpdateStates
   */
  public getUpdateStates(): UpdateState[] {
    return [...this.updateQueue];
  }

  /**
   * getUpdateHistory
   */
  public getUpdateHistory(): UpdateState[] {
    return this.historyManager.getHistory();
  }

  /**
   * destroy
   */
  public destroy() {

    this.observerManager.disable();


    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }


    this.updateQueue = [];
    this.historyManager.clear();
    this.callbacks.clear();
  }
}

/**
 * UpdateManager React Hook
 */
export const useUpdateManager = (config?: Partial<UpdateManagerConfig>) => {
  const updateManagerRef = useRef<UpdateManager | null>(null);
  const [updateStates, setUpdateStates] = useState<UpdateState[]>([]);
  const { config: designModeConfig, isDesignMode, selectedElement } = useDesignMode();

  React.useEffect(() => {
    // Direct edit can run outside strict design mode when enabled
    updateManagerRef.current = new UpdateManager({
      enableDirectEdit: designModeConfig.iframeMode?.enableDirectEdit ?? true,
      enableBatching: designModeConfig.batchUpdate?.enabled ?? true,
      batchDebounceMs: designModeConfig.batchUpdate?.debounceMs ?? 300,
      maxRetries: 3,
      autoSave: true,
      saveDelay: 1000,
      validation: {
        validateSource: true,
        validateValue: true,
        maxLength: 10000,
      },
      ...config,
    });

    // Track content_update events
    const unsubscribe = updateManagerRef.current.addUpdateCallback(
      'content_update',
      update => {
        setUpdateStates(prev => [...prev, update]);
      }
    );

    return () => {
      unsubscribe();
      updateManagerRef.current?.destroy();
      updateManagerRef.current = null;
    };
  }, [designModeConfig]);

  // Sync design mode state and selected element with UpdateManager
  const { selectElement } = useDesignMode();
  React.useEffect(() => {
    if (updateManagerRef.current) {
      updateManagerRef.current.setDesignModeState(isDesignMode, selectedElement, selectElement);
    }
  }, [isDesignMode, selectedElement, selectElement]);


  return {
    updateManager: updateManagerRef.current,
    updateStates,
    updateStyle: (
      element: HTMLElement,
      newClass: string,
      sourceInfo: SourceInfo
    ) => updateManagerRef.current?.updateStyle(element, newClass, sourceInfo),
    updateContent: (
      element: HTMLElement,
      newContent: string,
      sourceInfo: SourceInfo
    ) =>
      updateManagerRef.current?.updateContent(element, newContent, sourceInfo),
    batchUpdate: (updates: BatchUpdateItem[]) =>
      updateManagerRef.current?.batchUpdate(updates),
    saveAllChanges: () => updateManagerRef.current?.saveAllChanges(),
    undoLastUpdate: () => updateManagerRef.current?.undoLastUpdate(),
    redoLastUpdate: () => updateManagerRef.current?.redoLastUpdate(),
  };
};

export default UpdateManager;
