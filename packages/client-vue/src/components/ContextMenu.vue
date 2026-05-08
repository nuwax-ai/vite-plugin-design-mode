<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { AttributeNames } from '@xagi/design-mode-shared/attributeNames';

export interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

interface Props {
  element: HTMLElement;
  x: number;
  y: number;
  menuItems: MenuItem[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref({
  left: `${props.x}px`,
  top: `${props.y}px`,
});

// Track mouse position for hover restoration
let lastMouseX = 0;
let lastMouseY = 0;

const trackMouse = (e: MouseEvent) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
};

const handleClickOutside = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
};

const handleContextMenu = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close');
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close');
  }
};

const handleScroll = () => {
  emit('close');
};

const handleMenuItemClick = (item: MenuItem) => {
  if (item.disabled) return;
  item.action();
  emit('close');
};

onMounted(() => {
  // Adjust position to stay within viewport
  if (menuRef.value) {
    const rect = menuRef.value.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      menuStyle.value.left = `${viewportWidth - rect.width - 10}px`;
    }
    if (rect.bottom > viewportHeight) {
      menuStyle.value.top = `${viewportHeight - rect.height - 10}px`;
    }
  }

  // Setup event listeners with slight delay
  setTimeout(() => {
    document.addEventListener('mousemove', trackMouse);
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll, true);
  }, 0);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', trackMouse);
  document.removeEventListener('click', handleClickOutside, true);
  document.removeEventListener('contextmenu', handleContextMenu, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('resize', handleScroll, true);

  // Restore hover state
  const hadHoverState = props.element.hasAttribute(AttributeNames.contextMenuHover);
  if (hadHoverState) {
    props.element.removeAttribute(AttributeNames.contextMenuHover);

    setTimeout(() => {
      const rect = props.element.getBoundingClientRect();
      const isMouseOver =
        lastMouseX >= rect.left &&
        lastMouseX <= rect.right &&
        lastMouseY >= rect.top &&
        lastMouseY <= rect.bottom;

      if (!isMouseOver) {
        props.element.removeAttribute('data-design-hover');
      } else {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: lastMouseX,
          clientY: lastMouseY,
        });
        props.element.dispatchEvent(mouseEnterEvent);
      }
    }, 10);
  }
});
</script>

<template>
  <div
    ref="menuRef"
    :data-xagi-context-menu="true"
    :style="{
      position: 'fixed',
      left: menuStyle.left,
      top: menuStyle.top,
      background: 'white',
      border: '0.5px solid #ccc',
      borderRadius: '6px',
      padding: '0',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      zIndex: '10000',
      minWidth: '150px',
      fontSize: '14px',
    }"
  >
    <template v-for="(item, index) in menuItems" :key="index">
      <!-- Separator -->
      <div
        v-if="item.label === '---' || item.disabled"
        style="height: 1px; background: #e5e7eb; margin: 0; padding: 0"
      />
      <!-- Menu Item -->
      <div
        v-else
        @click="handleMenuItemClick(item)"
        @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = '#f0f0f0'"
        @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'"
        :style="{
          padding: '8px 16px',
          borderRadius: '4px',
          margin: '0',
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          color: item.disabled ? '#999' : '#333',
          background: 'transparent',
        }"
      >
        {{ item.label }}
      </div>
    </template>
  </div>
</template>
