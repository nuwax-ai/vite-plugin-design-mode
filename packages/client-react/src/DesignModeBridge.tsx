import React, { useEffect, useCallback } from 'react';
import { useDesignMode } from './DesignModeContext';
import { bridge } from './bridge';
import {
  UpdateStyleMessage,
  UpdateContentMessage,
  ToggleDesignModeMessage,
  ElementSelectedMessage,
  ElementDeselectedMessage
} from '@xagi/design-mode-shared/messages';
import { AttributeNames } from '@xagi/design-mode-shared/attributeNames';
import { isPureStaticText } from '@xagi/design-mode-shared/elementUtils';
import { resolveSourceInfo } from '@xagi/design-mode-shared/sourceInfoResolver';
import { extractSourceInfo } from '@xagi/design-mode-shared/sourceInfo';

export const DesignModeBridge: React.FC = () => {
  const { selectedElement, modifyElementClass, updateElementContent } =
    useDesignMode();

  /** True in iframe with an active bridge target. */
  const isBridgeReady = useCallback(() => {
    if (window.self === window.top) {
      return false;
    }

    if (!bridge.isConnectedToTarget()) {
      return false;
    }

    return true;
  }, []);

  const safeSend = useCallback(
    async (type: string, payload: any) => {
      if (!isBridgeReady()) {
        return;
      }

      try {
        const message = {
          type,
          payload,
          timestamp: Date.now(),
        };

        await bridge.send(message as any);
      } catch (error) {
        // Failed to send message
      }
    },
    [isBridgeReady]
  );

  /** Push ELEMENT_SELECTED / DESELECTED to parent after a short delay (bridge init). */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedElement) {
        const sourceInfo = resolveSourceInfo(selectedElement);
        // console.log('[DesignModeBridge] resolveSourceInfo', window.location.href, sourceInfo);

        // Static text: static-content attr + DOM is text-only
        const hasStaticContentAttr = selectedElement.hasAttribute(AttributeNames.staticContent);
        const isActuallyPureText = isPureStaticText(selectedElement);
        const isStaticText = hasStaticContentAttr && isActuallyPureText;

        // Editable class when static-class is present
        const isStaticClass = selectedElement.hasAttribute(AttributeNames.staticClass);

        const elementData = {
          tagName: selectedElement.tagName.toLowerCase(),
          className: selectedElement.className || '',
          textContent: (
            selectedElement.textContent ||
            selectedElement.innerText ||
            ''
          ).substring(0, 100),
          sourceInfo: sourceInfo || {
            fileName: '',
            lineNumber: 0,
            columnNumber: 0,
          },
          isStaticText: isStaticText || false,
          isStaticClass: isStaticClass,
        };

        if (
          !elementData.sourceInfo.fileName ||
          elementData.sourceInfo.lineNumber === 0
        ) {
          console.warn(
            '[DesignModeBridge] Warning: Element missing source mapping attributes. Updates may fail.'
          );
        }

        safeSend('ELEMENT_SELECTED', { elementInfo: elementData });
      } else {
        safeSend('ELEMENT_DESELECTED', null);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedElement, safeSend]);

  /** Parent → iframe: UPDATE_STYLE / UPDATE_CONTENT / TOGGLE */
  useEffect(() => {
    if (!isBridgeReady()) {
      return;
    }

    const unsubscribeStyle = bridge.on<UpdateStyleMessage>('UPDATE_STYLE', (message) => {
      const payload = message.payload;

      if (selectedElement && payload?.sourceInfo && payload?.newClass) {
        // Require matching file:line:col
        const elementSourceInfo = extractSourceInfo(selectedElement);

        if (!elementSourceInfo) {
          console.warn('[DesignModeBridge] Selected element missing source info');
          return;
        }

        const sourceMatches =
          elementSourceInfo.fileName === payload.sourceInfo.fileName &&
          elementSourceInfo.lineNumber === payload.sourceInfo.lineNumber &&
          elementSourceInfo.columnNumber === payload.sourceInfo.columnNumber;

        if (sourceMatches) {
          modifyElementClass(selectedElement, payload.newClass);
        } else {
          console.warn(
            '[DesignModeBridge] Source info mismatch, ignoring style update'
          );
        }
      }
    });

    const unsubscribeContent = bridge.on<UpdateContentMessage>('UPDATE_CONTENT', (message) => {
      const payload = message.payload;

      if (
        selectedElement &&
        payload?.sourceInfo &&
        payload?.newContent !== undefined
      ) {
        // Require matching file:line:col
        const elementSourceInfo = extractSourceInfo(selectedElement);

        if (!elementSourceInfo) {
          console.warn('[DesignModeBridge] Selected element missing source info');
          return;
        }

        const sourceMatches =
          elementSourceInfo.fileName === payload.sourceInfo.fileName &&
          elementSourceInfo.lineNumber === payload.sourceInfo.lineNumber &&
          elementSourceInfo.columnNumber === payload.sourceInfo.columnNumber;

        if (sourceMatches) {
          updateElementContent(selectedElement, payload.newContent);
        } else {
          console.warn(
            '[DesignModeBridge] Source info mismatch, ignoring content update'
          );
        }
      }
    });

    const unsubscribeToggle = bridge.on<ToggleDesignModeMessage>(
      'TOGGLE_DESIGN_MODE',
      (message) => {
      }
    );

    return () => {
      unsubscribeStyle();
      unsubscribeContent();
      unsubscribeToggle();
    };
  }, [
    selectedElement,
    modifyElementClass,
    updateElementContent,
    isBridgeReady,
  ]);

  /** Periodic bridge.healthCheck in iframe */
  useEffect(() => {
    if (!isBridgeReady()) {
      return;
    }

    const checkBridgeHealth = async () => {
      try {
        const health = await bridge.healthCheck();
        console.log('[DesignModeBridge] Bridge health check:', health);
      } catch (error) {
        console.warn('[DesignModeBridge] Bridge health check failed:', error);
      }
    };

    checkBridgeHealth();

    const healthTimer = setInterval(checkBridgeHealth, 30000);

    return () => clearInterval(healthTimer);
  }, [isBridgeReady]);

  return null;
};
