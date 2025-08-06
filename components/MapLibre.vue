<!-- components/MapLibre.vue -->
<template>
  <div id="map-wrapper">
    <!-- Map Controls -->
    <MapControls
      :is-adding-marker="isAddingMarker"
      @toggle-add-marker="toggleAddMarker"
      @copy-session-hash="handleCopySessionHash"
      @generate-new-hash="handleGenerateNewHash"
    />

    <!-- Donate Button -->
    <DonateButton />

    <!-- Notification Toast -->
    <NotificationToast
      :visible="showNotification"
      :message="notificationMessage"
    />

    <!-- Image Modal -->
    <ImageModal
      :visible="showImageModal"
      :image-url="selectedImageUrl"
      @close="closeImageModal"
    />

    <!-- Map Container -->
    <div 
      id="map" 
      :class="{ 
        'adding-marker': isAddingMarker, 
        'moving-marker': isMovingMarker 
      }"
      style="width: 100%; height: 100vh"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import maplibregl from "maplibre-gl"
import { useSessionManager } from "~/composables/useSessionManager"
import { useMarkerManager } from "~/composables/useMarkerManager"
import MapControls from "./MapControls.vue"
import NotificationToast from "./NotificationToast.vue"
import ImageModal from "./ImageModal.vue"
import DonateButton from "./DonateButton.vue"

// Map instance
let map = null
let mapCanvas = null

// Session management
const {
  sessionHash,
  ensureSessionHashAndMapPosition,
  generateNewHash,
  copySessionHash
} = useSessionManager()

// Marker management
const {
  markers,
  isAddingMarker,
  isMovingMarker,
  movingMarkerId,
  copyCoordinates,
  saveDescription,
  updateMarkerCoordinates,
  uploadImages,
  removeImage,
  toggleMoveMarker,
  handleMoveMarker,
  removeMarker,
  addMarker,
  loadMarkers
} = useMarkerManager(sessionHash)

// UI state
const showImageModal = ref(false)
const selectedImageUrl = ref("")
const showNotification = ref(false)
const notificationMessage = ref("")

// Default map position
const defaultCenter = [0, 0]
const defaultZoom = 1

// OSM style configuration
const osmStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

// Notification helper
const triggerNotification = (message) => {
  notificationMessage.value = message
  showNotification.value = true
  setTimeout(() => {
    showNotification.value = false
    notificationMessage.value = ""
  }, 2000)
}

// Image modal handlers
const openImageModal = (imageUrl) => {
  selectedImageUrl.value = imageUrl
  showImageModal.value = true
}

const closeImageModal = () => {
  showImageModal.value = false
  selectedImageUrl.value = ""
}

// Map control handlers
const toggleAddMarker = () => {
  isAddingMarker.value = !isAddingMarker.value
  if (isAddingMarker.value) {
    isMovingMarker.value = false
    movingMarkerId.value = null
  }
  changeToProperCursor()
}

const handleCopySessionHash = async () => {
  const success = await copySessionHash()
  if (success) {
    triggerNotification("URL с хэшем сессии скопирован в буфер обмена!")
  }
}

const handleGenerateNewHash = async () => {
  const newHash = await generateNewHash()
  if (newHash) {
    // Clear all markers
    for (const marker of markers.value) {
      await removeMarker(marker.id)
    }
    markers.value = []

    // Reset map position
    if (map) {
      map.setCenter(defaultCenter)
      map.setZoom(defaultZoom)
    }

    await saveMapPosition()
    triggerNotification("Новый хэш сессии успешно создан, маркеры очищены!")
  }
}

// Cursor management
const changeToProperCursor = () => {
  if (!mapCanvas) return
  
  if (isAddingMarker.value) {
    mapCanvas.style.cursor = "crosshair"
  } else if (isMovingMarker.value) {
    mapCanvas.style.cursor = "move"
  } else {
    mapCanvas.style.cursor = ""
  }
}

// Map position saving
const saveMapPosition = async () => {
  if (!map) return

  const center = map.getCenter()
  const zoom = map.getZoom()

  try {
    await $fetch(`/api/markers`, {
      method: "PUT",
      body: {
        center_latitude: center.lat,
        center_longitude: center.lng,
        zoom_level: zoom,
        session_hash: sessionHash.value,
      },
    })
  } catch (error) {
    console.error("Error saving map position:", error)
  }
}

// Create popup content with Vue component approach
const createPopupContent = (markerData) => {
  // Create a temporary div to render our Vue component
  const popupDiv = document.createElement('div')
  popupDiv.style.maxWidth = '200px'
  
  // We'll render the MarkerPopup component content as HTML
  // This is a simplified approach - in a full Vue 3 setup, you'd use createApp
  const imagesHtml = markerData.images && markerData.images.length > 0
    ? markerData.images
        .map(
          (img) => `
          <div style="position: relative; margin-top: 10px;">
            <img src="${img.image_url}" style="max-width: 100%; height: auto; cursor: pointer;" alt="Изображение маркера" onclick="window.openImageModal('${img.image_url}')">
            <button onclick="window.removeImage(${markerData.id}, ${img.id})"
              style="position: absolute; top: 5px; right: 5px; padding: 2px 6px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Удалить
            </button>
          </div>
        `
        )
        .join("")
    : "<p style='font-family: Arial, sans-serif; font-size: 14px;'>Изображения отсутствуют</p>"

  popupDiv.innerHTML = `
    <div style="max-width: 200px; padding: 10px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
      <p style="font-weight: 600; margin-bottom: 5px;">Описание:</p>
      <div id="description-display-${markerData.id}" style="display: flex; align-items: flex-start; margin-bottom: 10px;">
        <span style="flex: 1; font-size: 14px; white-space: normal; word-wrap: break-word;">${markerData.description || "Описание отсутствует"}</span>
        <button onclick="window.toggleEditDescription(${markerData.id})" style="margin-left: 5px; padding: 2px 6px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Редактировать
        </button>
      </div>
      <div id="description-edit-${markerData.id}" style="display: none; margin-bottom: 10px;">
        <textarea id="description-textarea-${markerData.id}" style="width: 100%; min-height: 50px; margin-bottom: 5px; font-family: Arial, sans-serif; font-size: 14px;">${markerData.description || ""}</textarea>
        <div style="display: flex; justify-content: flex-end;">
          <button onclick="window.saveDescription(${markerData.id})" style="padding: 2px 6px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Сохранить
          </button>
          <button onclick="window.toggleEditDescription(${markerData.id})" style="padding: 2px 6px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px; font-size: 12px;">
            Отмена
          </button>
        </div>
      </div>
      <p style="font-weight: 600; margin-bottom: 5px;">Координаты:</p>
      <div id="coords-display-${markerData.id}" style="display: flex; align-items: center; margin-bottom: 10px;">
        <span style="flex: 1; cursor: pointer; text-decoration: underline; font-size: 14px;" onclick="window.copyCoordinates(${markerData.latitude}, ${markerData.longitude})">${markerData.latitude.toFixed(6)}, ${markerData.longitude.toFixed(6)}</span>
        <button onclick="window.toggleEditCoordinates(${markerData.id})" style="margin-left: 5px; padding: 2px 6px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Редактировать
        </button>
      </div>
      <div id="coords-edit-${markerData.id}" style="display: none; margin-bottom: 10px;">
        <div>
          <label style="font-size: 14px;">Широта: </label>
          <input type="number" id="lat-${markerData.id}" value="${markerData.latitude.toFixed(6)}" step="any" style="width: 100px; margin-bottom: 5px; font-family: Arial, sans-serif; font-size: 14px;" />
        </div>
        <div>
          <label style="font-size: 14px;">Долгота: </label>
          <input type="number" id="lng-${markerData.id}" value="${markerData.longitude.toFixed(6)}" step="any" style="width: 100px; margin-bottom: 10px; font-family: Arial, sans-serif; font-size: 14px;" />
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <button onclick="window.updateMarkerCoordinates(${markerData.id})" style="margin-right: 5px; padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Обновить координаты
          </button>
          <button onclick="window.toggleEditCoordinates(${markerData.id})" style="padding: 5px 10px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Отмена
          </button>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <label for="image-upload-${markerData.id}" style="display: block; margin-bottom: 5px; font-size: 14px;">Загрузить изображения:</label>
        <input type="file" id="image-upload-${markerData.id}" accept="image/*" multiple style="margin-bottom: 10px; font-family: Arial, sans-serif; font-size: 14px;" />
        <button onclick="window.uploadImages(${markerData.id})" style="padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Загрузить
        </button>
      </div>
      ${imagesHtml}
      <div style="margin-top: 10px; display: flex; justify-content: space-between;">
        <button onclick="window.moveMarker(${markerData.id})" style="padding: 5px 10px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          ${isMovingMarker.value && movingMarkerId.value === markerData.id ? "Перемещение" : "Переместить маркер"}
        </button>
        <button onclick="window.removeMarker(${markerData.id})" style="padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Удалить
        </button>
      </div>
    </div>
  `
  
  return popupDiv.innerHTML
}

// Map click handler
const handleMapClick = async (e) => {
  if (isMovingMarker.value) {
    await handleMoveMarker(e)
    return
  }

  if (isAddingMarker.value) {
    const markerInstance = await addMarker(e, map)
    if (markerInstance) {
      // Get fresh marker data for popup
      const markersData = await loadMarkers(map)
      const markerData = markersData.find(m => m.id === markerInstance.id)
      
      if (markerData) {
        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(createPopupContent(markerData))
        
        markerInstance.marker.setPopup(popup)
        
        // Add hover effects
        markerInstance.element.addEventListener("mouseenter", () => {
          if (!isAddingMarker.value && !isMovingMarker.value) {
            mapCanvas.style.cursor = "pointer"
          }
        })
        
        markerInstance.element.addEventListener("mouseleave", () => {
          if (!isAddingMarker.value && !isMovingMarker.value) {
            mapCanvas.style.cursor = ""
          } else {
            changeToProperCursor()
          }
        })
      }
    }
  }
}

// Global window functions for popup interactions
const setupWindowFunctions = () => {
  window.copyCoordinates = async (latitude, longitude) => {
    const success = await copyCoordinates(latitude, longitude)
    if (success) {
      triggerNotification("Координаты скопированы в буфер обмена!")
    }
  }

  window.openImageModal = openImageModal

  window.toggleEditDescription = (markerId) => {
    const displayDiv = document.getElementById(`description-display-${markerId}`)
    const editDiv = document.getElementById(`description-edit-${markerId}`)
    if (displayDiv && editDiv) {
      const isEditing = editDiv.style.display === "none"
      displayDiv.style.display = isEditing ? "none" : "flex"
      editDiv.style.display = isEditing ? "block" : "none"
    }
  }

  window.saveDescription = async (markerId) => {
    const textarea = document.getElementById(`description-textarea-${markerId}`)
    if (textarea) {
      const success = await saveDescription(markerId, textarea.value)
      if (success) {
        // Refresh the marker popup
        const markersData = await loadMarkers(map)
        const markerData = markersData.find(m => m.id === markerId)
        const markerInstance = markers.value.find(m => m.id === markerId)
        
        if (markerData && markerInstance) {
          markerInstance.marker.getPopup().setHTML(createPopupContent(markerData))
        }
        triggerNotification("Описание сохранено!")
      }
    }
  }

  window.toggleEditCoordinates = (markerId) => {
    const displayDiv = document.getElementById(`coords-display-${markerId}`)
    const editDiv = document.getElementById(`coords-edit-${markerId}`)
    if (displayDiv && editDiv) {
      const isEditing = editDiv.style.display === "none"
      displayDiv.style.display = isEditing ? "none" : "flex"
      editDiv.style.display = isEditing ? "block" : "none"
    }
  }

  window.updateMarkerCoordinates = async (markerId) => {
    const latInput = document.getElementById(`lat-${markerId}`)
    const lngInput = document.getElementById(`lng-${markerId}`)
    
    if (latInput && lngInput) {
      const success = await updateMarkerCoordinates(
        markerId, 
        parseFloat(latInput.value), 
        parseFloat(lngInput.value)
      )
      if (success) {
        // Refresh the marker popup
        const markersData = await loadMarkers(map)
        const markerData = markersData.find(m => m.id === markerId)
        const markerInstance = markers.value.find(m => m.id === markerId)
        
        if (markerData && markerInstance) {
          markerInstance.marker.getPopup().setHTML(createPopupContent(markerData))
        }
        triggerNotification("Координаты обновлены!")
      }
    }
  }

  window.uploadImages = async (markerId) => {
    const input = document.getElementById(`image-upload-${markerId}`)
    if (!input.files || input.files.length === 0) {
      alert("Пожалуйста, выберите хотя бы одно изображение для загрузки.")
      return
    }

    const uploadButton = document.querySelector(`#image-upload-${markerId} + button`)
    uploadButton.disabled = true
    uploadButton.textContent = "Загрузка..."

    try {
      const newImages = await uploadImages(markerId, Array.from(input.files))
      if (newImages) {
        // Refresh the marker popup
        const markersData = await loadMarkers(map)
        const markerData = markersData.find(m => m.id === markerId)
        const markerInstance = markers.value.find(m => m.id === markerId)
        
        if (markerData && markerInstance) {
          markerInstance.marker.getPopup().setHTML(createPopupContent(markerData))
        }
        triggerNotification(`${newImages.length} изображение${newImages.length > 1 ? "й" : ""} успешно загружено!`)
      }
    } finally {
      uploadButton.disabled = false
      uploadButton.textContent = "Загрузить"
      input.value = ""
    }
  }

  window.removeImage = async (markerId, imageId) => {
    const success = await removeImage(markerId, imageId)
    if (success) {
      // Refresh the marker popup
      const markersData = await loadMarkers(map)
      const markerData = markersData.find(m => m.id === markerId)
      const markerInstance = markers.value.find(m => m.id === markerId)
      
      if (markerData && markerInstance) {
        markerInstance.marker.getPopup().setHTML(createPopupContent(markerData))
      }
      triggerNotification("Изображение успешно удалено!")
    }
  }

  window.moveMarker = async (markerId) => {
    const isMoving = toggleMoveMarker(markerId)
    changeToProperCursor()
    
    // Refresh popup to update button text
    const markersData = await loadMarkers(map)
    const markerData = markersData.find(m => m.id === markerId)
    const markerInstance = markers.value.find(m => m.id === markerId)
    
    if (markerData && markerInstance) {
      markerInstance.marker.getPopup().setHTML(createPopupContent(markerData))
    }
  }

  window.removeMarker = async (markerId) => {
    const success = await removeMarker(markerId)
    if (success) {
      triggerNotification("Маркер удален!")
    }
  }
}

// Cleanup window functions
const cleanupWindowFunctions = () => {
  delete window.removeMarker
  delete window.moveMarker
  delete window.updateMarkerCoordinates
  delete window.toggleEditDescription
  delete window.saveDescription
  delete window.toggleEditCoordinates
  delete window.uploadImages
  delete window.removeImage
  delete window.copyCoordinates
  delete window.openImageModal
}

onMounted(async () => {
  const mapPosition = await ensureSessionHashAndMapPosition()
  map = new maplibregl.Map({
    container: "map",
    style: osmStyle,
    center: mapPosition ? [mapPosition.center_longitude, mapPosition.center_latitude] : defaultCenter,
    zoom: mapPosition ? mapPosition.zoom_level : defaultZoom,
  })

  map.addControl(new maplibregl.NavigationControl())
  const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 6000,
    },
    trackUserLocation: false,
    showUserHeading: true,
  })
  map.addControl(geolocateControl, "top-right")

  map.on("click", handleMapClick)
  mapCanvas = map.getCanvas()

  map.on("load", async () => {
    const markersData = await loadMarkers(map)
    
    // Add popups to loaded markers
    markersData.forEach((markerData) => {
      const markerInstance = markers.value.find(m => m.id === markerData.id)
      if (markerInstance) {
        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(createPopupContent(markerData))
        
        markerInstance.marker.setPopup(popup)
        
        // Add hover effects
        markerInstance.element.addEventListener("mouseenter", () => {
          if (!isAddingMarker.value && !isMovingMarker.value) {
            mapCanvas.style.cursor = "pointer"
          }
        })
        
        markerInstance.element.addEventListener("mouseleave", () => {
          if (!isAddingMarker.value && !isMovingMarker.value) {
            mapCanvas.style.cursor = ""
          } else {
            changeToProperCursor()
          }
        })
      }
    })
  })

  map.on("moveend", saveMapPosition)
  
  setupWindowFunctions()
})

onUnmounted(() => {
  if (map) {
    map.off("click", handleMapClick)
    map.off("moveend", saveMapPosition)
    map.remove()
  }
  cleanupWindowFunctions()
})
</script>

<style>
@import "maplibre-gl/dist/maplibre-gl.css";

#map.adding-marker {
  cursor: crosshair;
}

#map.moving-marker {
  cursor: move;
}

.marker {
  cursor: pointer;
}
</style>