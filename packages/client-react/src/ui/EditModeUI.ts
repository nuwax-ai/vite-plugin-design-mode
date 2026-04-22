export interface EditOptions {
  element: HTMLElement;
  initialValue: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
}

/**
 * Enter edit mode for the given element
 */
export function enterEditMode(options: EditOptions): HTMLTextAreaElement {
  const { element, initialValue, onSave, onCancel } = options;

  const textArea = document.createElement('textarea');

  // Set textarea styles to match element
  textArea.value = initialValue;
  textArea.style.position = 'absolute';
  textArea.style.zIndex = '9999';
  textArea.style.width = element.offsetWidth + 'px';
  textArea.style.height = element.offsetHeight + 'px';

  const computedStyle = window.getComputedStyle(element);
  textArea.style.fontSize = computedStyle.fontSize;
  textArea.style.fontFamily = computedStyle.fontFamily;
  textArea.style.color = computedStyle.color;
  textArea.style.lineHeight = computedStyle.lineHeight;
  textArea.style.letterSpacing = computedStyle.letterSpacing;
  textArea.style.textAlign = computedStyle.textAlign;

  textArea.style.background = 'rgba(255, 255, 255, 0.9)';
  textArea.style.border = '2px solid #007acc';
  textArea.style.padding = '4px';
  textArea.style.margin = '0';
  textArea.style.resize = 'none';
  textArea.style.outline = 'none';

  // Get element bounding rect
  const rect = element.getBoundingClientRect();
  textArea.style.left = rect.left + 'px';
  textArea.style.top = rect.top + 'px';

  // Add to page
  document.body.appendChild(textArea);
  textArea.focus();

  // Handle save and cancel
  const handleSave = () => {
    onSave(textArea.value);
  };

  const handleCancel = () => {
    onCancel();
  };

  // Event listeners
  textArea.addEventListener('blur', handleSave);
  textArea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  });

  return textArea;
}

/**
 * Exit edit mode
 */
export function exitEditMode(editor: HTMLElement) {
  if (editor.parentNode) {
    editor.parentNode.removeChild(editor);
  }
}
