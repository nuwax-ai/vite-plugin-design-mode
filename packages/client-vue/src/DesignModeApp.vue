<script setup lang="ts">
import { onMounted, onUnmounted, watch, unref } from 'vue';
import { createDesignMode } from './composables/useDesignMode';
import { AttributeNames } from '@xagi/design-mode-shared/attributeNames';

// Create and provide design mode context
const designMode = createDesignMode();

// Global event handlers
const handleClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('#__vite_plugin_design_mode__')) return;
  if ((e.target as HTMLElement).closest(`[${AttributeNames.contextMenu}="true"]`)) return;

  if (
    (e.target as HTMLElement).closest(`[${AttributeNames.staticContent}="true"]`) ||
    (e.target as HTMLElement).closest(`[${AttributeNames.staticClass}="true"]`)
  ) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    designMode.selectElement(target);
  }
};

const handleMouseOver = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('#__vite_plugin_design_mode__')) return;
  if ((e.target as HTMLElement).closest(`[${AttributeNames.contextMenu}="true"]`)) return;

  if (
    (e.target as HTMLElement).hasAttribute(AttributeNames.staticContent) ||
    (e.target as HTMLElement).hasAttribute(AttributeNames.staticClass)
  ) {
    const target = e.target as HTMLElement;
    target.setAttribute('data-design-hover', 'true');
    designMode.setHoveredElement(target);
  }
};

const handleMouseOut = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.hasAttribute(AttributeNames.contextMenuHover)) {
    target.removeAttribute('data-design-hover');
  }
  designMode.setHoveredElement(null);
};

// Watch design mode state（API 上为 ComputedRef，需 unref 才能拿到布尔值）
watch(
  () => unref(designMode.isDesignMode),
  isDesignMode => {
    if (!isDesignMode) {
      document.querySelectorAll('[data-design-selected]').forEach(el => {
        el.removeAttribute('data-design-selected');
      });
    }
  }
);

// Watch selected element
watch(
  () => unref(designMode.selectedElement),
  (selectedElement, oldElement) => {
    if (oldElement) {
      oldElement.removeAttribute('data-design-selected');
    }
    if (selectedElement) {
      selectedElement.setAttribute('data-design-selected', 'true');
    }
  }
);

// Lifecycle hooks
onMounted(() => {
  if (!unref(designMode.isDesignMode)) return;

  document.addEventListener('click', handleClick, true);
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);

  // Inject global styles
  const styleId = 'appdev-design-mode-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      [data-design-hover="true"] {
        outline: 2px dashed #60a5fa !important;
        outline-offset: 2px;
        cursor: pointer;
      }
      [data-design-selected="true"] {
        outline: 2px solid #2563eb !important;
        outline-offset: 2px;
      }
      [contenteditable="true"] {
        outline: 2px solid #22c55e !important;
        cursor: text;
        background-color: rgba(34, 197, 94, 0.1);
      }
    `;
    document.head.appendChild(style);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);

  const style = document.getElementById('appdev-design-mode-styles');
  if (style) {
    style.remove();
  }

  document.querySelectorAll('[data-design-hover]').forEach(el => {
    el.removeAttribute('data-design-hover');
  });
});

// Re-setup listeners when design mode changes
watch(
  () => unref(designMode.isDesignMode),
  isDesignMode => {
    if (isDesignMode) {
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mouseover', handleMouseOver);
      document.addEventListener('mouseout', handleMouseOut);

      const styleId = 'appdev-design-mode-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
        [data-design-hover="true"] {
          outline: 2px dashed #60a5fa !important;
          outline-offset: 2px;
          cursor: pointer;
        }
        [data-design-selected="true"] {
          outline: 2px solid #2563eb !important;
          outline-offset: 2px;
        }
        [contenteditable="true"] {
          outline: 2px solid #22c55e !important;
          cursor: text;
          background-color: rgba(34, 197, 94, 0.1);
        }
      `;
        document.head.appendChild(style);
      }
    } else {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);

      document.querySelectorAll('[data-design-hover]').forEach(el => {
        el.removeAttribute('data-design-hover');
      });
    }
  }
);
</script>

<!--
  与 @xagi/design-mode-client-react 注入入口对齐：React 端仅挂载 DesignModeProvider + DesignModeManager，
  DesignModeManager 返回 null，不在 iframe 内渲染「Design Mode」开关/编辑面板。
  设计模式开关与样式编辑由父应用（XAGI shell 等）通过 TOGGLE_DESIGN_MODE / 后续消息驱动。
  若宿主需要本地面板，可从包内导出自行挂载 DesignModeUI.vue / ToastContainer.vue。
-->
<template></template>
