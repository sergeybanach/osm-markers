<template>
  <div v-if="visible" class="image-modal" @click="closeModal">
    <div class="image-modal-content" @click.stop>
      <img :src="imageUrl" alt="Предпросмотр" class="modal-image" />
      <button class="close-modal-btn" @click="closeModal">Закрыть</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

const closeModal = () => {
  emit('close')
}
</script>

<style scoped>
.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-modal-content {
  position: relative;
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.close-modal-btn {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.close-modal-btn:hover {
  background-color: #c82333;
}

@media (max-width: 768px) {
  .image-modal-content {
    padding: 10px;
  }

  .close-modal-btn {
    font-size: 14px;
    padding: 6px 12px;
  }
}
</style>