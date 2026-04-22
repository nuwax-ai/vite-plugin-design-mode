import { ref, reactive, computed, provide, inject, onMounted, onBeforeUnmount } from 'vue';
import { twMerge } from 'tailwind-merge';
import type {
  DesignModeMessage,
  ParentToIframeMessage,
  IframeToParentMessage,
  BridgeConfig,
  ElementInfo,
  SourceInfo,
  ToggleDesignModeMessage,
  UpdateStyleMessage,
  UpdateContentMessage,
  BatchUpdateMessage,
  HeartbeatMessage,
  HealthCheckMessage,
  HealthCheckResponseMessage,
} from '@xagi/design-mode-shared/messages';
import { bridge, messageValidator } from '@xagi/design-mode-shared/bridge';
import { AttributeNames } from '@xagi/design-mode-shared/attributeNames';
import { isPureStaticText } from '@xagi/design-mode-shared/elementUtils';
import { extractSourceInfo as extractSourceInfoFromAttributes } from '@xagi/design-mode-shared/sourceInfo';
import { resolveSourceInfo } from '@xagi/design-mode-shared/sourceInfoResolver';

export interface Modification {
  id: string;
  element: string;
  type: 'class' | 'style';
  oldValue: string;
  newValue: string;
  timestamp: number;
}

export interface DesignModeConfig {
  enabled?: boolean;
  iframeMode?: {
    enabled: boolean;
    hideUI: boolean;
    enableSelection: boolean;
    enableDirectEdit: boolean;
  };
  batchUpdate?: {
    enabled: boolean;
    debounceMs: number;
  };
  bridge?: Partial<BridgeConfig>;
}

interface DesignModeState {
  isDesignMode: boolean;
  selectedElement: HTMLElement | null;
  modifications: Modification[];
  isConnected: boolean;
  bridgeStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  config: DesignModeConfig;
}

const DESIGN_MODE_KEY = Symbol('design-mode');

/**
 * Vue3 composable for design mode management
 * Provides global state and actions for design mode functionality
 */
export function createDesignMode(userConfig: DesignModeConfig = {}) {
  // Defaults
  const defaultConfig: DesignModeConfig = {
    enabled: true,
    iframeMode: {
      enabled: true,
      hideUI: false,
      enableSelection: true,
      enableDirectEdit: true,
    },
    batchUpdate: {
      enabled: true,
      debounceMs: 300,
    },
    bridge: {
      timeout: 10000,
      retryAttempts: 3,
      heartbeatInterval: 30000,
      debug: process.env.NODE_ENV === 'development',
    },
    ...userConfig,
  };

  // State
  const state = reactive<DesignModeState>({
    isDesignMode: false,
    selectedElement: null,
    modifications: [],
    isConnected: false,
    bridgeStatus: 'connecting',
    config: defaultConfig,
  });

  // Batch debounce state
  const batchUpdateTimer = ref<NodeJS.Timeout | null>(null);
  const pendingBatchUpdates = ref<
    Array<{
      element: HTMLElement;
      type: 'style' | 'content';
      newValue: string;
      originalValue?: string;
    }>
  >([]);

  // Unsubscribe handlers
  const unsubscribeHandlers = ref<(() => void)[]>([]);

  /**
   * postMessage when iframe + connected
   */
  const sendToParent = (message: IframeToParentMessage) => {
    if (!state.config.iframeMode?.enabled) {
      return;
    }

    // Use bridge if connected, fallback to direct postMessage
    if (bridge.isConnected()) {
      bridge.send(message).catch(error => {
        console.warn(
          '[DesignMode] Bridge send failed, fallback to window.parent.postMessage',
          error
        );
        if (window.self !== window.top) {
          window.parent.postMessage(message, '*');
        }
      });
      return;
    }

    if (window.self !== window.top) {
      window.parent.postMessage(message, '*');
    }
  };

  /**
   * findElementBySourceInfo
   */
  const findElementBySourceInfo = (sourceInfo: SourceInfo): HTMLElement | null => {
    // 1) element-id
    if (sourceInfo.elementId) {
      const element = document.querySelector(`[${AttributeNames.elementId}="${sourceInfo.elementId}"]`);
      if (element) return element as HTMLElement;
    }

    // 2) legacy file/line/column attrs
    const selector = `[${AttributeNames.file}="${sourceInfo.fileName}"][${AttributeNames.line}="${sourceInfo.lineNumber}"][${AttributeNames.column}="${sourceInfo.columnNumber}"]`;
    const element = document.querySelector(selector);
    if (element) return element as HTMLElement;

    // 3) children-source
    const childrenSourceValue = `${sourceInfo.fileName}:${sourceInfo.lineNumber}:${sourceInfo.columnNumber}`;
    const elementByChildrenSource = document.querySelector(`[${AttributeNames.childrenSource}="${childrenSourceValue}"]`);
    if (elementByChildrenSource) return elementByChildrenSource as HTMLElement;

    // 4) scan all -info
    const allElements = document.querySelectorAll(`[${AttributeNames.info}]`);
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as HTMLElement;
      try {
        const infoStr = el.getAttribute(AttributeNames.info);
        if (infoStr) {
          const info = JSON.parse(infoStr);
          if (
            info.fileName === sourceInfo.fileName &&
            info.lineNumber === sourceInfo.lineNumber &&
            info.columnNumber === sourceInfo.columnNumber
          ) {
            return el;
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }

    return null;
  };

  /**
   * Parent-driven style patch
   */
  const handleExternalStyleUpdate = async (message: UpdateStyleMessage) => {
    if (!state.config.iframeMode?.enabled) return;

    const updateMessage = message;
    const { sourceInfo, newClass } = updateMessage.payload;

    try {
      // validate
      const validation = messageValidator.validate(updateMessage);
      if (!validation.isValid) {
        console.error(
          '[DesignMode] Invalid style update message:',
          validation.errors
        );
        return;
      }

      // resolve element
      const element = findElementBySourceInfo(sourceInfo);
      if (!element) {
        console.error(
          '[DesignMode] Element not found for sourceInfo:',
          sourceInfo
        );

        sendToParent({
          type: 'ERROR',
          payload: {
            code: 'ELEMENT_NOT_FOUND',
            message: `Element not found: ${sourceInfo.fileName}:${sourceInfo.lineNumber}:${sourceInfo.columnNumber}`,
            details: { sourceInfo },
          },
          timestamp: Date.now(),
        });
        return;
      }

      const oldClass = element.className;

      // Same element-id → list sync
      const elementId = element.getAttribute(AttributeNames.elementId);
      let relatedElements: HTMLElement[] = [element];

      if (elementId) {
        // query all [element-id]
        const allElementsWithId = Array.from(
          document.querySelectorAll(`[${AttributeNames.elementId}]`)
        ) as HTMLElement[];

        relatedElements = allElementsWithId.filter(el => {
          const elId = el.getAttribute(AttributeNames.elementId);
          return elId === elementId;
        });
      } else {
        console.warn('[DesignMode] Element missing element-id attribute, only updating current element');
      }

      // Apply class to all peers
      relatedElements.forEach(el => {
        el.setAttribute('data-ignore-mutation', 'true');
        el.className = newClass;
        // Use setTimeout to ensure MutationObserver sees the attribute
        setTimeout(() => {
          el.removeAttribute('data-ignore-mutation');
        }, 0);
      });

      // Refresh selection ref
      if (state.selectedElement === element) {
        state.selectedElement = element;
      }

      // STYLE_UPDATED
      sendToParent({
        type: 'STYLE_UPDATED',
        payload: {
          sourceInfo,
          oldClass,
          newClass,
        },
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error(
        '[DesignMode] Error handling external style update:',
        error
      );

      // ERROR
      sendToParent({
        type: 'ERROR',
        payload: {
          code: 'STYLE_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { sourceInfo: updateMessage.payload.sourceInfo },
        },
        timestamp: Date.now(),
      });
    }
  };

  /**
   * Parent-driven content patch
   */
  const handleExternalContentUpdate = async (message: UpdateContentMessage) => {
    if (!state.config.iframeMode?.enabled) return;

    const updateMessage = message;
    const { sourceInfo, newContent } = updateMessage.payload;

    try {
      // validate
      const validation = messageValidator.validate(updateMessage);
      if (!validation.isValid) {
        console.error(
          '[DesignMode] Invalid content update message:',
          validation.errors
        );
        return;
      }

      // resolve element
      const element = findElementBySourceInfo(sourceInfo);
      if (!element) {
        console.error(
          '[DesignMode] Element not found for sourceInfo:',
          sourceInfo
        );

        sendToParent({
          type: 'ERROR',
          payload: {
            code: 'ELEMENT_NOT_FOUND',
            message: `Element not found: ${sourceInfo.fileName}:${sourceInfo.lineNumber}:${sourceInfo.columnNumber}`,
            details: { sourceInfo },
          },
          timestamp: Date.now(),
        });
        return;
      }

      const originalContent = element.innerText || element.textContent || '';

      // Same element-id → list sync
      const elementId = element.getAttribute(AttributeNames.elementId);
      let relatedElements: HTMLElement[] = [element];

      if (elementId) {
        // query all [element-id]
        const allElementsWithId = Array.from(
          document.querySelectorAll(`[${AttributeNames.elementId}]`)
        ) as HTMLElement[];

        relatedElements = allElementsWithId.filter(el => {
          const elId = el.getAttribute(AttributeNames.elementId);
          return elId === elementId;
        });
      } else {
        console.warn('[DesignMode] Element missing element-id attribute, only updating current element');
      }

      // Apply text to all peers (list sync)
      relatedElements.forEach(el => {
        el.setAttribute('data-ignore-mutation', 'true');
        el.innerText = newContent;
        // Use setTimeout to ensure MutationObserver sees the attribute
        setTimeout(() => {
          el.removeAttribute('data-ignore-mutation');
        }, 0);
      });

      // Refresh selection ref
      if (state.selectedElement === element) {
        state.selectedElement = element;
      }

      // CONTENT_UPDATED_CALLBACK
      sendToParent({
        type: 'CONTENT_UPDATED_CALLBACK',
        payload: {
          sourceInfo,
          oldValue: originalContent,
          newValue: newContent,
        },
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error(
        '[DesignMode] Error handling external content update:',
        error
      );

      // ERROR
      sendToParent({
        type: 'ERROR',
        payload: {
          code: 'CONTENT_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { sourceInfo: updateMessage.payload.sourceInfo },
        },
        timestamp: Date.now(),
      });
    }
  };

  /**
   * updateSource (HTTP)
   */
  const updateSource = async (
    element: HTMLElement,
    newValue: string,
    type: 'style' | 'content',
    originalValue?: string
  ) => {
    const sourceInfo = extractSourceInfo(element);
    if (!sourceInfo) {
      throw new Error('Element does not have source mapping data');
    }

    try {
      const response = await fetch('/__appdev_design_mode/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: sourceInfo.fileName,
          line: sourceInfo.lineNumber,
          column: sourceInfo.columnNumber,
          newValue,
          type,
          originalValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update source');
      }

    } catch (error) {
      console.error('[DesignMode] Error updating source:', error);
      throw error;
    }
  };

  /**
   * Parent BATCH_UPDATE
   */
  const handleExternalBatchUpdate = async (message: BatchUpdateMessage) => {
    const updateMessage = message;
    const { updates } = updateMessage.payload;

    try {
      // validate
      const validation = messageValidator.validate(updateMessage);
      if (!validation.isValid) {
        console.error(
          '[DesignMode] Invalid batch update message:',
          validation.errors
        );
        return;
      }

      // Promise.allSettled items
      const results = await Promise.allSettled(
        updates.map(async (update: any) => {
          const element = findElementBySourceInfo(update.sourceInfo);
          if (!element) {
            throw new Error(
              `Element not found: ${update.sourceInfo.fileName}:${update.sourceInfo.lineNumber}`
            );
          }

          if (update.type === 'style') {
            element.setAttribute('data-ignore-mutation', 'true');
            element.className = update.newValue;
            setTimeout(() => element.removeAttribute('data-ignore-mutation'), 0);
          } else if (update.type === 'content') {
            element.setAttribute('data-ignore-mutation', 'true');
            element.innerText = update.newValue;
            setTimeout(() => element.removeAttribute('data-ignore-mutation'), 0);
          }

          await updateSource(
            element,
            update.newValue,
            update.type,
            update.originalValue
          );

          return { success: true, sourceInfo: update.sourceInfo };
        })
      );

    } catch (error) {
      console.error('[DesignMode] Error handling batch update:', error);

      // ERROR
      sendToParent({
        type: 'ERROR',
        payload: {
          code: 'BATCH_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { updatesCount: updates?.length || 0 },
        },
        timestamp: Date.now(),
      });
    }
  };

  /**
   * selectElement
   */
  const selectElement = async (element: HTMLElement | null) => {
    if (element && (element.hasAttribute(AttributeNames.staticContent)
      || element.hasAttribute(AttributeNames.staticClass))) {
      state.selectedElement = element;
    } else {
      state.selectedElement = null;
    }

    // iframe: ELEMENT_SELECTED
    if (element && state.config.iframeMode?.enabled) {
      const sourceInfo = resolveSourceInfo(element);

      if (sourceInfo) {
        const hasStaticContentAttr = element.hasAttribute(AttributeNames.staticContent);
        const isActuallyPureText = isPureStaticText(element);
        const isStaticText = hasStaticContentAttr && isActuallyPureText;

        const isStaticClass = element.hasAttribute(AttributeNames.staticClass);

        let textContent = '';
        if (isStaticText) {
          textContent = element.textContent || element.innerText || '';
        } else {
          textContent = element.innerText || element.textContent || '';
        }

        const elementInfo: ElementInfo = {
          tagName: element.tagName.toLowerCase(),
          className: element.className,
          textContent: textContent,
          sourceInfo,
          isStaticText: isStaticText || false,
          isStaticClass: isStaticClass,
        };

        sendToParent({
          type: 'ELEMENT_SELECTED',
          payload: { elementInfo },
          timestamp: Date.now(),
        });

      } else {
        console.warn(
          `[DesignMode] Element selected but could not resolve source info:`,
          element
        );
      }
    } else if (!element && state.config.iframeMode?.enabled) {
      sendToParent({
        type: 'ELEMENT_DESELECTED',
        timestamp: Date.now(),
      });
    }
  };

  /**
   * toggleDesignMode
   */
  const toggleDesignMode = () => {
    state.isDesignMode = !state.isDesignMode;
    if (!state.isDesignMode) {
      state.selectedElement = null;
    }
  };

  /**
   * Local extractSourceInfo helper
   */
  const extractSourceInfo = (element: HTMLElement): SourceInfo | null => {
    return extractSourceInfoFromAttributes(element);
  };

  /**
   * modifyElementClass
   */
  const modifyElementClass = async (element: HTMLElement, newClass: string) => {
    const oldClasses = element.className;
    const mergedClasses = twMerge(oldClasses, newClass);

    // twMerge + DOM
    element.className = mergedClasses;

    // PATCH /update
    await updateSource(element, mergedClasses, 'style', oldClasses);

    // modifications list
    const modification: Modification = {
      id: Date.now().toString(),
      element: element.id || 'unknown',
      type: 'class',
      oldValue: oldClasses,
      newValue: mergedClasses,
      timestamp: Date.now(),
    };

    state.modifications = [modification, ...state.modifications];

    // STYLE_UPDATED to parent
    if (state.config.iframeMode?.enabled) {
      const sourceInfo = extractSourceInfo(element);
      if (sourceInfo) {
        sendToParent({
          type: 'STYLE_UPDATED',
          payload: {
            sourceInfo,
            oldClass: oldClasses,
            newClass: mergedClasses,
          },
          timestamp: Date.now(),
        });
      }
    }
  };

  /**
   * updateElementContent
   */
  const updateElementContent = async (element: HTMLElement, newContent: string) => {
    const sourceInfo = extractSourceInfo(element);
    const originalContent = element.innerText;

    // Update DOM
    element.innerText = newContent;

    // PATCH /update
    await updateSource(element, newContent, 'content', originalContent);

    // CONTENT_UPDATED to parent
    if (state.config.iframeMode?.enabled) {
      const sourceInfo = extractSourceInfo(element);
      if (sourceInfo) {
        sendToParent({
          type: 'CONTENT_UPDATED',
          payload: {
            sourceInfo,
            oldValue: originalContent,
            newValue: newContent,
          },
          timestamp: Date.now(),
        });
      }
    }
  };

  /**
   * batchUpdateElements
   */
  const batchUpdateElements = async (
    updates: Array<{
      element: HTMLElement;
      type: 'style' | 'content';
      newValue: string;
      originalValue?: string;
    }>
  ) => {
    if (!state.config.batchUpdate?.enabled) {
      // Sequential fallback
      await Promise.all(
        updates.map(update => {
          if (update.type === 'style') {
            return modifyElementClass(update.element, update.newValue);
          } else {
            return updateElementContent(update.element, update.newValue);
          }
        })
      );
      return;
    }

    // Debounced queue
    const newUpdates = [...pendingBatchUpdates.value, ...updates];
    pendingBatchUpdates.value = newUpdates;

    // Reset debounce timer
    if (batchUpdateTimer.value) {
      clearTimeout(batchUpdateTimer.value);
    }

    // Schedule flush
    const timer = setTimeout(async () => {
      try {
        // Build payload
        const batchUpdateItems = newUpdates.map(update => {
          const sourceInfo = extractSourceInfo(update.element);
          if (!sourceInfo) {
            throw new Error('Element missing source mapping');
          }

          return {
            type: update.type,
            sourceInfo,
            newValue: update.newValue,
            originalValue: update.originalValue,
          };
        });

        // iframe: bridge BATCH_UPDATE
        if (state.config.iframeMode?.enabled) {
          await bridge.send({
            type: 'BATCH_UPDATE',
            payload: { updates: batchUpdateItems },
            timestamp: Date.now(),
          });
        } else {
          // top: fetch batch endpoint
          await fetch('/__appdev_design_mode/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              updates: batchUpdateItems,
            }),
          });
        }

        // Clear queue
        pendingBatchUpdates.value = [];
      } catch (error) {
        console.error('[DesignMode] Batch update failed:', error);
        pendingBatchUpdates.value = [];
        throw error;
      }
    }, state.config.batchUpdate.debounceMs);

    batchUpdateTimer.value = timer;
  };

  /**
   * resetModifications
   */
  const resetModifications = () => {
    window.location.reload();
  };

  /**
   * sendMessage
   */
  const sendMessage = async <T extends DesignModeMessage>(message: T) => {
    if (state.config.iframeMode?.enabled) {
      await bridge.send(message);
    }
  };

  /**
   * sendMessageWithResponse
   */
  const sendMessageWithResponse = async <T extends DesignModeMessage, R extends DesignModeMessage>(
    message: T,
    responseType: R['type']
  ): Promise<R> => {
    if (state.config.iframeMode?.enabled) {
      return await bridge.sendWithResponse(message, responseType);
    }
    throw new Error('Iframe mode is not enabled');
  };

  /**
   * healthCheck
   */
  const healthCheck = async () => {
    if (state.config.iframeMode?.enabled) {
      return await bridge.healthCheck();
    }
    return { status: 'healthy', details: { mode: 'standalone' } };
  };

  /**
   * Wire iframe bridge listeners
   */
  const setupBridge = () => {
    if (state.config.iframeMode?.enabled) {
      state.bridgeStatus = 'connecting';

      // Poll isConnected
      const connectionCheck = setInterval(() => {
        const connected = bridge.isConnected();
        state.isConnected = connected;
        state.bridgeStatus = connected ? 'connected' : 'disconnected';
      }, 1000);

      // TOGGLE_DESIGN_MODE
      unsubscribeHandlers.value.push(
        bridge.on<ToggleDesignModeMessage>('TOGGLE_DESIGN_MODE', message => {
          const newState = message.enabled;
          state.isDesignMode = newState;

          // Echo DESIGN_MODE_CHANGED
          if (window.self !== window.top) {
            sendToParent({
              type: 'DESIGN_MODE_CHANGED',
              enabled: newState,
              requestId: message.requestId,
              timestamp: Date.now(),
            });
          }
        })
      );

      // UPDATE_STYLE
      unsubscribeHandlers.value.push(
        bridge.on<UpdateStyleMessage>('UPDATE_STYLE', async message => {
          await handleExternalStyleUpdate(message);
        })
      );

      // UPDATE_CONTENT
      unsubscribeHandlers.value.push(
        bridge.on<UpdateContentMessage>('UPDATE_CONTENT', async message => {
          await handleExternalContentUpdate(message);
        })
      );

      // BATCH_UPDATE
      unsubscribeHandlers.value.push(
        bridge.on<BatchUpdateMessage>('BATCH_UPDATE', async message => {
          await handleExternalBatchUpdate(message);
        })
      );

      // HEARTBEAT
      unsubscribeHandlers.value.push(
        bridge.on<HeartbeatMessage>('HEARTBEAT', _ => {
          // Echo HEARTBEAT
          bridge.send({
            type: 'HEARTBEAT',
            payload: { timestamp: Date.now() },
            timestamp: Date.now(),
          });
        })
      );

      // HEALTH_CHECK
      unsubscribeHandlers.value.push(
        bridge.on<HealthCheckMessage>('HEALTH_CHECK', async message => {
          const healthStatus = await bridge.healthCheck();
          const response: HealthCheckResponseMessage = {
            type: 'HEALTH_CHECK_RESPONSE',
            payload: {
              status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
              version: '2.0.0',
              uptime: Date.now() - ((window as any).__startTime || 0),
            },
            requestId: message.requestId || '',
            timestamp: Date.now(),
          };
          bridge.send(response);
        })
      );

      // Initial health probe
      const initialHealthCheck = setTimeout(async () => {
        try {
          const health = await bridge.healthCheck();
          state.bridgeStatus = health.status === 'healthy' ? 'connected' : 'error';
        } catch (error) {
          state.bridgeStatus = 'error';
        }
      }, 1000);

      // Cleanup function
      return () => {
        clearInterval(connectionCheck);
        clearTimeout(initialHealthCheck);
        unsubscribeHandlers.value.forEach(unsubscribe => unsubscribe());
      };
    }
  };

  onMounted(() => {
    const cleanup = setupBridge();
    if (cleanup) {
      onBeforeUnmount(cleanup);
    }
  });

  const api = {
    // State
    state,
    isDesignMode: computed(() => state.isDesignMode),
    selectedElement: computed(() => state.selectedElement),
    modifications: computed(() => state.modifications),
    isConnected: computed(() => state.isConnected),
    bridgeStatus: computed(() => state.bridgeStatus),
    config: computed(() => state.config),

    // Actions
    toggleDesignMode,
    selectElement,
    modifyElementClass,
    updateElementContent,
    batchUpdateElements,
    resetModifications,

    // Bridge helpers
    sendMessage,
    sendMessageWithResponse,
    healthCheck,
  };

  // Provide for injection
  provide(DESIGN_MODE_KEY, api);

  return api;
}

/**
 * Inject design mode context
 */
export function useDesignMode() {
  const context = inject<ReturnType<typeof createDesignMode>>(DESIGN_MODE_KEY);
  if (!context) {
    throw new Error('useDesignMode must be used within a component that has called createDesignMode');
  }
  return context;
}
