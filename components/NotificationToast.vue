<template>
  <div v-if="visible" class="notification">
    {{ message }}
  </div>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.notification {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  z-index: 1000;
  font-size: 14px;
  max-width: 80%;
  text-align: center;
  animation: fadeInOut 2s ease-in-out;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  10%, 90% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}

@media (max-width: 768px) {
  .notification {
    font-size: 12px;
    padding: 8px 16px;
    max-width: 90%;
    text-align: center;
  }
}
</style>