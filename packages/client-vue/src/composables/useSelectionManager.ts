import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { ElementInfo, SourceInfo } from '@xagi/design-mode-shared/messages';
import { AttributeNames, isSourceMappingAttribute } from '@xagi/design-mode-shared/attributeNames';
import { isPureStaticText } from '@xagi/design-mode-shared/elementUtils';
import { extractSourceInfo as extractSourceInfoFromAttributes } from '@xagi/design-mode-shared/sourceInfo';

export interface SelectionManagerConfig {
  enableSelection: boolean;
  enableHover: boolean;
  selectionDelay: number;
  excludeSelectors: string[];
  includeOnlyElements: boolean;
}

/**
 * Vue3 composable for selection management
 * Handles click/hover selection for mapped elements
 */
export function useSelectionManager(
  container: HTMLElement,
  config: SelectionManagerConfig = {
    enableSelection: true,
    enableHover: true,
    selectionDelay: 0,
    excludeSelectors: [
      'script',
      'style',
      'meta',
      'link',
      'head',
      'title',
      'html',
      'body',
      '[data-selection-exclude="true"]',
      '.no-selection'
    ],
    includeOnlyElements: false
  }
) {
  const selectedElement = ref<HTMLElement | null>(null);
  const hoverElement = ref<HTMLElement | null>(null);
  const isSelecting = ref(false);
  const selectionStartTime = ref(0);
  const preventNextClick = ref(false);
  const selectionListeners = new Set<(element: HTMLElement | null) => void>();

  /**
   * Whether element may be selected (mapped + static-content or static-class)
   */
  const isValidElement = (element: HTMLElement): boolean => {
    if (!element || !element.tagName) return false;

    // Exclude context menu
    if (element.closest(`[${AttributeNames.contextMenu}="true"]`)) return false;

    // Exclusion list
    for (const selector of config.excludeSelectors) {
      if (element.matches(selector) || element.closest(selector)) {
        return false;
      }
    }

    // Optional tag whitelist
    if (config.includeOnlyElements) {
      const validElements = ['DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'A'];
      if (!validElements.includes(element.tagName)) {
        return false;
      }
    }

    // Must have -info JSON
    if (!element.hasAttribute(AttributeNames.info)) {
      return false;
    }

    // Need static-content or static-class
    const hasStaticContent = element.hasAttribute(AttributeNames.staticContent);
    const hasStaticClass = element.hasAttribute(AttributeNames.staticClass);

    if (!hasStaticContent && !hasStaticClass) {
      return false;
    }

    return true;
  };

  /**
   * Apply selection highlight
   */
  const selectElement = (element: HTMLElement) => {
    if (selectedElement.value === element) return;

    // Clear previous outline
    if (selectedElement.value) {
      clearElementHighlighting(selectedElement.value);
    }

    selectedElement.value = element;

    // Highlight new node
    highlightElement(element);

    // Notify subscribers
    selectionListeners.forEach(listener => listener(element));
  };

  /**
   * clearSelection
   */
  const clearSelection = () => {
    if (selectedElement.value) {
      clearElementHighlighting(selectedElement.value);
      selectedElement.value = null;
      selectionListeners.forEach(listener => listener(null));
    }
  };

  /**
   * highlightElement
   */
  const highlightElement = (element: HTMLElement) => {
    // Restore prior inline styles if any
    const existingHighlight = element.getAttribute('data-selection-highlight');
    if (existingHighlight) {
      const existingStyles = JSON.parse(existingHighlight);
      Object.entries(existingStyles).forEach(([property, value]) => {
        (element.style as any)[property] = value;
      });
    }

    // Snapshot pre-highlight
    const originalStyles = {
      outline: element.style.outline,
      boxShadow: element.style.boxShadow,
      backgroundColor: element.style.backgroundColor,
      cursor: element.style.cursor
    };

    // Selection chrome
    element.style.outline = '2px solid #007acc';
    element.style.boxShadow = '0 0 0 2px rgba(0, 122, 204, 0.3)';
    element.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
    element.style.cursor = 'pointer';

    // Persist snapshot on data-selection-highlight
    element.setAttribute('data-selection-highlight', JSON.stringify(originalStyles));
  };

  /**
   * clearElementHighlighting
   */
  const clearElementHighlighting = (element: HTMLElement) => {
    const highlightData = element.getAttribute('data-selection-highlight');
    if (highlightData) {
      try {
        const originalStyles = JSON.parse(highlightData);
        Object.entries(originalStyles).forEach(([property, value]) => {
          (element.style as any)[property] = value;
        });
        element.removeAttribute('data-selection-highlight');
      } catch (e) {
        console.warn('[SelectionManager] Failed to restore original styles:', e);
      }
    }
  };

  /**
   * onHoverElement
   */
  const onHoverElement = (element: HTMLElement | null) => {
    // Hook for hover UX
  };

  /**
   * selectAll (first candidate only)
   */
  const selectAll = () => {
    const selectableElements = Array.from(
      container.querySelectorAll('*')
    ).filter(el => isValidElement(el as HTMLElement));

    if (selectableElements.length > 0) {
      selectElement(selectableElements[0] as HTMLElement);
    }
  };

  /**
   * Click handler
   */
  const handleClick = (event: MouseEvent) => {
    if (!config.enableSelection) return;
    if (preventNextClick.value) {
      event.preventDefault();
      event.stopPropagation();
      preventNextClick.value = false;
      return;
    }

    const target = event.target as HTMLElement;
    if (!isValidElement(target)) return;

    // Optional selectionDelay
    if (config.selectionDelay > 0) {
      setTimeout(() => {
        selectElement(target);
      }, config.selectionDelay);
    } else {
      selectElement(target);
    }
  };

  /**
   * mousedown
   */
  const handleMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!isValidElement(target)) return;

    isSelecting.value = true;
    selectionStartTime.value = Date.now();
    preventNextClick.value = false;
  };

  /**
   * mouseup
   */
  const handleMouseUp = (event: MouseEvent) => {
    if (!isSelecting.value) return;

    const target = event.target as HTMLElement;
    const duration = Date.now() - selectionStartTime.value;

    // Long-press (>500ms) suppresses click selection
    if (duration > 500) {
      preventNextClick.value = true;
    }

    isSelecting.value = false;
  };

  /**
   * mouseenter
   */
  const handleMouseEnter = (event: MouseEvent) => {
    if (!config.enableHover) return;

    const target = event.target as HTMLElement;
    if (!isValidElement(target)) return;

    hoverElement.value = target;
    onHoverElement(target);
  };

  /**
   * mouseleave
   */
  const handleMouseLeave = (event: MouseEvent) => {
    if (!config.enableHover) return;

    const target = event.target as HTMLElement;
    if (hoverElement.value === target) {
      hoverElement.value = null;
      onHoverElement(null);
    }
  };

  /**
   * keydown
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    // Esc clears selection
    if (event.key === 'Escape') {
      clearSelection();
    }

    // Ctrl/Cmd+A: select first match
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      selectAll();
    }

    // Ctrl/Cmd+D: clear
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      clearSelection();
    }
  };

  /**
   * keyup
   */
  const handleKeyUp = (event: KeyboardEvent) => {
    // noop
  };

  /**
   * extractSourceInfo
   */
  const extractSourceInfo = (element: HTMLElement): SourceInfo | null => {
    return extractSourceInfoFromAttributes(element);
  };

  /**
   * Walk up for library component root
   */
  const findComponentRoot = (element: HTMLElement): HTMLElement => {
    const sourceInfo = extractSourceInfo(element);
    if (!sourceInfo || !sourceInfo.fileName) return element;

    // Heuristic: components/ui or common
    const isLibraryComponent = sourceInfo.fileName.includes('/components/ui/') ||
      sourceInfo.fileName.includes('/components/common/');

    if (!isLibraryComponent) return element;

    // Stop at file boundary
    let current = element;
    let componentRoot = element;

    while (current.parentElement) {
      const parent = current.parentElement;
      const parentSourceInfo = extractSourceInfo(parent);

      // Boundary: different file or no mapping
      if (!parentSourceInfo || parentSourceInfo.fileName !== sourceInfo.fileName) {
        componentRoot = current;
        break;
      }

      current = parent;
    }

    return componentRoot;
  };

  /**
   * extractElementInfo
   */
  const extractElementInfo = (element: HTMLElement): ElementInfo | null => {
    if (!element) return null;

    // Prefer library root
    const targetElement = findComponentRoot(element);
    const sourceInfo = extractSourceInfo(targetElement);

    if (!sourceInfo) {
      console.warn('[SelectionManager] Element has no source mapping:', targetElement);
      return null;
    }

    // Layout (rect unused below — kept for future)
    const rect = targetElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(targetElement);

    // Static text flags
    const hasStaticContentAttr = targetElement.hasAttribute(AttributeNames.staticContent);
    const isActuallyPureText = isPureStaticText(targetElement);
    const isStaticText = hasStaticContentAttr && isActuallyPureText;

    const isStaticClass = targetElement.hasAttribute(AttributeNames.staticClass);

    // Text snapshot
    let textContent = '';
    if (isStaticText) {
      textContent = getElementTextContent(targetElement);
    } else {
      textContent = targetElement.innerText || targetElement.textContent || '';
    }

    // Ancestor chain with mappings
    const hierarchy: { tagName: string; componentName?: string; fileName?: string }[] = [];
    let current: HTMLElement | null = targetElement;
    while (current && current !== document.body) {
      const info = extractSourceInfo(current);
      if (info) {
        hierarchy.push({
          tagName: current.tagName.toLowerCase(),
          componentName: info.componentName,
          fileName: info.fileName
        });
      }
      current = current.parentElement;
    }

    // DOM attrs as pseudo-props
    const props = getElementAttributes(targetElement);

    return {
      tagName: targetElement.tagName.toLowerCase(),
      className: targetElement.className || '',
      textContent: textContent,
      sourceInfo,
      isStaticText: isStaticText || false,
      isStaticClass: isStaticClass,
      componentName: sourceInfo.componentName,
      componentPath: sourceInfo.fileName,
      props,
      hierarchy
    };
  };

  /**
   * getElementTextContent
   */
  const getElementTextContent = (element: HTMLElement): string => {
    let textContent = element.textContent || '';

    // Truncate preview
    if (textContent.length > 100) {
      textContent = textContent.substring(0, 100) + '...';
    }

    return textContent.trim();
  };

  /**
   * getElementAttributes
   */
  const getElementAttributes = (element: HTMLElement): Record<string, string> => {
    const attributes: Record<string, string> = {};
    const elementAttributes = Array.from(element.attributes);

    elementAttributes.forEach(attr => {
      // Strip mapping + selection attrs
      if (!isSourceMappingAttribute(attr.name) &&
        !attr.name.startsWith('data-selection-')) {
        attributes[attr.name] = attr.value;
      }
    });

    return attributes;
  };

  /**
   * getElementDomPath
   */
  const getElementDomPath = (element: HTMLElement): string => {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== container) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className) {
        const classes = Array.from(current.classList).slice(0, 3);
        selector += `.${classes.join('.')}`;
      }

      // nth-of-type disambiguation
      const siblings = Array.from(current.parentNode?.children || []);
      const sameTagSiblings = siblings.filter(sibling =>
        sibling.tagName === current!.tagName
      );

      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current);
        selector += `:nth-of-type(${index + 1})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  };

  /**
   * addSelectionListener
   */
  const addSelectionListener = (listener: (element: HTMLElement | null) => void) => {
    selectionListeners.add(listener);
    return () => selectionListeners.delete(listener);
  };

  /**
   * Initialize event listeners
   */
  const initializeEventListeners = () => {
    if (!config.enableSelection) return;

    container.addEventListener('click', handleClick, true);
    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('mouseup', handleMouseUp, true);

    if (config.enableHover) {
      container.addEventListener('mouseenter', handleMouseEnter, true);
      container.addEventListener('mouseleave', handleMouseLeave, true);
    }

    // Keyboard shortcuts when selection enabled
    if (config.enableSelection) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
    }
  };

  /**
   * destroy
   */
  const destroy = () => {
    clearSelection();

    container.removeEventListener('click', handleClick, true);
    container.removeEventListener('mousedown', handleMouseDown, true);
    container.removeEventListener('mouseup', handleMouseUp, true);
    container.removeEventListener('mouseenter', handleMouseEnter, true);
    container.removeEventListener('mouseleave', handleMouseLeave, true);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    selectionListeners.clear();
  };

  onMounted(() => {
    initializeEventListeners();
  });

  onBeforeUnmount(() => {
    destroy();
  });

  return {
    selectedElement,
    hoverElement,
    isSelecting,
    selectElement,
    clearSelection,
    extractElementInfo,
    addSelectionListener,
    getSelectedElement: () => selectedElement.value,
    getHoverElement: () => hoverElement.value,
  };
}
