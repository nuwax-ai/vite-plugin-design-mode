import { extractSourceInfo } from '../utils/sourceInfo';
import { isPureStaticText } from '../utils/elementUtils';
import { AttributeNames } from '../utils/attributeNames';

export interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

/**
 * Create and show a context menu at the specified position
 */
export function showContextMenu(
  element: HTMLElement,
  x: number,
  y: number,
  menuItems: MenuItem[]
): HTMLElement {
  // Remove existing menu
  const existingMenu = document.querySelector(`[${AttributeNames.contextMenu}="true"]`) as HTMLElement;
  if (existingMenu) {
    document.body.removeChild(existingMenu);
  }

  // Preserve hover when context menu opened from a hovered static node
  const hadHoverState = element.hasAttribute(AttributeNames.contextMenuHover);

  // Create context menu
  const menu = document.createElement('div');
  menu.setAttribute(AttributeNames.contextMenu, 'true');
  menu.style.position = 'fixed';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.background = 'white';
  menu.style.border = '0.5px solid #ccc';
  menu.style.borderRadius = '6px';
  menu.style.padding = '0';
  menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  menu.style.zIndex = '10000';
  menu.style.minWidth = '150px';
  menu.style.fontSize = '14px';

  // Create menu items
  menuItems.forEach(item => {
    // Separator row
    if (item.label === '---' || item.disabled) {
      const separator = document.createElement('div');
      separator.style.height = '1px';
      separator.style.background = '#e5e7eb';
      separator.style.margin = '0';
      separator.style.padding = '0';
      menu.appendChild(separator);
      return;
    }

    const menuItem = document.createElement('div');
    menuItem.textContent = item.label;
    menuItem.style.padding = '8px 16px';
    menuItem.style.borderRadius = '4px';
    menuItem.style.margin = '0';

    if (item.disabled) {
      menuItem.style.color = '#999';
      menuItem.style.cursor = 'not-allowed';
    } else {
      menuItem.style.cursor = 'pointer';
      menuItem.style.color = '#333';
    }

    menuItem.style.background = 'transparent';

    menuItem.addEventListener('mouseenter', () => {
      if (!item.disabled) {
        menuItem.style.background = '#f0f0f0';
      }
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.background = 'transparent';
    });

    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (item.disabled) return;
      item.action();
      closeContextMenu(menu);
    });

    menu.appendChild(menuItem);
  });

  // Add to page
  document.body.appendChild(menu);

  // Ensure menu stays within viewport
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (rect.right > viewportWidth) {
    menu.style.left = (viewportWidth - rect.width - 10) + 'px';
  }
  if (rect.bottom > viewportHeight) {
    menu.style.top = (viewportHeight - rect.height - 10) + 'px';
  }

  // Setup close handlers
  setupContextMenuCloseHandlers(menu, element, hadHoverState);

  return menu;
}

/**
 * Close the context menu
 */
export function closeContextMenu(menu: HTMLElement) {
  // Execute cleanup function
  if ((menu as any).__cleanupHandlers) {
    (menu as any).__cleanupHandlers();
    delete (menu as any).__cleanupHandlers;
  }

  // Restore hover outline after menu closes
  const targetElement = (menu as any).__targetElement as HTMLElement | null;
  const hadHoverState = (menu as any).__hadHoverState as boolean;

  // Remove menu element
  if (menu.parentNode) {
    menu.parentNode.removeChild(menu);
  }

  if (targetElement && hadHoverState) {
    targetElement.removeAttribute(AttributeNames.contextMenuHover);

    setTimeout(() => {
      const mouseX = (window as any).__lastMouseX || 0;
      const mouseY = (window as any).__lastMouseY || 0;
      const rect = targetElement.getBoundingClientRect();
      const isMouseOver = 
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom;

      if (!isMouseOver) {
        targetElement.removeAttribute('data-design-hover');
      } else {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: mouseX,
          clientY: mouseY
        });
        targetElement.dispatchEvent(mouseEnterEvent);
      }
    }, 10);
  }
}

/**
 * Setup context menu close handlers (clickoutside and ESC key)
 */
function setupContextMenuCloseHandlers(
  menu: HTMLElement,
  targetElement: HTMLElement,
  hadHoverState: boolean
) {
  (menu as any).__targetElement = targetElement;
  (menu as any).__hadHoverState = hadHoverState;

  const trackMouse = (e: MouseEvent) => {
    (window as any).__lastMouseX = e.clientX;
    (window as any).__lastMouseY = e.clientY;
  };
  document.addEventListener('mousemove', trackMouse);

  const closeMenu = () => {
    document.removeEventListener('mousemove', trackMouse);
    closeContextMenu(menu);
  };

  // Click outside to close
  const handleClickOutside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      // Prevent event from bubbling to avoid deselecting element
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  };

  // Right-click outside to close
  const handleContextMenu = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      closeMenu();
    }
  };

  // ESC key to close
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  };

  // Scroll to close
  const handleScroll = () => {
    closeMenu();
  };

  // Add listeners with slight delay to avoid immediate triggering
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll, true);
  }, 0);

  // Store cleanup function
  (menu as any).__cleanupHandlers = () => {
    document.removeEventListener('click', handleClickOutside, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', handleScroll, true);
  };
}
