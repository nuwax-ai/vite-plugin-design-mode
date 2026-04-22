import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { twMerge } from 'tailwind-merge';
import {
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
import { bridge, messageValidator } from './bridge';
import { AttributeNames } from '@xagi/design-mode-shared/attributeNames';
import { isPureStaticText } from '@xagi/design-mode-shared/elementUtils';
import { extractSourceInfo as extractSourceInfoFromAttributes } from '@xagi/design-mode-shared/sourceInfo';
import { resolveSourceInfo } from '@xagi/design-mode-shared/sourceInfoResolver';

// TEMP: 生产环境调试日志（问题排查完成后请删除）
const runtimeTempLog = (message: string, data?: unknown) => {
  console.log(`[DesignModeDebug][IFRAME-REACT][TEMP] ${message}`, data);
};

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

interface DesignModeContextType {
  // State
  isDesignMode: boolean;
  selectedElement: HTMLElement | null;
  modifications: Modification[];
  isConnected: boolean;
  bridgeStatus: 'connected' | 'disconnected' | 'connecting' | 'error';

  // Config
  config: DesignModeConfig;

  // Actions
  toggleDesignMode: () => void;
  selectElement: (element: HTMLElement | null) => void;
  modifyElementClass: (element: HTMLElement, newClass: string) => Promise<void>;
  updateElementContent: (
    element: HTMLElement,
    newContent: string
  ) => Promise<void>;
  batchUpdateElements: (
    updates: Array<{
      element: HTMLElement;
      type: 'style' | 'content';
      newValue: string;
      originalValue?: string;
    }>
  ) => Promise<void>;
  resetModifications: () => void;

  // Bridge helpers
  sendMessage: <T extends DesignModeMessage>(message: T) => Promise<void>;
  sendMessageWithResponse: <
    T extends DesignModeMessage,
    R extends DesignModeMessage,
  >(
    message: T,
    responseType: R['type']
  ) => Promise<R>;
  healthCheck: () => Promise<any>;
}

const DesignModeContext = createContext<DesignModeContextType | undefined>(
  undefined
);

export const DesignModeProvider: React.FC<{
  children: React.ReactNode;
  config?: DesignModeConfig;
}> = ({ children, config: userConfig = {} }) => {
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
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(
    null
  );
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<
    'connected' | 'disconnected' | 'connecting' | 'error'
  >('connecting');
  const [config] = useState<DesignModeConfig>(defaultConfig);

  // Batch debounce state
  const [batchUpdateTimer, setBatchUpdateTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [pendingBatchUpdates, setPendingBatchUpdates] = useState<
    Array<{
      element: HTMLElement;
      type: 'style' | 'content';
      newValue: string;
      originalValue?: string;
    }>
  >([]);

  useEffect(() => {
    runtimeTempLog('DesignModeProvider mounted', {
      href: window.location.href,
      origin: window.location.origin,
      isIframe: window.self !== window.top,
      bridgeConnected: bridge.isConnected(),
    });
  }, []);

  /**
   * Wire iframe bridge listeners
   */
  useEffect(() => {
    // Bridge setup
    if (config.iframeMode?.enabled) {
      setBridgeStatus('connecting');

      // Poll isConnected
      const connectionCheck = setInterval(() => {
        const connected = bridge.isConnected();
        setIsConnected(connected);
        setBridgeStatus(connected ? 'connected' : 'disconnected');
      }, 1000);

      // Subscriptions
      const unsubscribeHandlers: (() => void)[] = [];

      // TOGGLE_DESIGN_MODE
      unsubscribeHandlers.push(
        bridge.on<ToggleDesignModeMessage>('TOGGLE_DESIGN_MODE', message => {
          const newState = message.enabled;
          runtimeTempLog('received TOGGLE_DESIGN_MODE', {
            enabled: message.enabled,
            requestId: message.requestId,
            timestamp: message.timestamp,
            bridgeConnected: bridge.isConnected(),
          });
          setIsDesignMode(newState);

          // Echo DESIGN_MODE_CHANGED
          if (window.self !== window.top) {
            runtimeTempLog('sending DESIGN_MODE_CHANGED', {
              enabled: newState,
              requestId: message.requestId,
              timestamp: Date.now(),
            });
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
      unsubscribeHandlers.push(
        bridge.on<UpdateStyleMessage>('UPDATE_STYLE', async message => {
          await handleExternalStyleUpdate(message);
        })
      );

      // UPDATE_CONTENT
      unsubscribeHandlers.push(
        bridge.on<UpdateContentMessage>('UPDATE_CONTENT', async message => {
          await handleExternalContentUpdate(message);
        })
      );

      // BATCH_UPDATE
      unsubscribeHandlers.push(
        bridge.on<BatchUpdateMessage>('BATCH_UPDATE', async message => {
          await handleExternalBatchUpdate(message);
        })
      );

      // HEARTBEAT
      unsubscribeHandlers.push(
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
      unsubscribeHandlers.push(
        bridge.on<HealthCheckMessage>('HEALTH_CHECK', async message => {
          const healthStatus = await bridge.healthCheck();
          // Use a type assertion or construct the object carefully to match HealthCheckResponseMessage
          const response: HealthCheckResponseMessage = {
            type: 'HEALTH_CHECK_RESPONSE',
            payload: {
              status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
              version: '2.0.0',
              uptime: Date.now() - ((window as any).__startTime || 0),
            },
            requestId: message.requestId || '', // Provide requestId
            timestamp: Date.now(),
          };
          bridge.send(response);
        })
      );

      // Initial health probe
      const initialHealthCheck = setTimeout(async () => {
        try {
          const health = await bridge.healthCheck();
          setBridgeStatus(health.status === 'healthy' ? 'connected' : 'error');
        } catch (error) {
          setBridgeStatus('error');
        }
      }, 1000);

      return () => {
        clearInterval(connectionCheck);
        clearTimeout(initialHealthCheck);
        unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
      };
    }
  }, [config]);

  /**
   * postMessage when iframe + connected
   */
  const sendToParent = useCallback(
    (message: IframeToParentMessage) => {
      runtimeTempLog('sendToParent called', {
        type: message.type,
        requestId: (message as { requestId?: string }).requestId,
        iframeModeEnabled: config.iframeMode?.enabled,
        bridgeConnected: bridge.isConnected(),
      });

      if (!config.iframeMode?.enabled) {
        return;
      }

      // 优先走 bridge；bridge 未连通或发送失败时兜底直发 parent，避免关键回执丢失。
      if (bridge.isConnected()) {
        bridge.send(message).catch(error => {
          runtimeTempLog('bridge.send failed, fallback to parent.postMessage', {
            type: message.type,
            requestId: (message as { requestId?: string }).requestId,
            error: error instanceof Error ? error.message : String(error),
          });
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
        runtimeTempLog('bridge disconnected, direct parent.postMessage', {
          type: message.type,
          requestId: (message as { requestId?: string }).requestId,
        });
        window.parent.postMessage(message, '*');
      }
    },
    [config.iframeMode?.enabled]
  );

  /**
   * findElementBySourceInfo
   */
  const findElementBySourceInfo = useCallback(
    (sourceInfo: SourceInfo): HTMLElement | null => {
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
    },
    []
  );

  /**
   * Parent-driven style patch
   */
  const handleExternalStyleUpdate = useCallback(
    async (message: UpdateStyleMessage) => {
      if (!config.iframeMode?.enabled) return;

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
        if (selectedElement === element) {
          setSelectedElement(element);
        }

        // (persist via API — commented)
        // try {
        //   const response = await fetch('/__appdev_design_mode/update', {
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify({
        //       filePath: sourceInfo.fileName,
        //       line: sourceInfo.lineNumber,
        //       column: sourceInfo.columnNumber,
        //       newValue: newClass,
        //       type: 'style',
        //       originalValue: oldClass,
        //     }),
        //   });

        //   if (!response.ok) {
        //     throw new Error('Failed to update source');
        //   }
        // } catch (error) {
        //   console.error('[DesignMode] Error updating source:', error);
        //   throw error;
        // }

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
    },
    [
      selectedElement,
      config.iframeMode?.enabled,
      sendToParent,
      setSelectedElement,
      findElementBySourceInfo
    ]
  );

  /**
   * Parent-driven content patch
   */
  const handleExternalContentUpdate = useCallback(
    async (message: UpdateContentMessage) => {
      if (!config.iframeMode?.enabled) return;

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
        if (selectedElement === element) {
          setSelectedElement(element);
        }

        // persist flag (commented)
        // if (updateMessage.payload.persist !== false) {
        //   // Persist via API using extractSourceInfo (commented)
        //   const elementSourceInfo = extractSourceInfo(element);
        //   if (elementSourceInfo) {
        //     try {
        //       const response = await fetch('/__appdev_design_mode/update', {
        //         method: 'POST',
        //         headers: {
        //           'Content-Type': 'application/json',
        //         },
        //         body: JSON.stringify({
        //           filePath: elementSourceInfo.fileName,
        //           line: elementSourceInfo.lineNumber,
        //           column: elementSourceInfo.columnNumber,
        //           newValue: newContent,
        //           type: 'content',
        //           originalValue: originalContent,
        //         }),
        //       });

        //       if (!response.ok) {
        //         throw new Error('Failed to update source');
        //       }
        //     } catch (error) {
        //       console.error('[DesignMode] Error updating source:', error);
        //       throw error;
        //     }
        //   }
        // }

        // STYLE_UPDATED
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
    },
    [
      selectedElement,
      config.iframeMode?.enabled,
      sendToParent,
      setSelectedElement,
      findElementBySourceInfo
    ]
  );

  /**
   * updateSource (HTTP)
   */
  const updateSource = useCallback(
    async (
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
    },
    []
  );

  /**
   * Parent BATCH_UPDATE
   */
  const handleExternalBatchUpdate = useCallback(
    async (message: BatchUpdateMessage) => {
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
    },
    [findElementBySourceInfo, sendToParent, updateSource]
  );

  /**
   * selectElement
   */
  const selectElement = useCallback(
    async (element: HTMLElement | null) => {
      if (element && (element.hasAttribute(AttributeNames.staticContent)
        || element.hasAttribute(AttributeNames.staticClass))) {
        setSelectedElement(element);
      } else {
        setSelectedElement(null);
      }

      // iframe: ELEMENT_SELECTED
      if (element && config.iframeMode?.enabled) {
        // resolveSourceInfo for usage site

        const sourceInfo = resolveSourceInfo(element);
        // console.log('[DesignModeContext] selectElement - resolveSourceInfo:', sourceInfo);

        if (sourceInfo) {
          // Static text if attr + pure text


          const hasStaticContentAttr = element.hasAttribute(AttributeNames.staticContent);
          const isActuallyPureText = isPureStaticText(element);
          const isStaticText = hasStaticContentAttr && isActuallyPureText;

          // static-class attr

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
      } else if (!element && config.iframeMode?.enabled) {
        sendToParent({
          type: 'ELEMENT_DESELECTED',
          timestamp: Date.now(),
        });
      }
    },
    [config.iframeMode?.enabled]
  );

  /**
   * toggleDesignMode
   */
  const toggleDesignMode = useCallback(() => {
    setIsDesignMode(prev => {
      const next = !prev;
      if (!next) {
        setSelectedElement(null);
      }
      return next;
    });
  }, []);

  /**
   * Local extractSourceInfo helper
   */
  const extractSourceInfo = useCallback(
    (element: HTMLElement): SourceInfo | null => {
      return extractSourceInfoFromAttributes(element);
    },
    []
  );

  /**
   * modifyElementClass
   */
  const modifyElementClass = useCallback(
    async (element: HTMLElement, newClass: string) => {
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

      setModifications(prev => [modification, ...prev]);

      // STYLE_UPDATED to parent
      if (config.iframeMode?.enabled) {
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
    },
    [updateSource, config.iframeMode?.enabled]
  );

  /**
   * updateElementContent
   */
  const updateElementContent = useCallback(
    async (element: HTMLElement, newContent: string) => {
      const sourceInfo = extractSourceInfo(element);
      const originalContent = element.innerText;


      // twMerge + DOM
      element.innerText = newContent;

      // PATCH /update
      await updateSource(element, newContent, 'content', originalContent);

      // STYLE_UPDATED to parent
      if (config.iframeMode?.enabled) {
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
    },
    [updateSource, config.iframeMode?.enabled]
  );

  /**
   * batchUpdateElements
   */
  const batchUpdateElements = useCallback(
    async (
      updates: Array<{
        element: HTMLElement;
        type: 'style' | 'content';
        newValue: string;
        originalValue?: string;
      }>
    ) => {
      if (!config.batchUpdate?.enabled) {
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
      const newUpdates = [...pendingBatchUpdates, ...updates];
      setPendingBatchUpdates(newUpdates);

      // Reset debounce timer
      if (batchUpdateTimer) {
        clearTimeout(batchUpdateTimer);
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
          if (config.iframeMode?.enabled) {
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
          setPendingBatchUpdates([]);
        } catch (error) {
          console.error('[DesignMode] Batch update failed:', error);
          setPendingBatchUpdates([]);
          throw error;
        }
      }, config.batchUpdate.debounceMs);

      setBatchUpdateTimer(timer);
    },
    [
      config.batchUpdate,
      pendingBatchUpdates,
      batchUpdateTimer,
      config.iframeMode?.enabled,
      modifyElementClass,
      updateElementContent,
    ]
  );

  /**
   * resetModifications
   */
  const resetModifications = useCallback(() => {
    window.location.reload();
  }, []);

  /**
   * postMessage when iframe + connected
   */
  const sendMessage = useCallback(
    async <T extends DesignModeMessage>(message: T) => {
      if (config.iframeMode?.enabled) {
        await bridge.send(message);
      }
    },
    [config.iframeMode?.enabled]
  );

  /**
   * sendMessageWithResponse
   */
  const sendMessageWithResponse = useCallback(
    async <T extends DesignModeMessage, R extends DesignModeMessage>(
      message: T,
      responseType: R['type']
    ): Promise<R> => {
      if (config.iframeMode?.enabled) {
        return await bridge.sendWithResponse(message, responseType);
      }
      throw new Error('Iframe mode is not enabled');
    },
    [config.iframeMode?.enabled]
  );

  /**
   * healthCheck
   */
  const healthCheck = useCallback(async () => {
    if (config.iframeMode?.enabled) {
      return await bridge.healthCheck();
    }
    return { status: 'healthy', details: { mode: 'standalone' } };
  }, [config.iframeMode?.enabled]);

  return (
    <DesignModeContext.Provider
      value={{
        // State
        isDesignMode,
        selectedElement,
        modifications,
        isConnected,
        bridgeStatus,

        // Config
        config,

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
      }}
    >
      {children}
    </DesignModeContext.Provider>
  );
};

export const useDesignMode = () => {
  const context = useContext(DesignModeContext);
  if (context === undefined) {
    throw new Error('useDesignMode must be used within a DesignModeProvider');
  }
  return context;
};
