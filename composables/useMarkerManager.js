import { ref } from 'vue'
import maplibregl from "maplibre-gl"

export const useMarkerManager = (sessionHash) => {
  const markers = ref([])
  const isAddingMarker = ref(false)
  const isMovingMarker = ref(false)
  const movingMarkerId = ref(null)

  // Function to copy coordinates to clipboard
  const copyCoordinates = async (latitude, longitude) => {
    try {
      const coordsText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      await navigator.clipboard.writeText(coordsText)
      return true
    } catch (error) {
      console.error("Error copying coordinates:", error)
      alert("Не удалось скопировать координаты: " + error.message)
      return false
    }
  }

  // Function to save marker description
  const saveDescription = async (markerId, description) => {
    try {
      const response = await $fetch(`/api/markers`, {
        method: "PUT",
        body: {
          id: markerId,
          description,
          session_hash: sessionHash.value,
        },
      })

      if (response.success) {
        // Update local marker data
        const markerInstance = markers.value.find((m) => m.id === markerId)
        if (markerInstance) {
          // Update the marker data and refresh popup if needed
          return true
        }
      } else {
        alert("Не удалось сохранить описание: " + response.error)
        return false
      }
    } catch (error) {
      console.error("Error saving description:", error)
      alert("Ошибка при сохранении описания: " + error.message)
      return false
    }
  }

  // Function to update marker coordinates
  const updateMarkerCoordinates = async (markerId, latitude, longitude) => {
    const markerInstance = markers.value.find((m) => m.id === markerId)
    if (!markerInstance) return false

    try {
      const response = await $fetch(`/api/markers`, {
        method: "PUT",
        body: {
          id: markerId,
          latitude,
          longitude,
          session_hash: sessionHash.value,
        },
      })

      if (response.success) {
        markerInstance.marker.setLngLat([longitude, latitude])
        return true
      } else {
        alert("Не удалось обновить координаты: " + response.error)
        return false
      }
    } catch (error) {
      console.error("Error updating coordinates:", error)
      alert("Ошибка при обновлении координат: " + error.message)
      return false
    }
  }

  // Function to upload images
  const uploadImages = async (markerId, files) => {
    const markerInstance = markers.value.find((m) => m.id === markerId)
    if (!markerInstance) return false

    try {
      const newImages = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("image", file)
        formData.append("key", "c277e737512fa76999c54361689baec3")
        formData.append("expiration", "600")

        const response = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          body: formData,
        })
        const data = await response.json()

        if (data.success) {
          const imageUrl = data.data.url
          const updateResponse = await $fetch(`/api/markers`, {
            method: "POST",
            body: {
              marker_id: markerId,
              image_url: imageUrl,
              session_hash: sessionHash.value,
            },
          })

          if (updateResponse.success) {
            newImages.push(updateResponse.image)
          } else {
            alert(`Не удалось сохранить изображение для маркера: ${updateResponse.error}`)
          }
        } else {
          alert(`Не удалось загрузить изображение на ImgBB: ${data.error.message}`)
        }
      }

      return newImages.length > 0 ? newImages : false
    } catch (error) {
      console.error("Error uploading images:", error)
      alert("Ошибка при загрузке изображений: " + error.message)
      return false
    }
  }

  // Function to remove an image
  const removeImage = async (markerId, imageId) => {
    try {
      const response = await $fetch(`/api/markers`, {
        method: "DELETE",
        body: { image_id: imageId, session_hash: sessionHash.value },
      })

      if (response.success) {
        return true
      } else {
        alert("Не удалось удалить изображение: " + response.error)
        return false
      }
    } catch (error) {
      console.error("Error removing image:", error)
      alert("Ошибка при удалении изображения: " + error.message)
      return false
    }
  }

  // Function to toggle marker movement mode
  const toggleMoveMarker = (markerId) => {
    if (isMovingMarker.value && movingMarkerId.value === markerId) {
      isMovingMarker.value = false
      movingMarkerId.value = null
      return false
    } else {
      isAddingMarker.value = false
      isMovingMarker.value = true
      movingMarkerId.value = markerId
      return true
    }
  }

  // Function to handle marker movement
  const handleMoveMarker = async (e) => {
    if (!isMovingMarker.value || !movingMarkerId.value) return false

    const markerInstance = markers.value.find((m) => m.id === movingMarkerId.value)
    if (!markerInstance) return false

    const { lng, lat } = e.lngLat
    markerInstance.marker.setLngLat([lng, lat])

    try {
      const response = await $fetch(`/api/markers`, {
        method: "PUT",
        body: {
          id: movingMarkerId.value,
          latitude: lat,
          longitude: lng,
          session_hash: sessionHash.value,
        },
      })

      if (response.success) {
        return true
      } else {
        alert("Не удалось переместить маркер: " + response.error)
        return false
      }
    } catch (error) {
      console.error("Error moving marker:", error)
      alert("Ошибка при перемещении маркера: " + error.message)
      return false
    }
  }

  // Function to remove marker
  const removeMarker = async (markerId) => {
    const markerInstance = markers.value.find((m) => m.id === markerId)
    if (!markerInstance) return false

    try {
      const response = await $fetch(`/api/markers`, {
        method: "DELETE",
        body: { id: markerId, session_hash: sessionHash.value },
      })

      if (response.success) {
        markerInstance.marker.remove()
        markers.value = markers.value.filter((m) => m.id !== markerId)
        return true
      } else {
        alert("Не удалось удалить маркер: " + response.error)
        return false
      }
    } catch (error) {
      console.error("Error removing marker:", error)
      alert("Ошибка при удалении маркера: " + error.message)
      return false
    }
  }

  // Function to add new marker
  const addMarker = async (e, map) => {
    if (!isAddingMarker.value) return false

    const { lng, lat } = e.lngLat

    try {
      const response = await $fetch(`/api/markers`, {
        method: "POST",
        body: {
          latitude: lat,
          longitude: lng,
          description: "",
          session_hash: sessionHash.value,
        },
      })

      if (response.success) {
        const newMarker = response.marker
        const markerElement = document.createElement("div")
        markerElement.className = "marker"
        markerElement.style.backgroundImage = "url(https://docs.mapbox.com/help/demos/custom-markers-gl-js/mapbox-icon.png)"
        markerElement.style.width = "32px"
        markerElement.style.height = "32px"
        markerElement.style.backgroundSize = "100%"

        const marker = new maplibregl.Marker(markerElement)
          .setLngLat([lng, lat])
          .addTo(map)

        const markerInstance = {
          id: newMarker.id,
          marker,
          element: markerElement,
        }

        markers.value.push(markerInstance)
        isAddingMarker.value = false
        return markerInstance
      } else {
        alert("Не удалось добавить маркер: " + response.error)
        return false
      }
    } catch (error) {
      console.error("Error adding marker:", error)
      alert("Ошибка при добавлении маркера: " + error.message)
      return false
    }
  }

  // Function to load existing markers
  const loadMarkers = async (map) => {
    try {
      const response = await $fetch(`/api/markers?session_hash=${encodeURIComponent(sessionHash.value)}`, {
        method: "GET",
      })

      if (response.success) {
        // Clear existing markers
        markers.value.forEach((m) => m.marker.remove())
        markers.value = []

        // Add markers to map
        response.markers.forEach((markerData) => {
          const markerElement = document.createElement("div")
          markerElement.className = "marker"
          markerElement.style.backgroundImage = "url(https://docs.mapbox.com/help/demos/custom-markers-gl-js/mapbox-icon.png)"
          markerElement.style.width = "32px"
          markerElement.style.height = "32px"
          markerElement.style.backgroundSize = "100%"

          const marker = new maplibregl.Marker(markerElement)
            .setLngLat([markerData.longitude, markerData.latitude])
            .addTo(map)

          const markerInstance = {
            id: markerData.id,
            marker,
            element: markerElement,
            data: markerData
          }

          markers.value.push(markerInstance)
        })

        return response.markers
      } else {
        console.error("Failed to load markers:", response.error)
        alert("Не удалось загрузить маркеры: " + response.error)
        return []
      }
    } catch (error) {
      console.error("Error fetching markers:", error, error.stack)
      alert(`Ошибка при загрузке маркеров: ${error.message || "Произошла непредвиденная ошибка"}`)
      return []
    }
  }

  return {
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
  }
}