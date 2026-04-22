import { ref } from 'vue';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}

const toasts = ref<ToastItem[]>([]);

export function useToast() {
  const show = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const toast: ToastItem = { id, message, type, duration };
    toasts.value.push(toast);

    setTimeout(() => {
      remove(id);
    }, duration + 300); // Add animation time
  };

  const remove = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  const error = (message: string, duration = 4000) => {
    show(message, 'error', duration);
  };

  const success = (message: string, duration = 3000) => {
    show(message, 'success', duration);
  };

  const info = (message: string, duration = 3000) => {
    show(message, 'info', duration);
  };

  return {
    toasts,
    show,
    remove,
    error,
    success,
    info,
  };
}
