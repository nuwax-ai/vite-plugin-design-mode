import { ref, onMounted, onBeforeUnmount } from 'vue';
import { hasSourceMapping } from '@xagi/design-mode-shared/sourceInfo';

/**
 * Vue3 composable for MutationObserver management
 * Watches DOM changes and triggers callbacks for content/style edits
 */
export function useObserverManager(
  onEdit: (target: HTMLElement, type: 'content' | 'style') => void,
  onNodeAdded: (node: HTMLElement) => void
) {
  const observer = ref<MutationObserver | null>(null);
  const isEnabled = ref(false);

  const enable = () => {
    if (observer.value) return;

    observer.value = new MutationObserver(mutations => {
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
              onNodeAdded(node as HTMLElement);
            }
          });
        } else if (mutation.type === 'characterData') {
          // Handle text content change
          const target = mutation.target.parentElement as HTMLElement;
          if (target && hasSourceMapping(target)) {
            if (target.hasAttribute('data-ignore-mutation')) {
              return;
            }
            onEdit(target, 'content');
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
              onEdit(target, 'style');
            } else if (attributeName?.startsWith('style')) {
              onEdit(target, 'style');
            }
          }
        }
      });
    });

    observer.value.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'style'],
    });

    isEnabled.value = true;
  };

  const disable = () => {
    if (observer.value) {
      observer.value.disconnect();
      observer.value = null;
      isEnabled.value = false;
    }
  };

  onBeforeUnmount(() => {
    disable();
  });

  return {
    observer,
    isEnabled,
    enable,
    disable,
  };
}
