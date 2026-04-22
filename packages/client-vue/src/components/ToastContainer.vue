<script setup lang="ts">
import { useToast } from '../composables/useToast';
import Toast from './Toast.vue';

const { toasts, remove } = useToast();
</script>

<template>
  <div
    style="
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    "
  >
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      :duration="toast.duration"
      @close="remove(toast.id)"
    />
  </div>
</template>
