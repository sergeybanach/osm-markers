<!-- components/MapLibre.vue -->
<template>
  <div id="map-wrapper">
    <button class="add-marker-btn" :class="{ active: isAddingMarker }" @click="toggleAddMarker">
      {{ isAddingMarker ? "Click map to place marker" : "Add Marker" }}
    </button>

    <div style="position: absolute; bottom: 40px; left: 10px; z-index: 50;">
      <label for="sessionHashInput">Session Hash: </label>
      <input id="sessionHashInput" v-model="tempSessionHash" type="text" style="margin-right: 5px;"
        @click="selectAndCopyHash" />
      <button @click="updateSessionHash"
        style="padding: 4px 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Update
      </button>
      <button @click="copySessionHash"
        style="padding: 4px 8px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
        Copy
      </button>
      <button @click="generateNewHash"
        style="padding: 4px 8px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
        New Hash
      </button>
    </div>

    <!-- Notification for session hash copied or image upload -->
    <div v-if="showNotification" class="notification">
      {{ notificationMessage }}
    </div>

    <div id="map" :class="{ 'adding-marker': isAddingMarker, 'moving-marker': isMovingMarker }" style="width: 100%; height: 100vh"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import maplibregl from "maplibre-gl";

// State for marker placement and movement
const isAddingMarker = ref(false);
const isMovingMarker = ref(false);
const movingMarkerId = ref(null);
let map = null;
let mapCanvas = null;
const markers = ref([]);

// Session hash management
const sessionHash = ref(localStorage.getItem("sessionHash") || "");
const tempSessionHash = ref(sessionHash.value);
const showNotification = ref(false);
const notificationMessage = ref(""); // Updated to handle different messages

// Default map position
const defaultCenter = [0, 0];
const defaultZoom = 1;

// Function to show notification briefly
const triggerNotification = (message) => {
  notificationMessage.value = message;
  showNotification.value = true;
  setTimeout(() => {
    showNotification.value = false;
    notificationMessage.value = "";
  }, 2000);
};

// Function to ensure session hash exists and load map position
const ensureSessionHashAndMapPosition = async () => {
  if (!sessionHash.value) {
    try {
      const response = await fetch("/api/generate-session-hash");
      const data = await response.json();
      if (data.success) {
        sessionHash.value = data.sessionHash;
        tempSessionHash.value = data.sessionHash;
        localStorage.setItem("sessionHash", sessionHash.value);
      } else {
        console.error("Failed to generate session hash:", data.error);
        alert("Failed to generate session hash: " + data.error);
        return null;
      }
    } catch (error) {
      console.error("Error generating session hash:", error);
      alert("Error generating session hash: " + error.message);
      return null;
    }
  }

  try {
    const response = await $fetch(`/api/markers?session_hash=${encodeURIComponent(sessionHash.value)}`, {
      method: "GET",
    });

    if (response.success) {
      return response.mapPosition || null;
    } else {
      console.error("Failed to load map position:", response.error);
      return null;
    }
  } catch (error) {
    console.error("Error fetching map position:", error);
    return null;
  }
};

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
};

// Create popup content with editable coordinates, description, image upload, and buttons
const createPopupContent = (marker, markerInstance) => {
  return `
    <div style="max-width: 200px; padding: 10px;">
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <strong style="margin-right: 5px;">Description:</strong>
        <div id="description-display-${marker.id}">
          <span>${marker.description || "No description"}</span>
          <button onclick="window.toggleEditDescription(${marker.id})" style="margin-left: 5px; padding: 2px 6px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">
            Edit
          </button>
        </div>
        <div id="description-edit-${marker.id}" style="display: none;">
          <textarea id="description-textarea-${marker.id}" style="width: 100%; min-height: 50px; margin-bottom: 5px;">${marker.description || ""}</textarea>
          <button onclick="window.saveDescription(${marker.id})" style="padding: 2px 6px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Save
          </button>
          <button onclick="window.toggleEditDescription(${marker.id})" style="padding: 2px 6px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
            Cancel
          </button>
        </div>
      </div>
      <p><strong>Coordinates:</strong></p>
      <div id="coords-display-${marker.id}">
        <p>Latitude: <span>${marker.latitude.toFixed(4)}</span>
           <button onclick="window.toggleEditCoordinates(${marker.id})" style="margin-left: 5px; padding: 2px 6px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">
             Edit
           </button>
        </p>
        <p>Longitude: <span>${marker.longitude.toFixed(4)}</span></p>
      </div>
      <div id="coords-edit-${marker.id}" style="display: none;">
        <div>
          <label>Latitude: </label>
          <input type="number" id="lat-${marker.id}" value="${marker.latitude.toFixed(4)}" step="any" style="width: 100px; margin-bottom: 5px;" />
        </div>
        <div>
          <label>Longitude: </label>
          <input type="number" id="lng-${marker.id}" value="${marker.longitude.toFixed(4)}" step="any" style="width: 100px; margin-bottom: 10px;" />
        </div>
        <button onclick="window.updateMarkerCoordinates(${marker.id})" style="margin-top: 10px; margin-right: 5px; padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Update Coordinates
        </button>
        <button onclick="window.toggleEditCoordinates(${marker.id})" style="margin-top: 10px; margin-right: 5px; padding: 5px 10px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
      </div>
      <div style="margin-top: 10px;">
        <label for="image-upload-${marker.id}" style="display: block; margin-bottom: 5px;">Upload Image:</label>
        <input type="file" id="image-upload-${marker.id}" accept="image/*" style="margin-bottom: 10px;" />
        <button onclick="window.uploadImage(${marker.id})" style="padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Upload
        </button>
      </div>
      ${marker.picture_url ? `<img src="${marker.picture_url}" style="max-width: 100%; height: auto; margin-top: 10px;" alt="Marker image">` : "<p>No image available</p>"}
      <button onclick="window.moveMarker(${marker.id})" style="margin-top: 10px; margin-right: 5px; padding: 5px 10px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
        ${isMovingMarker.value && movingMarkerId.value === marker.id ? "Moving" : "Move Marker"}
      </button>
      <button onclick="window.removeMarker(${marker.id})" style="margin-top: 10px; padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Remove
      </button>
    </div>
  `;
};

// Function to toggle coordinates editing
const toggleEditCoordinates = (markerId) => {
  const displayDiv = document.getElementById(`coords-display-${markerId}`);
  const editDiv = document.getElementById(`coords-edit-${markerId}`);
  if (displayDiv && editDiv) {
    const isEditing = editDiv.style.display === "none";
    displayDiv.style.display = isEditing ? "none" : "block";
    editDiv.style.display = isEditing ? "block" : "none";
  }
};

window.toggleEditCoordinates = toggleEditCoordinates;

// Function to toggle description editing
const toggleEditDescription = (markerId) => {
  const displayDiv = document.getElementById(`description-display-${markerId}`);
  const editDiv = document.getElementById(`description-edit-${markerId}`);
  if (displayDiv && editDiv) {
    const isEditing = editDiv.style.display === "none";
    displayDiv.style.display = isEditing ? "none" : "flex";
    editDiv.style.display = isEditing ? "block" : "none";
  }
};

window.toggleEditDescription = toggleEditDescription;

// Function to save description
const saveDescription = async (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  const textarea = document.getElementById(`description-textarea-${markerId}`);
  const newDescription = textarea.value;

  try {
    const response = await $fetch(`/api/markers`, {
      method: "PUT",
      body: {
        id: markerId,
        description: newDescription,
        session_hash: sessionHash.value,
      },
    });

    if (response.success) {
      const markerData = {
        id: markerId,
        latitude: markerInstance.marker.getLngLat().lat,
        longitude: markerInstance.marker.getLngLat().lng,
        description: newDescription,
        picture_url: response.marker.picture_url,
        session_hash: sessionHash.value,
      };
      markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
    } else {
      alert("Failed to update description: " + response.error);
    }
  } catch (error) {
    console.error("Error updating description:", error);
    alert("Error updating description: " + error.message);
  }
};

window.saveDescription = saveDescription;

// Function to update marker coordinates manually
const updateMarkerCoordinates = async (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  const latInput = document.getElementById(`lat-${markerId}`);
  const lngInput = document.getElementById(`lng-${markerId}`);
  const newLat = parseFloat(latInput.value);
  const newLng = parseFloat(lngInput.value);

  if (isNaN(newLat) || isNaN(newLng)) {
    alert("Please enter valid latitude and longitude values.");
    return;
  }

  if (newLat < -90 || newLat > 90 || newLng < -180 || newLng > 180) {
    alert("Latitude must be between -90 and 90, and longitude must be between -180 and 180.");
    return;
  }

  try {
    const response = await $fetch(`/api/markers`, {
      method: "PUT",
      body: {
        id: markerId,
        latitude: newLat,
        longitude: newLng,
        description: document.getElementById(`description-textarea-${markerId}`)?.value || 
                     markerInstance.marker.getPopup()._content.querySelector('span')?.textContent.trim() || "",
        session_hash: sessionHash.value,
      },
    });

    if (response.success) {
      markerInstance.marker.setLngLat([newLng, newLat]);
      const markerData = {
        id: markerId,
        latitude: newLat,
        longitude: newLng,
        description: response.marker.description,
        picture_url: response.marker.picture_url,
        session_hash: sessionHash.value,
      };
      markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
    } else {
      alert("Failed to update marker coordinates: " + response.error);
    }
  } catch (error) {
    console.error("Error updating marker coordinates:", error);
    alert("Error updating marker coordinates: " + error.message);
  }
};

window.updateMarkerCoordinates = updateMarkerCoordinates;

// Function to upload image to ImgBB
const uploadImage = async (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  const input = document.getElementById(`image-upload-${markerId}`);
  if (!input.files || input.files.length === 0) {
    alert("Please select an image to upload.");
    return;
  }

  const file = input.files[0];
  const formData = new FormData();
  formData.append("image", file);
  formData.append("key", "c277e737512fa76999c54361689baec3"); // ImgBB API key
  formData.append("expiration", "600"); // 10 minutes expiration

  try {
    // Disable upload button during upload
    const uploadButton = document.querySelector(`#image-upload-${markerId} + button`);
    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading...";

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (data.success) {
      const imageUrl = data.data.url;
      // Update marker in database with image URL
      const updateResponse = await $fetch(`/api/markers`, {
        method: "PUT",
        body: {
          id: markerId,
          description: document.getElementById(`description-textarea-${markerId}`)?.value || 
                       markerInstance.marker.getPopup()._content.querySelector('span')?.textContent.trim() || "",
          latitude: markerInstance.marker.getLngLat().lat,
          longitude: markerInstance.marker.getLngLat().lng,
          picture_url: imageUrl,
          session_hash: sessionHash.value,
        },
      });

      if (updateResponse.success) {
        // Update popup with new image
        const markerData = {
          id: markerId,
          latitude: markerInstance.marker.getLngLat().lat,
          longitude: markerInstance.marker.getLngLat().lng,
          description: updateResponse.marker.description,
          picture_url: imageUrl,
          session_hash: sessionHash.value,
        };
        markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
        triggerNotification("Image uploaded successfully!");
      } else {
        alert("Failed to update marker with image: " + updateResponse.error);
      }
    } else {
      alert("Failed to upload image to ImgBB: " + data.error.message);
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    alert("Error uploading image: " + error.message);
  } finally {
    // Re-enable upload button
    const uploadButton = document.querySelector(`#image-upload-${markerId} + button`);
    uploadButton.disabled = false;
    uploadButton.textContent = "Upload";
    // Clear the file input
    input.value = "";
  }
};

window.uploadImage = uploadImage;

// Function to move marker
const moveMarker = (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  if (isMovingMarker.value && movingMarkerId.value === markerId) {
    isMovingMarker.value = false;
    movingMarkerId.value = null;
    changeToProperCursor();
    const markerData = {
      id: markerId,
      latitude: markerInstance.marker.getLngLat().lat,
      longitude: markerInstance.marker.getLngLat().lng,
      description: document.getElementById(`description-textarea-${markerId}`)?.value || 
                   markerInstance.marker.getPopup()._content.querySelector('span')?.textContent.trim() || "",
      picture_url: markerInstance.marker.getPopup()._content.querySelector('img')?.src || null,
      session_hash: sessionHash.value,
    };
    markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
  } else {
    isAddingMarker.value = false;
    isMovingMarker.value = true;
    movingMarkerId.value = markerId;
    changeToProperCursor();
    const markerData = {
      id: markerId,
      latitude: markerInstance.marker.getLngLat().lat,
      longitude: markerInstance.marker.getLngLat().lng,
      description: document.getElementById(`description-textarea-${markerId}`)?.value || 
                   markerInstance.marker.getPopup()._content.querySelector('span')?.textContent.trim() || "",
      picture_url: markerInstance.marker.getPopup()._content.querySelector('img')?.src || null,
      session_hash: sessionHash.value,
    };
    markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
  }
};

window.moveMarker = moveMarker;

// Function to handle marker movement
const handleMoveMarker = async (e) => {
  if (!isMovingMarker.value || !movingMarkerId.value) return;

  const markerInstance = markers.value.find(m => m.id === movingMarkerId.value);
  if (!markerInstance) return;

  const { lng, lat } = e.lngLat;
  markerInstance.marker.setLngLat([lng, lat]);

  try {
    const response = await $fetch(`/api/markers`, {
      method: "PUT",
      body: {
        id: movingMarkerId.value,
        latitude: lat,
        longitude: lng,
        description: document.getElementById(`description-textarea-${movingMarkerId.value}`)?.value || 
                     markerInstance.marker.getPopup()._content.querySelector('span')?.textContent.trim() || "",
        picture_url: markerInstance.marker.getPopup()._content.querySelector('img')?.src || null,
        session_hash: sessionHash.value,
      },
    });

    if (response.success) {
      const markerData = {
        id: movingMarkerId.value,
        latitude: lat,
        longitude: lng,
        description: response.marker.description,
        picture_url: response.marker.picture_url,
        session_hash: sessionHash.value,
      };
      markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
    } else {
      alert("Failed to update marker position: " + response.error);
      markerInstance.marker.setLngLat([response.marker.longitude, response.marker.latitude]);
    }
  } catch (error) {
    console.error("Error updating marker position:", error);
    alert("Error updating marker position: " + error.message);
    markerInstance.marker.setLngLat([markerInstance.marker.getLngLat().lng, markerInstance.marker.getLngLat().lat]);
  }

  isMovingMarker.value = false;
  movingMarkerId.value = null;
  changeToProperCursor();
};

// Function to remove marker
const removeMarker = async (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  try {
    const response = await $fetch(`/api/markers`, {
      method: "DELETE",
      body: { id: markerId, session_hash: sessionHash.value },
    });

    if (response.success) {
      markerInstance.marker.remove();
      markers.value = markers.value.filter(m => m.id !== markerId);
    } else {
      alert("Failed to remove marker: " + response.error);
    }
  } catch (error) {
    console.error("Error removing marker:", error);
    alert("Error removing marker: " + error.message);
  }
};

window.removeMarker = removeMarker;

// Toggle marker placement mode
const toggleAddMarker = () => {
  isAddingMarker.value = !isAddingMarker.value;
  isMovingMarker.value = false;
  movingMarkerId.value = null;
  changeToProperCursor();
};

const changeToProperCursor = () => {
  mapCanvas.style.cursor = isAddingMarker.value || isMovingMarker.value ? "crosshair" : "";
};

// Handle map click to add or move marker
const handleMapClick = (e) => {
  if (isAddingMarker.value) {
    addMarker(e);
  } else if (isMovingMarker.value) {
    handleMoveMarker(e);
  }
};

// Handle marker placement
const addMarker = async (e) => {
  const { lng, lat } = e.lngLat;
  const description = "";

  const markerData = { latitude: lat, longitude: lng, description, session_hash: sessionHash.value };
  const popup = new maplibregl.Popup();
  const markerInstance = new maplibregl.Marker().setLngLat([lng, lat]).setPopup(popup).addTo(map);

  try {
    const response = await $fetch("/api/markers", {
      method: "POST",
      body: { latitude: lat, longitude: lng, description, picture_url: null, session_hash: sessionHash.value },
    });

    if (response.success) {
      markerData.id = response.marker.id;
      popup.setHTML(createPopupContent(markerData, markerInstance));
      markers.value.push({ id: markerData.id, marker: markerInstance });

      const markerElement = markerInstance.getElement();
      markerElement.style.cursor = "pointer";
      markerElement.addEventListener("mouseover", () => {
        if (!isAddingMarker.value && !isMovingMarker.value) {
          mapCanvas.style.cursor = "pointer";
        }
      });
      markerElement.addEventListener("mouseleave", () => {
        if (!isAddingMarker.value && !isMovingMarker.value) {
          mapCanvas.style.cursor = "";
        } else {
          changeToProperCursor();
        }
      });
    } else {
      alert("Failed to save marker: " + response.error);
      markerInstance.remove();
    }
  } catch (error) {
    console.error("Error saving marker:", error);
    alert("Error saving marker: " + error.message);
    markerInstance.remove();
  }

  isAddingMarker.value = false;
  changeToProperCursor();
};

// Save map position to the database
const saveMapPosition = async () => {
  try {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const response = await $fetch("/api/markers", {
      method: "POST",
      body: {
        center_longitude: center.lng,
        center_latitude: center.lat,
        zoom_level: zoom,
        session_hash: sessionHash.value,
      },
    });

    if (!response.success) {
      console.error("Failed to save map position:", response.error);
    }
  } catch (error) {
    console.error("Error saving map position:", error);
  }
};

// Load existing markers from the database
const loadMarkers = async () => {
  if (!sessionHash.value) {
    console.error("No session hash available for loading markers");
    return [];
  }

  try {
    const response = await $fetch(`/api/markers?session_hash=${encodeURIComponent(sessionHash.value)}`, {
      method: "GET",
    });

    if (response.success) {
      markers.value.forEach(m => {
        const markerElement = m.marker.getElement();
        markerElement.removeEventListener("mouseover", () => {});
        markerElement.removeEventListener("mouseleave", () => {});
        m.marker.remove();
      });
      markers.value = [];

      response.markers.forEach((marker) => {
        const popup = new maplibregl.Popup();
        const markerInstance = new maplibregl.Marker()
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(popup)
          .addTo(map);
        popup.setHTML(createPopupContent(marker, markerInstance));
        markers.value.push({ id: marker.id, marker: markerInstance });

        const markerElement = markerInstance.getElement();
        markerElement.style.cursor = "pointer";
        markerElement.addEventListener("mouseover", () => {
          if (!isAddingMarker.value && !isMovingMarker.value) {
            mapCanvas.style.cursor = "pointer";
          }
        });
        markerElement.addEventListener("mouseleave", () => {
          if (!isAddingMarker.value && !isMovingMarker.value) {
            mapCanvas.style.cursor = "";
          } else {
            changeToProperCursor();
          }
        });
      });

      return response.markers;
    } else {
      console.error("Failed to load markers:", response.error);
      alert("Failed to load markers: " + response.error);
      return [];
    }
  } catch (error) {
    console.error("Error fetching markers:", error, error.stack);
    alert(`Error fetching markers: ${error.message || "An unexpected error occurred"}`);
    return [];
  }
};

// Update session hash
const updateSessionHash = async () => {
  if (tempSessionHash.value && tempSessionHash.value !== sessionHash.value) {
    sessionHash.value = tempSessionHash.value;
    localStorage.setItem("sessionHash", sessionHash.value);
    const mapPosition = await ensureSessionHashAndMapPosition();
    if (map && mapPosition) {
      map.setCenter([mapPosition.center_longitude, mapPosition.center_latitude]);
      map.setZoom(mapPosition.zoom_level);
    }
    await loadMarkers();
  }
};

// Generate new session hash
const generateNewHash = async () => {
  try {
    const response = await fetch("/api/generate-session-hash");
    const data = await response.json();
    if (data.success) {
      sessionHash.value = data.sessionHash;
      tempSessionHash.value = data.sessionHash;
      localStorage.setItem("sessionHash", sessionHash.value);
      const mapPosition = await ensureSessionHashAndMapPosition();
      if (map && mapPosition) {
        map.setCenter([mapPosition.center_longitude, mapPosition.center_latitude]);
        map.setZoom(mapPosition.zoom_level);
      }
      await loadMarkers();
      alert("New session hash generated successfully!");
    } else {
      console.error("Failed to generate session hash:", data.error);
      alert("Failed to generate session hash: " + data.error);
    }
  } catch (error) {
    console.error("Error generating session hash:", error);
    alert("Error generating session hash: " + error.message);
  }
};

// Copy session hash to clipboard
const copySessionHash = async () => {
  try {
    await navigator.clipboard.writeText(sessionHash.value);
    triggerNotification("Session hash copied to clipboard!");
  } catch (error) {
    console.error("Error copying session hash:", error);
    alert("Failed to copy session hash: " + error.message);
  }
};

// Select session hash on input click
const selectAndCopyHash = (event) => {
  try {
    const input = event.target;
    input.select();
  } catch (error) {
    console.error("Error selecting session hash:", error);
    alert("Failed to select session hash: " + error.message);
  }
};

onMounted(async () => {
  const mapPosition = await ensureSessionHashAndMapPosition();
  map = new maplibregl.Map({
    container: "map",
    style: osmStyle,
    center: mapPosition ? [mapPosition.center_longitude, mapPosition.center_latitude] : defaultCenter,
    zoom: mapPosition ? mapPosition.zoom_level : defaultZoom,
  });

  map.addControl(new maplibregl.NavigationControl());
  const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 6000,
    },
    trackUserLocation: false,
    showUserHeading: true,
  });
  map.addControl(geolocateControl, 'top-right');

  map.on("click", handleMapClick);
  mapCanvas = map.getCanvas();

  map.on("load", async () => {
    await loadMarkers();
  });

  map.on("moveend", saveMapPosition);
});

onUnmounted(() => {
  if (map) {
    map.off("click", handleMapClick);
    map.off("moveend", saveMapPosition);
    map.remove();
  }
  delete window.removeMarker;
  delete window.moveMarker;
  delete window.updateMarkerCoordinates;
  delete window.toggleEditDescription;
  delete window.saveDescription;
  delete window.toggleEditCoordinates;
  delete window.uploadImage;
});
</script>

<style>
@import "maplibre-gl/dist/maplibre-gl.css";

.add-marker-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 50;
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.add-marker-btn:hover {
  background-color: #0056b3;
}

.add-marker-btn.active {
  background-color: #28a745;
}

.add-marker-btn.active:hover {
  background-color: #218838;
}

#map-wrapper {
  position: relative;
  height: 100vh;
}

#map {
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 0;
  cursor: default;
}

#map.moving-marker {
  cursor: crosshair;
}

.notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #28a745;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  z-index: 100;
  font-size: 14px;
  opacity: 0;
  animation: fadeInOut 2s ease-in-out;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -10px); }
  10% { opacity: 1; transform: translate(-50%, 0); }
  90% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -10px); }
}

@media (max-width: 768px) {
  .add-marker-btn {
    font-size: 14px;
    padding: 6px 12px;
  }

  .notification {
    font-size: 12px;
    padding: 8px 16px;
    max-width: 90%;
    text-align: center;
  }

  input#sessionHashInput {
    font-size: 14px;
    padding: 4px;
  }

  button {
    font-size: 14px;
    padding: 4px 8px;
  }

  input[type="file"] {
    font-size: 12px;
  }
}
</style>