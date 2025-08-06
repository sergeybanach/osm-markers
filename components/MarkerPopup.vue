<template>
  <div class="marker-popup">
    <!-- Description Section -->
    <p class="section-title">Описание:</p>
    <div v-if="!isEditingDescription" class="description-display">
      <span class="description-text">{{ marker.description || "Описание отсутствует" }}</span>
      <button @click="toggleEditDescription" class="edit-btn">
        Редактировать
      </button>
    </div>
    <div v-else class="description-edit">
      <textarea 
        v-model="editDescription" 
        class="description-textarea"
        :placeholder="marker.description || ''"
      ></textarea>
      <div class="button-group">
        <button @click="saveDescription" class="save-btn">
          Сохранить
        </button>
        <button @click="toggleEditDescription" class="cancel-btn">
          Отмена
        </button>
      </div>
    </div>

    <!-- Coordinates Section -->
    <p class="section-title">Координаты:</p>
    <div v-if="!isEditingCoordinates" class="coords-display">
      <span 
        class="coords-text" 
        @click="copyCoordinates"
        :title="'Кликните для копирования'"
      >
        {{ marker.latitude.toFixed(6) }}, {{ marker.longitude.toFixed(6) }}
      </span>
      <button @click="toggleEditCoordinates" class="edit-btn">
        Редактировать
      </button>
    </div>
    <div v-else class="coords-edit">
      <div class="coord-input">
        <label>Широта: </label>
        <input 
          type="number" 
          v-model="editLatitude" 
          step="any" 
          class="coord-field"
        />
      </div>
      <div class="coord-input">
        <label>Долгота: </label>
        <input 
          type="number" 
          v-model="editLongitude" 
          step="any" 
          class="coord-field"
        />
      </div>
      <div class="button-group">
        <button @click="updateCoordinates" class="save-btn">
          Обновить координаты
        </button>
        <button @click="toggleEditCoordinates" class="cancel-btn">
          Отмена
        </button>
      </div>
    </div>

    <!-- Image Upload Section -->
    <div class="image-upload-section">
      <label class="section-title">Загрузить изображения:</label>
      <input 
        type="file" 
        ref="fileInput"
        accept="image/*" 
        multiple 
        class="file-input"
      />
      <button @click="uploadImages" class="upload-btn" :disabled="isUploading">
        {{ isUploading ? 'Загрузка...' : 'Загрузить' }}
      </button>
    </div>

    <!-- Images Display -->
    <div v-if="marker.images && marker.images.length > 0" class="images-section">
      <div 
        v-for="img in marker.images" 
        :key="img.id" 
        class="image-container"
      >
        <img 
          :src="img.image_url" 
          @click="openImageModal(img.image_url)"
          class="marker-image"
          alt="Изображение маркера"
        />
        <button 
          @click="removeImage(img.id)"
          class="remove-image-btn"
        >
          Удалить
        </button>
      </div>
    </div>
    <div v-else class="no-images">
      <p>Изображения отсутствуют</p>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button @click="moveMarker" class="move-btn">
        {{ isMovingMarker ? "Перемещение" : "Переместить маркер" }}
      </button>
      <button @click="removeMarker" class="remove-btn">
        Удалить
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  marker: {
    type: Object,
    required: true
  },
  isMovingMarker: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'save-description',
  'update-coordinates', 
  'upload-images',
  'remove-image',
  'copy-coordinates',
  'open-image-modal',
  'move-marker',
  'remove-marker'
])

// Local state
const isEditingDescription = ref(false)
const isEditingCoordinates = ref(false)
const isUploading = ref(false)
const editDescription = ref(props.marker.description || '')
const editLatitude = ref(props.marker.latitude)
const editLongitude = ref(props.marker.longitude)
const fileInput = ref(null)

// Methods
const toggleEditDescription = () => {
  isEditingDescription.value = !isEditingDescription.value
  if (isEditingDescription.value) {
    editDescription.value = props.marker.description || ''
  }
}

const saveDescription = () => {
  emit('save-description', {
    markerId: props.marker.id,
    description: editDescription.value
  })
  isEditingDescription.value = false
}

const toggleEditCoordinates = () => {
  isEditingCoordinates.value = !isEditingCoordinates.value
  if (isEditingCoordinates.value) {
    editLatitude.value = props.marker.latitude
    editLongitude.value = props.marker.longitude
  }
}

const updateCoordinates = () => {
  emit('update-coordinates', {
    markerId: props.marker.id,
    latitude: parseFloat(editLatitude.value),
    longitude: parseFloat(editLongitude.value)
  })
  isEditingCoordinates.value = false
}

const uploadImages = async () => {
  if (!fileInput.value?.files || fileInput.value.files.length === 0) {
    alert("Пожалуйста, выберите хотя бы одно изображение для загрузки.")
    return
  }

  isUploading.value = true
  emit('upload-images', {
    markerId: props.marker.id,
    files: Array.from(fileInput.value.files)
  })
  
  // Reset after a delay to allow parent to handle upload
  setTimeout(() => {
    isUploading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }, 1000)
}

const removeImage = (imageId) => {
  emit('remove-image', {
    markerId: props.marker.id,
    imageId
  })
}

const copyCoordinates = () => {
  emit('copy-coordinates', {
    latitude: props.marker.latitude,
    longitude: props.marker.longitude
  })
}

const openImageModal = (imageUrl) => {
  emit('open-image-modal', imageUrl)
}

const moveMarker = () => {
  emit('move-marker', props.marker.id)
}

const removeMarker = () => {
  emit('remove-marker', props.marker.id)
}
</script>

<style scoped>
.marker-popup {
  max-width: 200px;
  padding: 10px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.section-title {
  font-weight: 600;
  margin-bottom: 5px;
  margin-top: 10px;
}

.section-title:first-child {
  margin-top: 0;
}

.description-display {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
}

.description-text {
  flex: 1;
  font-size: 14px;
  white-space: normal;
  word-wrap: break-word;
}

.edit-btn {
  margin-left: 5px;
  padding: 2px 6px;
  background-color: #ffc107;
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.description-edit {
  margin-bottom: 10px;
}

.description-textarea {
  width: 100%;
  min-height: 50px;
  margin-bottom: 5px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px;
}

.button-group {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
}

.save-btn {
  padding: 2px 6px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.cancel-btn {
  padding: 2px 6px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.coords-display {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.coords-text {
  flex: 1;
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
}

.coords-edit {
  margin-bottom: 10px;
}

.coord-input {
  margin-bottom: 5px;
}

.coord-input label {
  font-size: 14px;
}

.coord-field {
  width: 100px;
  margin-bottom: 5px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px;
}

.image-upload-section {
  margin-top: 10px;
}

.file-input {
  margin-bottom: 10px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  width: 100%;
}

.upload-btn {
  padding: 5px 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.upload-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.images-section {
  margin-top: 10px;
}

.image-container {
  position: relative;
  margin-top: 10px;
}

.marker-image {
  max-width: 100%;
  height: auto;
  cursor: pointer;
  border-radius: 4px;
}

.remove-image-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 2px 6px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
}

.no-images {
  font-family: Arial, sans-serif;
  font-size: 14px;
  color: #666;
  margin-top: 10px;
}

.action-buttons {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 5px;
}

.move-btn {
  padding: 5px 10px;
  background-color: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  flex: 1;
}

.remove-btn {
  padding: 5px 10px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  flex: 1;
}

@media (max-width: 768px) {
  .file-input {
    font-size: 12px;
  }
  
  .button-group button,
  .action-buttons button {
    font-size: 14px;
    padding: 4px 8px;
  }
}
</style>