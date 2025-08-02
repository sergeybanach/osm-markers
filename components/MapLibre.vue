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

    <!-- Notification for session hash copied -->
    <div v-if="showNotification" class="notification">
      Session hash copied to clipboard!
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
const movingMarkerId = ref(null); // Track the marker being moved
let map = null;
let mapCanvas = null;
const markers = ref([]); // Store marker instances with their IDs

// Session hash management
const sessionHash = ref(localStorage.getItem("sessionHash") || "");
const tempSessionHash = ref(sessionHash.value); // Temporary state for input field
const showNotification = ref(false); // State for notification visibility

// Default map position (fallback if no saved position)
const defaultCenter = [0, 0];
const defaultZoom = 1;

// Function to show notification briefly
const triggerNotification = () => {
  showNotification.value = true;
  setTimeout(() => {
    showNotification.value = false;
  }, 2000); // Hide after 2 seconds
};

// Function to ensure session hash exists and load map position
const ensureSessionHashAndMapPosition = async () => {
  // Ensure session hash
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

  // Load map position
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

// Create popup content with editable coordinates, edit, move, and remove buttons
const createPopupContent = (marker, markerInstance) => {
  return `
    <div style="max-width: 200px; padding: 10px;">
      <p><strong>Description:</strong> ${marker.description || "No description"}</p>
      <p><strong>Coordinates:</strong></p>
      <div>
        <label>Latitude: </label>
        <input type="number" id="lat-${marker.id}" value="${marker.latitude.toFixed(4)}" step="any" style="width: 100px; margin-bottom: 5px;" />
      </div>
      <div>
        <label>Longitude: </label>
        <input type="number" id="lng-${marker.id}" value="${marker.longitude.toFixed(4)}" step="any" style="width: 100px; margin-bottom: 10px;" />
      </div>
      ${marker.picture_url ? `<img src="${marker.picture_url}" style="max-width: 100%; height: auto;" alt="Marker image">` : "<p>No image available</p>"}
      <button onclick="window.updateMarkerCoordinates(${marker.id})" style="margin-top: 10px; margin-right: 5px; padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Update Coordinates
      </button>
      <button onclick="window.editMarker(${marker.id})" style="margin-top: 10px; margin-right: 5px; padding: 5px 10px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">
        Edit
      </button>
      <button onclick="window.moveMarker(${marker.id})" style="margin-top: 10px; margin-right: 5px; padding: 5px 10px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
        ${isMovingMarker.value && movingMarkerId.value === marker.id ? "Moving" : "Move Marker"}
      </button>
      <button onclick="window.removeMarker(${marker.id})" style="margin-top: 10px; padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Remove
      </button>
    </div>
  `;
};

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

  // Ensure coordinates are within valid ranges
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
        description: markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim(),
        session_hash: sessionHash.value
      },
    });

    if (response.success) {
      // Update marker position on map
      markerInstance.marker.setLngLat([newLng, newLat]);
      // Update popup content
      const markerData = {
        id: markerId,
        latitude: newLat,
        longitude: newLng,
        description: markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim(),
        picture_url: null,
        session_hash: sessionHash.value
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

// Expose updateMarkerCoordinates to global scope for popup button
window.updateMarkerCoordinates = updateMarkerCoordinates;

// Function to edit marker
const editMarker = async (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  const newDescription = prompt("Edit marker description:", markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim());
  if (newDescription === null) return; // User cancelled

  try {
    const response = await $fetch(`/api/markers`, {
      method: "PUT",
      body: { id: markerId, description: newDescription, session_hash: sessionHash.value },
    });

    if (response.success) {
      // Update marker popup content
      const markerData = {
        id: markerId,
        latitude: markerInstance.marker.getLngLat().lat,
        longitude: markerInstance.marker.getLngLat().lng,
        description: newDescription,
        picture_url: null,
        session_hash: sessionHash.value
      };
      markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
    } else {
      alert("Failed to update marker: " + response.error);
    }
  } catch (error) {
    console.error("Error updating marker:", error);
    alert("Error updating marker: " + error.message);
  }
};

// Expose editMarker to global scope for popup button
window.editMarker = editMarker;

// Function to move marker
const moveMarker = (markerId) => {
  const markerInstance = markers.value.find(m => m.id === markerId);
  if (!markerInstance) return;

  if (isMovingMarker.value && movingMarkerId.value === markerId) {
    // Cancel moving mode
    isMovingMarker.value = false;
    movingMarkerId.value = null;
    changeToProperCursor();
    // Update popup to reflect "Move Marker" button text
    const markerData = {
      id: markerId,
      latitude: markerInstance.marker.getLngLat().lat,
      longitude: markerInstance.marker.getLngLat().lng,
      description: markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim(),
      picture_url: null,
      session_hash: sessionHash.value
    };
    markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
  } else {
    // Enter moving mode
    isAddingMarker.value = false; // Disable adding markers
    isMovingMarker.value = true;
    movingMarkerId.value = markerId;
    changeToProperCursor();
    // Update popup to reflect "Moving" button text
    const markerData = {
      id: markerId,
      latitude: markerInstance.marker.getLngLat().lat,
      longitude: markerInstance.marker.getLngLat().lng,
      description: markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim(),
      picture_url: null,
      session_hash: sessionHash.value
    };
    markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
  }
};

// Expose moveMarker to global scope for popup button
window.moveMarker = moveMarker;

// Function to handle marker movement
const handleMoveMarker = async (e) => {
  if (!isMovingMarker.value || !movingMarkerId.value) return;

  const markerInstance = markers.value.find(m => m.id === movingMarkerId.value);
  if (!markerInstance) return;

  const { lng, lat } = e.lngLat;

  // Update marker position on map
  markerInstance.marker.setLngLat([lng, lat]);

  // Update marker position in database
  try {
    const response = await $fetch(`/api/markers`, {
      method: "PUT",
      body: {
        id: movingMarkerId.value,
        latitude: lat,
        longitude: lng,
        description: markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim(),
        session_hash: sessionHash.value
      },
    });

    if (response.success) {
      // Update popup content with new coordinates
      const markerData = {
        id: movingMarkerId.value,
        latitude: lat,
        longitude: lng,
        description: markerInstance.marker.getPopup()._content.querySelector('p strong').nextSibling.textContent.trim(),
        picture_url: null,
        session_hash: sessionHash.value
      };
      markerInstance.marker.getPopup().setHTML(createPopupContent(markerData, markerInstance));
    } else {
      alert("Failed to update marker position: " + response.error);
      // Revert marker position if update fails
      markerInstance.marker.setLngLat([response.marker.longitude, response.marker.latitude]);
    }
  } catch (error) {
    console.error("Error updating marker position:", error);
    alert("Error updating marker position: " + error.message);
    // Revert marker position if update fails (use last known position)
    markerInstance.marker.setLngLat([markerInstance.marker.getLngLat().lng, markerInstance.marker.getLngLat().lat]);
  }

  // Exit moving mode
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
      // Remove marker from map
      markerInstance.marker.remove();
      // Remove marker from local state
      markers.value = markers.value.filter(m => m.id !== markerId);
    } else {
      alert("Failed to remove marker: " + response.error);
    }
  } catch (error) {
    console.error("Error removing marker:", error);
    alert("Error removing marker: " + error.message);
  }
};

// Expose removeMarker to global scope for popup button
window.removeMarker = removeMarker;

// Toggle marker placement mode
const toggleAddMarker = () => {
  isAddingMarker.value = !isAddingMarker.value;
  isMovingMarker.value = false; // Disable moving mode when adding
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
  const description = ""; // Set default description (can be edited later via popup)

  // Create marker with popup
  const markerData = { latitude: lat, longitude: lng, description, session_hash: sessionHash.value };
  const popup = new maplibregl.Popup();
  const markerInstance = new maplibregl.Marker().setLngLat([lng, lat]).setPopup(popup).addTo(map);

  // Save marker to the database
  try {
    const response = await $fetch("/api/markers", {
      method: "POST",
      body: { latitude: lat, longitude: lng, description, picture_url: null, session_hash: sessionHash.value },
    });

    if (response.success) {
      // Update popup content with the new marker ID
      markerData.id = response.marker.id;
      popup.setHTML(createPopupContent(markerData, markerInstance));
      // Store marker instance with ID
      markers.value.push({ id: markerData.id, marker: markerInstance });

      // Add hover cursor event listeners
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
      markerInstance.remove(); // Remove marker if save fails
    }
  } catch (error) {
    console.error("Error saving marker:", error);
    alert("Error saving marker: " + error.message);
    markerInstance.remove(); // Remove marker if save fails
  }

  // Exit marker placement mode
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
      // Clear existing markers
      markers.value.forEach(m => {
        const markerElement = m.marker.getElement();
        markerElement.removeEventListener("mouseover", () => {});
        markerElement.removeEventListener("mouseleave", () => {});
        m.marker.remove();
      });
      markers.value = [];

      // Add new markers
      response.markers.forEach((marker) => {
        const popup = new maplibregl.Popup();
        const markerInstance = new maplibregl.Marker()
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(popup)
          .addTo(map);
        popup.setHTML(createPopupContent(marker, markerInstance));
        markers.value.push({ id: marker.id, marker: markerInstance });

        // Add hover cursor event listeners
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
    triggerNotification();
  } catch (error) {
    console.error("Error copying session hash:", error);
    alert("Failed to copy session hash: " + error.message);
  }
};

// Select and copy session hash on input click
const selectAndCopyHash = async (event) => {
  try {
    const input = event.target;
    input.select(); // Select all text in the input
    await navigator.clipboard.writeText(tempSessionHash.value);
    triggerNotification();
  } catch (error) {
    console.error("Error selecting and copying session hash:", error);
    alert("Failed to copy session hash: " + error.message);
  }
};

onMounted(async () => {
  // Get session hash and map position
  const mapPosition = await ensureSessionHashAndMapPosition();

  // Initialize the map with loaded or default position
  map = new maplibregl.Map({
    container: "map",
    style: osmStyle,
    center: mapPosition ? [mapPosition.center_longitude, mapPosition.center_latitude] : defaultCenter,
    zoom: mapPosition ? mapPosition.zoom_level : defaultZoom,
  });

  // Add navigation controls
  map.addControl(new maplibregl.NavigationControl());

  // Add geolocation control
  const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 6000,
    },
    trackUserLocation: false,
    showUserHeading: true,
  });
  map.addControl(geolocateControl, 'top-right');

  // Add click event listener for marker placement and movement
  map.on("click", handleMapClick);

  mapCanvas = map.getCanvas();

  // Wait for the map to fully load before loading markers
  map.on("load", async () => {
    // Load markers
    await loadMarkers();
  });

  // Add moveend event listener to save map position
  map.on("moveend", saveMapPosition);
});

onUnmounted(() => {
  // Clean up
  if (map) {
    map.off("click", handleMapClick);
    map.off("moveend", saveMapPosition);
    map.remove();
  }
  // Remove global functions
  delete window.removeMarker;
  delete window.editMarker;
  delete window.moveMarker;
  delete window.updateMarkerCoordinates;
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

/* Notification styles */
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

/* Animation for notification */
@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, -10px);
  }

  10% {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  90% {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -10px);
  }
}

/* Mobile-friendly adjustments */
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
}
</style>