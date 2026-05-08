import { hasSourceMapping } from '@xagi/design-mode-shared/sourceInfo';

export class ObserverManager {
  private observer: MutationObserver | null = null;

  constructor(
    private onEdit: (target: HTMLElement, type: 'content' | 'style') => void,
    private onNodeAdded: (node: HTMLElement) => void
  ) {}

  public enable() {
    if (this.observer) return;

    this.observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        // Check if the mutation should be ignored
        const targetNode = mutation.target;
        const targetElement = targetNode.nodeType === Node.ELEMENT_NODE
          ? targetNode as HTMLElement
          : targetNode.parentElement;

        if (targetElement && targetElement.hasAttribute('data-ignore-mutation')) {
          return;
        }

        if (mutation.type === 'childList') {
          // Handle element addition
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.onNodeAdded(node as HTMLElement);
            }
          });
        } else if (mutation.type === 'characterData') {
          // Handle text content change
          const target = mutation.target.parentElement as HTMLElement;
          if (target && hasSourceMapping(target)) {
            if (target.hasAttribute('data-ignore-mutation')) {
              return;
            }
            this.onEdit(target, 'content');
          }
        } else if (mutation.type === 'attributes') {
          // Handle attribute change (style, class)
          const target = mutation.target as HTMLElement;
          if (target && hasSourceMapping(target)) {
            const attributeName = mutation.attributeName;
            const newValue = target.getAttribute(attributeName!);
            const oldValue = mutation.oldValue;

            if (newValue === oldValue) {
              return;
            }

            if (attributeName === 'class') {
              this.onEdit(target, 'style');
            } else if (attributeName?.startsWith('style')) {
              this.onEdit(target, 'style');
            }
          }
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'style'],
    });
  }

  public disable() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
