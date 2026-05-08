<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
});

const emit = defineEmits<{
  close: [];
}>();

const isVisible = ref(true);
const isAnimatingOut = ref(false);

const getBorderColor = () => {
  switch (props.type) {
    case 'error':
      return '#ef4444';
    case 'success':
      return '#22c55e';
    case 'info':
      return '#3b82f6';
    default:
      return '#3b82f6';
  }
};

onMounted(() => {
  setTimeout(() => {
    isAnimatingOut.value = true;
    setTimeout(() => {
      isVisible.value = false;
      emit('close');
    }, 300);
  }, props.duration);
});
</script>

<template>
  <div
    v-if="isVisible"
    :class="['design-mode-toast', type, { 'animating-out': isAnimatingOut }]"
    :style="{
      background: 'white',
      color: '#333',
      padding: '10px 20px',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      border: '1px solid #eee',
      borderLeft: `4px solid ${getBorderColor()}`,
      minWidth: '200px',
      maxWidth: '400px',
    }"
  >
    {{ message }}
  </div>
</template>

<style scoped>
.design-mode-toast {
  animation: toast-in 0.3s ease-out forwards;
}

.design-mode-toast.animating-out {
  animation: toast-out 0.3s ease-in forwards;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}
</style>
