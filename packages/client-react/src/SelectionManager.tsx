import React, { useEffect, useCallback, useRef } from 'react';
import { useDesignMode } from './DesignModeContext';
import { ElementInfo, SourceInfo } from '@xagi/design-mode-shared/messages';
import { AttributeNames, isSourceMappingAttribute } from '@xagi/design-mode-shared/attributeNames';
import { isPureStaticText } from '@xagi/design-mode-shared/elementUtils';
import { extractSourceInfo as extractSourceInfoFromAttributes } from '@xagi/design-mode-shared/sourceInfo';

/**
 * Click/hover selection for mapped elements; emits to listeners / iframe.
 */
export class SelectionManager {
  private selectedElement: HTMLElement | null = null;
  private selectionListeners: Set<(element: HTMLElement | null) => void> = new Set();
  private hoverElement: HTMLElement | null = null;
  private isSelecting = false;
  private selectionStartTime = 0;
  private preventNextClick = false;

  constructor(
    private container: HTMLElement,
    private config: {
      enableSelection: boolean;
      enableHover: boolean;
      selectionDelay: number;
      excludeSelectors: string[];
      includeOnlyElements: boolean;
    } = {
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
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    if (!this.config.enableSelection) return;

    this.container.addEventListener('click', this.handleClick.bind(this), true);
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
    this.container.addEventListener('mouseup', this.handleMouseUp.bind(this), true);

    if (this.config.enableHover) {
      this.container.addEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
      this.container.addEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
    }

    // Keyboard shortcuts when selection enabled
    if (this.config.enableSelection) {
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
      document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
  }

  /**
   * Click handler
   */
  private handleClick(event: MouseEvent) {
    if (!this.config.enableSelection) return;
    if (this.preventNextClick) {
      event.preventDefault();
      event.stopPropagation();
      this.preventNextClick = false;
      return;
    }

    const target = event.target as HTMLElement;
    if (!this.isValidElement(target)) return;

    // Optional selectionDelay
    if (this.config.selectionDelay > 0) {
      setTimeout(() => {
        this.selectElement(target);
      }, this.config.selectionDelay);
    } else {
      this.selectElement(target);
    }
  }

  /**
   * mousedown
   */
  private handleMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!this.isValidElement(target)) return;

    this.isSelecting = true;
    this.selectionStartTime = Date.now();
    this.preventNextClick = false;
  }

  /**
   * mouseup
   */
  private handleMouseUp(event: MouseEvent) {
    if (!this.isSelecting) return;

    const target = event.target as HTMLElement;
    const duration = Date.now() - this.selectionStartTime;

    // Long-press (>500ms) suppresses click selection
    if (duration > 500) {
      this.preventNextClick = true;
    }

    this.isSelecting = false;
  }

  /**
   * mouseenter
   */
  private handleMouseEnter(event: MouseEvent) {
    if (!this.config.enableHover) return;

    const target = event.target as HTMLElement;
    if (!this.isValidElement(target)) return;

    this.hoverElement = target;
    this.onHoverElement(target);
  }

  /**
   * mouseleave
   */
  private handleMouseLeave(event: MouseEvent) {
    if (!this.config.enableHover) return;

    const target = event.target as HTMLElement;
    if (this.hoverElement === target) {
      this.hoverElement = null;
      this.onHoverElement(null);
    }
  }

  /**
   * keydown
   */
  private handleKeyDown(event: KeyboardEvent) {
    // Esc clears selection
    if (event.key === 'Escape') {
      this.clearSelection();
    }

    // Ctrl/Cmd+A: select first match
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      this.selectAll();
    }

    // Ctrl/Cmd+D: clear
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      this.clearSelection();
    }
  }

  /**
   * keyup
   */
  private handleKeyUp(event: KeyboardEvent) {
    // noop
  }

  /**
   * Whether element may be selected (mapped + static-content or static-class)
   */
  private isValidElement(element: HTMLElement): boolean {
    if (!element || !element.tagName) return false;

    // Exclude context menu
    if (element.closest(`[${AttributeNames.contextMenu}="true"]`)) return false;

    // Exclusion list
    for (const selector of this.config.excludeSelectors) {
      if (element.matches(selector) || element.closest(selector)) {
        return false;
      }
    }

    // Optional tag whitelist
    if (this.config.includeOnlyElements) {
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

    console.log('hasStaticContent', element, hasStaticContent);
    console.log('hasStaticClass', element, hasStaticClass);

    if (!hasStaticContent && !hasStaticClass) {
      // Dynamic content/style — skip
      return false;
    }

    return true;
  }

  /**
   * Apply selection highlight
   */
  private selectElement(element: HTMLElement) {
    if (this.selectedElement === element) return;

    // Clear previous outline
    if (this.selectedElement) {
      this.clearElementHighlighting(this.selectedElement);
    }

    this.selectedElement = element;

    // Highlight new node
    this.highlightElement(element);

    // Notify subscribers
    this.selectionListeners.forEach(listener => listener(element));
  }

  /**
   * clearSelection
   */
  public clearSelection() {
    if (this.selectedElement) {
      this.clearElementHighlighting(this.selectedElement);
      this.selectedElement = null;
      this.selectionListeners.forEach(listener => listener(null));
    }
  }

  /**
   * highlightElement
   */
  private highlightElement(element: HTMLElement) {
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
  }

  /**
   * clearElementHighlighting
   */
  private clearElementHighlighting(element: HTMLElement) {
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
  }

  /**
   * onHoverElement
   */
  private onHoverElement(element: HTMLElement | null) {
    // Hook for hover UX
  }

  /**
   * selectAll (first candidate only)
   */
  private selectAll() {
    const selectableElements = Array.from(
      this.container.querySelectorAll('*')
    ).filter(el => this.isValidElement(el as HTMLElement));

    // Future: multi-select
    if (selectableElements.length > 0) {
      this.selectElement(selectableElements[0] as HTMLElement);
    }
  }

  /**
   * addSelectionListener
   */
  public addSelectionListener(listener: (element: HTMLElement | null) => void) {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  /**
   * getSelectedElement
   */
  public getSelectedElement(): HTMLElement | null {
    return this.selectedElement;
  }

  /**
   * getHoverElement
   */
  public getHoverElement(): HTMLElement | null {
    return this.hoverElement;
  }

  /**
   * extractSourceInfo
   */
  private extractSourceInfo(element: HTMLElement): SourceInfo | null {
    return extractSourceInfoFromAttributes(element);
  }

  /**
   * Walk up for library component root
   */
  private findComponentRoot(element: HTMLElement): HTMLElement {
    const sourceInfo = this.extractSourceInfo(element);
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
      const parentSourceInfo = this.extractSourceInfo(parent);

      // Boundary: different file or no mapping
      if (!parentSourceInfo || parentSourceInfo.fileName !== sourceInfo.fileName) {
        componentRoot = current;
        break;
      }

      current = parent;
    }

    return componentRoot;
  }

  /**
   * extractElementInfo
   */
  public extractElementInfo(element: HTMLElement): ElementInfo | null {
    if (!element) return null;

    // Prefer library root
    const targetElement = this.findComponentRoot(element);
    const sourceInfo = this.extractSourceInfo(targetElement);

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
      textContent = this.getElementTextContent(targetElement);
    } else {
      textContent = targetElement.innerText || targetElement.textContent || '';
    }

    // Ancestor chain with mappings
    const hierarchy: { tagName: string; componentName?: string; fileName?: string }[] = [];
    let current: HTMLElement | null = targetElement;
    while (current && current !== document.body) {
      const info = this.extractSourceInfo(current);
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
    const props = this.getElementAttributes(targetElement);

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
  }

  /**
   * getElementTextContent
   */
  private getElementTextContent(element: HTMLElement): string {

    let textContent = element.textContent || '';

    // Truncate preview
    if (textContent.length > 100) {
      textContent = textContent.substring(0, 100) + '...';
    }

    return textContent.trim();
  }

  /**
   * getElementAttributes
   */
  private getElementAttributes(element: HTMLElement): Record<string, string> {
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
  }

  /**
   * getElementDomPath
   */
  private getElementDomPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== this.container) {
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
  }

  /**
   * destroy
   */
  public destroy() {

    this.clearSelection();


    this.container.removeEventListener('click', this.handleClick.bind(this), true);
    this.container.removeEventListener('mousedown', this.handleMouseDown.bind(this), true);
    this.container.removeEventListener('mouseup', this.handleMouseUp.bind(this), true);
    this.container.removeEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
    this.container.removeEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));


    this.selectionListeners.clear();
  }
}

/**
 * SelectionManager React Hook
 */
export const useSelectionManager = (config?: {
  enableSelection?: boolean;
  enableHover?: boolean;
  selectionDelay?: number;
  excludeSelectors?: string[];
  includeOnlyElements?: boolean;
}) => {
  const selectionManagerRef = useRef<SelectionManager | null>(null);
  const { selectElement, config: designModeConfig } = useDesignMode();

  useEffect(() => {
    const container = document.body;
    selectionManagerRef.current = new SelectionManager(container, {
      enableSelection: designModeConfig.iframeMode?.enableSelection ?? true,
      enableHover: true,
      selectionDelay: 0,
      excludeSelectors: [
        'script', 'style', 'meta', 'link', 'head', 'title', 'html', 'body',
        '[data-selection-exclude="true"]', '.no-selection'
      ],
      includeOnlyElements: false,
      ...config
    });

    // Bridge to React context
    const unsubscribe = selectionManagerRef.current.addSelectionListener((element) => {
      if (element && designModeConfig.iframeMode?.enabled) {
        // extractElementInfo + selectElement
        const elementInfo = selectionManagerRef.current?.extractElementInfo(element);
        if (elementInfo) {
          selectElement(element);
        }
      } else if (!element) {
        selectElement(null);
      }
    });

    return () => {
      unsubscribe();
      selectionManagerRef.current?.destroy();
      selectionManagerRef.current = null;
    };
  }, [selectElement, designModeConfig]);

  return {
    selectionManager: selectionManagerRef.current
  };
};

export default SelectionManager;
