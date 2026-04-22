<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDesignMode } from '../composables/useDesignMode';

const designMode = useDesignMode();

// Tailwind Presets
const TAILWIND_PRESETS = {
  bgColors: [
    { label: 'White', value: 'bg-white', color: '#ffffff' },
    { label: 'Slate 50', value: 'bg-slate-50', color: '#f8fafc' },
    { label: 'Blue 50', value: 'bg-blue-50', color: '#eff6ff' },
    { label: 'Blue 100', value: 'bg-blue-100', color: '#dbeafe' },
    { label: 'Blue 600', value: 'bg-blue-600', color: '#2563eb' },
    { label: 'Red 50', value: 'bg-red-50', color: '#fef2f2' },
    { label: 'Green 50', value: 'bg-green-50', color: '#f0fdf4' },
  ],
  textColors: [
    { label: 'Slate 900', value: 'text-slate-900', color: '#0f172a' },
    { label: 'Slate 600', value: 'text-slate-600', color: '#475569' },
    { label: 'Blue 600', value: 'text-blue-600', color: '#2563eb' },
    { label: 'White', value: 'text-white', color: '#000' },
    { label: 'Red 600', value: 'text-red-600', color: '#dc2626' },
  ],
  paddings: [
    { label: '0', value: 'p-0' },
    { label: '2', value: 'p-2' },
    { label: '4', value: 'p-4' },
    { label: '6', value: 'p-6' },
    { label: '8', value: 'p-8' },
    { label: '12', value: 'p-12' },
  ],
  rounded: [
    { label: 'None', value: 'rounded-none' },
    { label: 'Small', value: 'rounded-sm' },
    { label: 'Medium', value: 'rounded-md' },
    { label: 'Large', value: 'rounded-lg' },
    { label: 'Full', value: 'rounded-full' },
  ],
};

const currentClasses = ref('');

watch(() => designMode.selectedElement, (element) => {
  if (element) {
    currentClasses.value = element.className;
  } else {
    currentClasses.value = '';
  }
});

const modifyClass = async (newClass: string) => {
  if (!designMode.selectedElement) return;
  await designMode.modifyElementClass(designMode.selectedElement, newClass);
  currentClasses.value = designMode.selectedElement.className;
};

const hasClass = (className: string) => {
  return currentClasses.value.includes(className);
};

const getElementTag = computed(() => {
  if (!designMode.selectedElement) return '';
  const el = designMode.selectedElement;
  return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');
});
</script>

<template>
  <div
    style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
    "
  >
    <!-- Main Toggle -->
    <div
      style="
        pointer-events: auto;
        background-color: white;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 10px;
      "
    >
      <label style="font-size: 14px; font-weight: 500; color: #1e293b">
        Design Mode
      </label>
      <button
        @click="designMode.toggleDesignMode"
        :style="{
          width: '40px',
          height: '24px',
          borderRadius: '12px',
          backgroundColor: designMode.isDesignMode ? '#2563eb' : '#e2e8f0',
          border: 'none',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }"
      >
        <span
          :style="{
            position: 'absolute',
            top: '2px',
            left: designMode.isDesignMode ? '18px' : '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'left 0.2s',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
          }"
        />
      </button>
    </div>

    <!-- Edit Panel -->
    <div
      v-if="designMode.isDesignMode && designMode.selectedElement"
      style="
        pointer-events: auto;
        background-color: white;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        width: 320px;
        max-height: 80vh;
        overflow-y: auto;
      "
    >
      <div
        style="
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0f172a">
          Edit Element
        </h3>
        <code
          style="
            font-size: 12px;
            background-color: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            color: #64748b;
          "
        >
          {{ getElementTag }}
        </code>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px">
        <!-- Background -->
        <div>
          <label
            style="
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: #64748b;
              margin-bottom: 8px;
            "
          >
            Background
          </label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px">
            <button
              v-for="preset in TAILWIND_PRESETS.bgColors"
              :key="preset.value"
              @click="modifyClass(preset.value)"
              :title="preset.label"
              :style="{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                backgroundColor: preset.color,
                boxShadow: hasClass(preset.value) ? '0 0 0 2px #3b82f6' : 'none',
              }"
            />
          </div>
        </div>

        <!-- Text Color -->
        <div>
          <label
            style="
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: #64748b;
              margin-bottom: 8px;
            "
          >
            Text Color
          </label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px">
            <button
              v-for="preset in TAILWIND_PRESETS.textColors"
              :key="preset.value"
              @click="modifyClass(preset.value)"
              :title="preset.label"
              :style="{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '12px',
                backgroundColor: '#f8fafc',
                color: preset.color,
                boxShadow: hasClass(preset.value) ? '0 0 0 2px #3b82f6' : 'none',
              }"
            >
              A
            </button>
          </div>
        </div>

        <!-- Padding -->
        <div>
          <label
            style="
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: #64748b;
              margin-bottom: 8px;
            "
          >
            Padding
          </label>
          <div style="display: flex; flex-wrap: wrap; gap: 4px">
            <button
              v-for="preset in TAILWIND_PRESETS.paddings"
              :key="preset.value"
              @click="modifyClass(preset.value)"
              :style="{
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                backgroundColor: hasClass(preset.value) ? '#eff6ff' : 'white',
                color: hasClass(preset.value) ? '#1d4ed8' : '#64748b',
                borderColor: hasClass(preset.value) ? '#93c5fd' : '#e2e8f0',
              }"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <!-- Rounded -->
        <div>
          <label
            style="
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: #64748b;
              margin-bottom: 8px;
            "
          >
            Rounded
          </label>
          <div style="display: flex; flex-wrap: wrap; gap: 4px">
            <button
              v-for="preset in TAILWIND_PRESETS.rounded"
              :key="preset.value"
              @click="modifyClass(preset.value)"
              :style="{
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                backgroundColor: hasClass(preset.value) ? '#eff6ff' : 'white',
                color: hasClass(preset.value) ? '#1d4ed8' : '#64748b',
                borderColor: hasClass(preset.value) ? '#93c5fd' : '#e2e8f0',
              }"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div style="padding-top: 12px; border-top: 1px solid #f1f5f9">
          <button
            @click="designMode.resetModifications"
            style="
              width: 100%;
              padding: 8px;
              font-size: 12px;
              font-weight: 500;
              color: #dc2626;
              background-color: #fef2f2;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            "
          >
            Reset All Modifications
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
