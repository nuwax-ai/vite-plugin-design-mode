import { ref } from 'vue';
import type { UpdateState, UpdateResult, UpdateManagerConfig } from '@xagi/design-mode-shared/types';
import type { SourceInfo } from '@xagi/design-mode-shared/messages';
import { extractSourceInfo, hasSourceMapping } from '@xagi/design-mode-shared/sourceInfo';
import { isPureStaticText } from '@xagi/design-mode-shared/elementUtils';
import { AttributeNames } from '@xagi/design-mode-shared/attributeNames';
import { resolveSourceInfo } from '@xagi/design-mode-shared/sourceInfoResolver';

/**
 * Vue3 composable for edit management
 * Handles contentEditable mode, real-time sync, and update operations
 */
export function useEditManager(
  processUpdate: (update: UpdateState) => Promise<UpdateResult>,
  config: UpdateManagerConfig
) {
  const lastRealtimeNotify = ref(0);
  const REALTIME_THROTTLE_MS = 300;

  /**
   * Handle direct edit (double click or mutation)
   */
  const handleDirectEdit = (element: HTMLElement, type: 'content' | 'style') => {
    if (type === 'content') {
      editTextContent(element);
    } else {
      editStyle(element);
    }
  };

  /**
   * Edit text content using contentEditable
   */
  const editTextContent = async (element: HTMLElement) => {
    const sourceInfo = resolveSourceInfo(element);
    if (!sourceInfo) return;

    const hasStaticContent = element.hasAttribute(AttributeNames.staticContent);
    if (!hasStaticContent) {
      console.warn('[EditManager] Cannot edit: element does not have static-content attribute. This might be a component definition, not a usage site.');
      return;
    }

    const originalText = element.innerText;
    const originalContentEditable = element.contentEditable;

    element.contentEditable = 'true';
    element.setAttribute('data-ignore-mutation', 'true');

    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const handleSave = () => {
      const newText = element.innerText.trim();

      element.contentEditable = 'false';
      element.removeAttribute('data-ignore-mutation');

      element.removeEventListener('blur', handleSave);
      element.removeEventListener('input', handleInput);
      element.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside, true);

      if (newText !== originalText.trim()) {
        element.innerText = newText;

        const relatedElements = findAllElementsWithSameSource(element, sourceInfo);
        relatedElements.forEach(el => {
          if (el !== element) {
            el.innerText = newText;
          }
        });

        notifyContentChanged(element, newText, sourceInfo, originalText);
      }
    };

    const handleCancel = () => {
      element.innerText = originalText;
      element.contentEditable = 'false';
      element.removeAttribute('data-ignore-mutation');

      element.removeEventListener('blur', handleSave);
      element.removeEventListener('input', handleInput);
      element.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!element.contains(e.target as Node)) {
        handleSave();
      }
    };

    const handleInput = () => {
      const currentText = element.innerText.trim();

      const relatedElements = findAllElementsWithSameSource(element, sourceInfo);
      relatedElements.forEach(el => {
        if (el !== element) {
          el.innerText = currentText;
        }
      });

      notifyContentChangedRealtime(element, currentText, sourceInfo, originalText);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          return;
        } else {
          e.preventDefault();
          element.blur();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    element.addEventListener('blur', handleSave);
    element.addEventListener('input', handleInput);
    element.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside, true);

    element.focus();
  };

  /**
   * Update content
   */
  const updateContent = async (
    element: HTMLElement,
    newValue: string,
    sourceInfo?: SourceInfo,
    oldValue?: string
  ): Promise<UpdateResult> => {
    const finalSourceInfo = sourceInfo || extractSourceInfo(element);
    if (!finalSourceInfo) {
      throw new Error('Cannot update content: no source info available');
    }

    const finalOldValue = oldValue ?? element.innerText;

    const update: UpdateState = {
      id: generateUpdateId(),
      operation: 'content_update',
      sourceInfo: finalSourceInfo,
      element,
      oldValue: finalOldValue,
      newValue,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0,
      persist: false,
    };

    const relatedElements = findAllElementsWithSameSource(element, finalSourceInfo);
    relatedElements.forEach(el => {
      if (el !== element) {
        el.innerText = newValue;
      }
    });

    return processUpdate(update);
  };

  /**
   * Update style (class)
   */
  const updateStyle = async (
    element: HTMLElement,
    newClass: string,
    sourceInfo: SourceInfo
  ): Promise<UpdateResult> => {
    const oldClass = element.className;
    const finalSourceInfo = sourceInfo || extractSourceInfo(element);
    if (!finalSourceInfo) {
      throw new Error('Cannot update style: no source info available');
    }

    const update: UpdateState = {
      id: generateUpdateId(),
      operation: 'class_update',
      sourceInfo,
      element,
      oldValue: oldClass,
      newValue: newClass,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0,
      persist: false,
    };

    const relatedElements = findAllElementsWithSameSource(element, finalSourceInfo);
    relatedElements.forEach(el => {
      if (el !== element) {
        el.className = newClass;
      }
    });

    return processUpdate(update);
  };

  /**
   * Edit style (trigger UI)
   */
  const editStyle = (element: HTMLElement) => {
    // Placeholder for style editing UI
  };

  /**
   * Update attribute
   */
  const updateAttribute = async (
    element: HTMLElement,
    attributeName: string,
    newValue: string,
    sourceInfo: SourceInfo
  ): Promise<UpdateResult> => {
    const oldValue = element.getAttribute(attributeName) || '';

    const update: UpdateState = {
      id: generateUpdateId(),
      operation: 'attribute_update',
      sourceInfo,
      element,
      oldValue,
      newValue,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0,
      persist: false,
    };

    const relatedElements = findAllElementsWithSameSource(element, sourceInfo);
    relatedElements.forEach(el => {
      if (el !== element) {
        el.setAttribute(attributeName, newValue);
      }
    });

    return processUpdate(update);
  };

  /**
   * Edit attributes (trigger UI)
   */
  const editAttributes = (element: HTMLElement) => {
    // Placeholder for attribute editing UI
  };

  const generateUpdateId = (): string => {
    return `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Notify parent of final text (iframe only); does not write source files.
   */
  const notifyContentChanged = (
    element: HTMLElement,
    newValue: string,
    sourceInfo?: SourceInfo,
    oldValue?: string
  ): void => {
    const finalSourceInfo = sourceInfo || resolveSourceInfo(element);
    if (!finalSourceInfo) {
      console.warn('[EditManager] Cannot notify: no source info available');
      return;
    }

    if (window.self !== window.top) {
      window.parent.postMessage({
        type: 'CONTENT_UPDATED',
        payload: {
          sourceInfo: finalSourceInfo,
          oldValue: oldValue || '',
          newValue: newValue,
        },
        timestamp: Date.now(),
      }, '*');
    }
  };

  /**
   * Throttled CONTENT_UPDATED while typing (realtime: true).
   */
  const notifyContentChangedRealtime = (
    element: HTMLElement,
    newValue: string,
    sourceInfo?: SourceInfo,
    oldValue?: string
  ): void => {
    const now = Date.now();

    if (now - lastRealtimeNotify.value < REALTIME_THROTTLE_MS) {
      return;
    }

    lastRealtimeNotify.value = now;

    const finalSourceInfo = sourceInfo || resolveSourceInfo(element);
    if (!finalSourceInfo) {
      return;
    }

    if (window.self !== window.top) {
      window.parent.postMessage({
        type: 'CONTENT_UPDATED',
        payload: {
          sourceInfo: finalSourceInfo,
          oldValue: oldValue || '',
          newValue: newValue,
          realtime: true,
        },
        timestamp: Date.now(),
      }, '*');
    }
  };

  /**
   * List peers that share the same logical instance (lists): same `element-id`,
   * same static-content presence, same mapped file.
   */
  const findAllElementsWithSameSource = (element: HTMLElement, sourceInfo?: SourceInfo): HTMLElement[] => {
    const elementId = element.getAttribute(AttributeNames.elementId);
    const hasStaticContent = element.hasAttribute(AttributeNames.staticContent);
    const refSourceInfo = extractSourceInfo(element);
    const refFileName = refSourceInfo?.fileName;

    if (!elementId) {
      console.warn('[EditManager] Element missing element-id attribute:', element);
      return [element];
    }

    const allElementsWithId = Array.from(
      document.querySelectorAll(`[${AttributeNames.elementId}]`)
    ) as HTMLElement[];

    return allElementsWithId.filter(el => {
      const elId = el.getAttribute(AttributeNames.elementId);
      const elHasStaticContent = el.hasAttribute(AttributeNames.staticContent);
      const elSourceInfo = extractSourceInfo(el);
      const elFileName = elSourceInfo?.fileName;

      if (elId !== elementId) return false;
      if (elHasStaticContent !== hasStaticContent) return false;
      if (elFileName !== refFileName) return false;

      return true;
    });
  };

  return {
    handleDirectEdit,
    editTextContent,
    updateContent,
    updateStyle,
    editStyle,
    updateAttribute,
    editAttributes,
  };
}
