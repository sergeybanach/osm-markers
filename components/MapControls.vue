<template>
  <div>
    <!-- Add Marker Button -->
    <button 
      class="add-marker-btn" 
      :class="{ active: isAddingMarker }" 
      @click="toggleAddMarker"
    >
      {{ isAddingMarker ? "Кликните на карту для размещения маркера" : "Добавить маркер" }}
    </button>

    <!-- Copy URL and New Hash buttons -->
    <div class="control-buttons">
      <button @click="copySessionHash" class="copy-session-hash-btn">
        Копировать URL
      </button>
      <button @click="generateNewHash" class="generate-new-hash-btn">
        Новый хэш
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isAddingMarker: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-add-marker', 'copy-session-hash', 'generate-new-hash'])

const toggleAddMarker = () => {
  emit('toggle-add-marker')
}

const copySessionHash = () => {
  emit('copy-session-hash')
}

const generateNewHash = () => {
  emit('generate-new-hash')
}
</script>

<style scoped>
.add-marker-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 50;

  background: linear-gradient(45deg, #3283a3, #1e70da, #4facfe, #00f2fe);
  background-size: 400% 400%;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-transform: uppercase;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);

  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: gradient 6s ease infinite, pulse 2s ease infinite;

  font-weight: 600;
  font-size: 14px;
  padding: 6px 12px;
}

.add-marker-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.add-marker-btn.active {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.add-marker-btn.active:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.control-buttons {
  position: absolute;
  top: 50px;
  left: 10px;
  z-index: 50;
}

.copy-session-hash-btn {
  background: linear-gradient(45deg, #4c9e16, #4c9e16, #4facfe, #00f2fe);
  background-size: 400% 400%;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-transform: uppercase;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);

  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: gradient 6s ease infinite, pulse 2s ease infinite;

  font-weight: 600;
  font-size: 14px;
  padding: 6px 12px;
  margin-right: 10px;
}

.copy-session-hash-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.generate-new-hash-btn {
  background: linear-gradient(45deg, #e74c3c, #c0392b, #f39c12, #e67e22);
  background-size: 400% 400%;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-transform: uppercase;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);

  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: gradient 6s ease infinite, pulse 2s ease infinite;

  font-weight: 600;
  font-size: 14px;
  padding: 6px 12px;
}

.generate-new-hash-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
  100% {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
}
</style>